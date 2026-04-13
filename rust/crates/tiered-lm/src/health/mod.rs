use std::sync::Arc;
use std::time::{Duration, Instant};

use tokio::sync::{mpsc, RwLock};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CircuitState {
    Closed,
    Open,
    HalfOpen,
}

#[derive(Debug, Clone)]
pub struct HealthMonitorConfig {
    pub enabled: bool,
    pub connection_timeout_ms: u32,
    pub consecutive_error_threshold: u32,
    pub token_usage_warning_percent: f32,
    pub token_usage_limit_percent: f32,
    pub failover_timeout_ms: u32,
    pub health_check_interval_secs: u32,
    pub recovery_stable_duration_secs: u32,
}

impl Default for HealthMonitorConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            connection_timeout_ms: 5000,
            consecutive_error_threshold: 3,
            token_usage_warning_percent: 80.0,
            token_usage_limit_percent: 95.0,
            failover_timeout_ms: 100,
            health_check_interval_secs: 30,
            recovery_stable_duration_secs: 120,
        }
    }
}

#[derive(Debug)]
pub struct HealthMonitor {
    config: HealthMonitorConfig,
    state: Arc<RwLock<CircuitState>>,
    failure_count: Arc<RwLock<u32>>,
    last_failure_time: Arc<RwLock<Option<Instant>>>,
    consecutive_successes: Arc<RwLock<u32>>,
    token_usage_percent: Arc<RwLock<f32>>,
    state_change_tx: mpsc::UnboundedSender<CircuitState>,
}

impl HealthMonitor {
    pub fn new(config: HealthMonitorConfig) -> (Self, mpsc::UnboundedReceiver<CircuitState>) {
        let (tx, rx) = mpsc::unbounded_channel();
        let monitor = Self {
            config,
            state: Arc::new(RwLock::new(CircuitState::Closed)),
            failure_count: Arc::new(RwLock::new(0)),
            last_failure_time: Arc::new(RwLock::new(None)),
            consecutive_successes: Arc::new(RwLock::new(0)),
            token_usage_percent: Arc::new(RwLock::new(0.0)),
            state_change_tx: tx,
        };
        (monitor, rx)
    }

    pub async fn record_success(&self) {
        if !self.config.enabled {
            return;
        }

        let mut successes = self.consecutive_successes.write().await;
        *successes += 1;

        if *successes >= 2 {
            let mut state = self.state.write().await;
            let current_state = *state;

            if current_state == CircuitState::HalfOpen {
                *state = CircuitState::Closed;
                let _ = self.state_change_tx.send(CircuitState::Closed);
            }
        }

        let mut failures = self.failure_count.write().await;
        *failures = 0;
    }

    pub async fn record_failure(&self, failure_type: FailureType) -> bool {
        if !self.config.enabled {
            return false;
        }

        let mut failures = self.failure_count.write().await;
        *failures += 1;
        let current_failures = *failures;

        let mut last_time = self.last_failure_time.write().await;
        *last_time = Some(Instant::now());

        let mut successes = self.consecutive_successes.write().await;
        *successes = 0;

        match failure_type {
            FailureType::ConnectionTimeout | FailureType::ServerError => {
                if current_failures >= self.config.consecutive_error_threshold {
                    let mut state = self.state.write().await;
                    if *state != CircuitState::Open {
                        *state = CircuitState::Open;
                        let _ = self.state_change_tx.send(CircuitState::Open);
                        return true;
                    }
                }
            }
            FailureType::TokenLimitExceeded => {
                let mut state = self.state.write().await;
                *state = CircuitState::Open;
                let _ = self.state_change_tx.send(CircuitState::Open);
                return true;
            }
        }

        false
    }

    pub async fn update_token_usage(&self, percent: f32) {
        if !self.config.enabled {
            return;
        }

        let mut usage = self.token_usage_percent.write().await;
        *usage = percent;

        if percent >= self.config.token_usage_limit_percent {
            self.record_failure(FailureType::TokenLimitExceeded).await;
        }
    }

