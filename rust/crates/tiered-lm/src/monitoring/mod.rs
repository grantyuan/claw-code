use std::sync::Arc;
use std::time::Instant;

use tokio::sync::RwLock;

pub struct MetricsExporter {
    health_state: Arc<RwLock<HealthMetrics>>,
    context_metrics: Arc<RwLock<ContextMetrics>>,
    performance_metrics: Arc<RwLock<PerformanceMetrics>>,
    circuit_breaker_state: Arc<RwLock<CircuitBreakerState>>,
}

#[derive(Debug, Clone, Default)]
pub struct HealthMetrics {
    pub cloud_model_healthy: bool,
    pub failover_triggered_count: u64,
    pub recovery_completed_count: u64,
    pub consecutive_failures: u32,
    pub token_usage_percent: f32,
    pub last_failure_time: Option<Instant>,
}

#[derive(Debug, Clone, Default)]
pub struct ContextMetrics {
    pub current_tokens: u32,
    pub average_tps: f32,
    pub compression_ratio: f32,
    pub overflow_detected_count: u64,
    pub last_compression_time: Option<Instant>,
}

#[derive(Debug, Clone, Default)]
pub struct PerformanceMetrics {
    pub local_model_latency_ms: u64,
    pub cloud_model_latency_ms: u64,
    pub quality_score: Option<u8>,
    pub dual_model_requests: u64,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum CircuitBreakerState {
    Closed,
    HalfOpen,
    Open,
}

impl Default for CircuitBreakerState {
    fn default() -> Self {
        Self::Closed
    }
}

impl MetricsExporter {
    pub fn new() -> Self {
        Self {
            health_state: Arc::new(RwLock::new(HealthMetrics::default())),
            context_metrics: Arc::new(RwLock::new(ContextMetrics::default())),
            performance_metrics: Arc::new(RwLock::new(PerformanceMetrics::default())),
            circuit_breaker_state: Arc::new(RwLock::new(CircuitBreakerState::Closed)),
        }
    }

    pub async fn record_health_state(&self, healthy: bool) {
        let mut metrics = self.health_state.write().await;
        metrics.cloud_model_healthy = healthy;
    }

    pub async fn record_failover(&self) {
        let mut metrics = self.health_state.write().await;
        metrics.failover_triggered_count += 1;
    }

    pub async fn record_recovery(&self) {
        let mut metrics = self.health_state.write().await;
        metrics.recovery_completed_count += 1;
    }

    pub async fn record_failure(&self, failure_count: u32) {
        let mut metrics = self.health_state.write().await;
        metrics.consecutive_failures = failure_count;
        metrics.last_failure_time = Some(Instant::now());
    }

    pub async fn record_token_usage(&self, percent: f32) {
        let mut metrics = self.health_state.write().await;
        metrics.token_usage_percent = percent;
    }

    pub async fn record_context_tokens(&self, tokens: u32, tps: f32) {
        let mut metrics = self.context_metrics.write().await;
        metrics.current_tokens = tokens;
        metrics.average_tps = tps;
    }

    pub async fn record_compression(&self, ratio: f32) {
        let mut metrics = self.context_metrics.write().await;
        metrics.compression_ratio = ratio;
        metrics.last_compression_time = Some(Instant::now());
    }

    pub async fn record_context_overflow(&self) {
        let mut metrics = self.context_metrics.write().await;
        metrics.overflow_detected_count += 1;
    }

    pub async fn record_local_latency(&self, latency_ms: u64) {
        let mut metrics = self.performance_metrics.write().await;
        metrics.local_model_latency_ms = latency_ms;
    }

    pub async fn record_cloud_latency(&self, latency_ms: u64) {
        let mut metrics = self.performance_metrics.write().await;
        metrics.cloud_model_latency_ms = latency_ms;
    }

    pub async fn record_quality_score(&self, score: u8) {
        let mut metrics = self.performance_metrics.write().await;
        metrics.quality_score = Some(score);
    }

    pub async fn record_dual_model_request(&self) {
        let mut metrics = self.performance_metrics.write().await;
        metrics.dual_model_requests += 1;
    }

    pub async fn record_circuit_breaker_state(&self, state: CircuitBreakerState) {
        let mut cb_state = self.circuit_breaker_state.write().await;
        *cb_state = state;
    }

    pub fn prometheus_metrics(&self) -> String {
        let output = String::new();
        output
    }
}

impl Default for MetricsExporter {
    fn default() -> Self {
        Self::new()
    }
}

pub struct Logger {
    module: String,
    level: LogLevel,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum LogLevel {
    Debug,
    Info,
    Warn,
    Error,
}

impl Logger {
    pub fn new(module: &str) -> Self {
        Self {
            module: module.to_string(),
            level: LogLevel::Info,
        }
    }

    pub fn with_level(mut self, level: LogLevel) -> Self {
        self.level = level;
        self
    }

    pub fn debug(&self, message: &str) {
        if self.level <= LogLevel::Debug {
            self.log("DEBUG", message);
        }
    }

    pub fn info(&self, message: &str) {
        if self.level <= LogLevel::Info {
            self.log("INFO", message);
        }
    }

    pub fn warn(&self, message: &str) {
        if self.level <= LogLevel::Warn {
            self.log("WARN", message);
        }
    }

    pub fn error(&self, message: &str) {
        if self.level <= LogLevel::Error {
            self.log("ERROR", message);
        }
    }

    fn log(&self, level: &str, message: &str) {
        let timestamp = chrono_lite_timestamp();
        eprintln!("[{}] {} [{}] {}", timestamp, level, self.module, message);
    }
}

fn chrono_lite_timestamp() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    format!("{}.{:06}", now.as_secs(), now.subsec_micros())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_metrics_recording() {
        let exporter = MetricsExporter::new();

        exporter.record_failover().await;
        assert_eq!(
            exporter.health_state.read().await.failover_triggered_count,
            1
        );

        exporter.record_context_tokens(50000, 150.0).await;
        assert_eq!(exporter.context_metrics.read().await.current_tokens, 50000);

        exporter.record_local_latency(250).await;
        assert_eq!(
            exporter
                .performance_metrics
                .read()
                .await
                .local_model_latency_ms,
            250
        );
    }

    #[tokio::test]
    async fn test_circuit_breaker_state_transitions() {
        let exporter = MetricsExporter::new();

        exporter
            .record_circuit_breaker_state(CircuitBreakerState::Open)
            .await;
        assert_eq!(
            *exporter.circuit_breaker_state.read().await,
            CircuitBreakerState::Open
        );

        exporter
            .record_circuit_breaker_state(CircuitBreakerState::HalfOpen)
            .await;
        assert_eq!(
            *exporter.circuit_breaker_state.read().await,
            CircuitBreakerState::HalfOpen
        );
    }
}