    pub async fn get_state(&self) -> CircuitState {
        *self.state.read().await
    }

    pub async fn should_failover(&self) -> bool {
        let state = self.get_state().await;
        state == CircuitState::Open
    }

    pub async fn check_recovery(&self) -> bool {
        if !self.config.enabled {
            return false;
        }

        let state = self.get_state().await;
        if state != CircuitState::Open {
            return false;
        }

        let last_time = self.last_failure_time.read().await;
        if let Some(time) = *last_time {
            let elapsed = time.elapsed();
            let check_interval = Duration::from_secs(self.config.health_check_interval_secs as u64);

            if elapsed >= check_interval {
                return true;
            }
        }

        false
    }

    pub async fn transition_to_half_open(&self) {
        let mut state = self.state.write().await;
        if *state == CircuitState::Open {
            *state = CircuitState::HalfOpen;
            let _ = self.state_change_tx.send(CircuitState::HalfOpen);
        }
    }

    pub fn connection_timeout(&self) -> Duration {
        Duration::from_millis(self.config.connection_timeout_ms as u64)
    }

    pub fn failover_timeout(&self) -> Duration {
        Duration::from_millis(self.config.failover_timeout_ms as u64)
    }
}

#[derive(Debug, Clone, Copy)]
pub enum FailureType {
    ConnectionTimeout,
    ServerError,
    TokenLimitExceeded,
}

pub struct FailoverManager {
    health_monitor: Arc<HealthMonitor>,
    use_local_fallback: Arc<RwLock<bool>>,
}

impl FailoverManager {
    pub fn new(health_monitor: Arc<HealthMonitor>) -> Self {
        Self {
            health_monitor,
            use_local_fallback: Arc::new(RwLock::new(false)),
        }
    }

    pub async fn should_use_local(&self) -> bool {
        if self.health_monitor.should_failover().await {
            let mut use_local = self.use_local_fallback.write().await;
            *use_local = true;
            return true;
        }

        let use_local = self.use_local_fallback.read().await;
        *use_local
    }

    pub async fn on_cloud_recovered(&self) {
        let mut use_local = self.use_local_fallback.write().await;
        *use_local = false;
        self.health_monitor.record_success().await;
    }

    pub async fn get_failover_reason(&self) -> Option<String> {
        let failures = *self.health_monitor.failure_count.read().await;
        let usage = *self.health_monitor.token_usage_percent.read().await;

        if failures >= self.health_monitor.config.consecutive_error_threshold {
            return Some(format!(
                "Consecutive errors: {} (threshold: {})",
                failures, self.health_monitor.config.consecutive_error_threshold
            ));
        }

        if usage >= self.health_monitor.config.token_usage_limit_percent {
            return Some(format!(
                "Token usage: {:.1}% (limit: {:.1}%)",
                usage, self.health_monitor.config.token_usage_limit_percent
            ));
        }

        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_circuit_breaker_opens_after_threshold() {
        let config = HealthMonitorConfig {
            consecutive_error_threshold: 3,
            ..Default::default()
        };
        let (monitor, _rx) = HealthMonitor::new(config);

        assert_eq!(monitor.get_state().await, CircuitState::Closed);

        monitor.record_failure(FailureType::ServerError).await;
        assert_eq!(monitor.get_state().await, CircuitState::Closed);

        monitor.record_failure(FailureType::ServerError).await;
        assert_eq!(monitor.get_state().await, CircuitState::Closed);

        let should_failover = monitor.record_failure(FailureType::ServerError).await;
        assert!(should_failover);
        assert_eq!(monitor.get_state().await, CircuitState::Open);
    }

    #[tokio::test]
    async fn test_token_limit_triggers_failover() {
        let config = HealthMonitorConfig {
            token_usage_limit_percent: 80.0,
            ..Default::default()
        };
        let (monitor, _rx) = HealthMonitor::new(config);

        monitor.update_token_usage(85.0).await;
        assert_eq!(monitor.get_state().await, CircuitState::Open);
    }
}
