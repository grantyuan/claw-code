use std::sync::Arc;
use std::time::{Duration, Instant};

use tokio::sync::{mpsc, RwLock};

use crate::performance::PerformanceModeConfig;

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum RoutingDecision {
    LocalOnly,
    CloudOnly,
    DualModel,
    Deferred,
}

#[derive(Debug, Clone)]
pub struct AdaptiveRouterConfig {
    pub enabled: bool,
    pub local_threshold_ms: u32,
    pub cloud_threshold_ms: u32,
    pub complexity_weight: f32,
    pub latency_weight: f32,
    pub quality_weight: f32,
    pub auto_tune: bool,
}

impl Default for AdaptiveRouterConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            local_threshold_ms: 5000,
            cloud_threshold_ms: 10000,
            complexity_weight: 0.4,
            latency_weight: 0.3,
            quality_weight: 0.3,
            auto_tune: true,
        }
    }
}

#[derive(Debug, Clone)]
pub struct RequestContext {
    pub estimated_complexity: f32,
    pub estimated_tokens: u32,
    pub urgency: UrgencyLevel,
    pub has_context: bool,
    pub preferred_model: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum UrgencyLevel {
    Low,
    Medium,
    High,
    Critical,
}

impl Default for UrgencyLevel {
    fn default() -> Self {
        Self::Medium
    }
}

#[derive(Debug, Clone)]
pub struct RoutingMetrics {
    pub local_decisions: u64,
    pub cloud_decisions: u64,
    pub dual_decisions: u64,
    pub deferred_decisions: u64,
    pub average_decision_time_us: u64,
    pub accuracy: f32,
}

impl Default for RoutingMetrics {
    fn default() -> Self {
        Self {
            local_decisions: 0,
            cloud_decisions: 0,
            dual_decisions: 0,
            deferred_decisions: 0,
            average_decision_time_us: 0,
            accuracy: 0.0,
        }
    }
}

impl RoutingMetrics {
    pub fn record_decision(&mut self, decision: RoutingDecision, latency_us: u64) {
        match decision {
            RoutingDecision::LocalOnly => self.local_decisions += 1,
            RoutingDecision::CloudOnly => self.cloud_decisions += 1,
            RoutingDecision::DualModel => self.dual_decisions += 1,
            RoutingDecision::Deferred => self.deferred_decisions += 1,
        }

        let total = self.total_decisions();
        if total > 1 {
            self.accuracy = ((total - 1) as f32 * self.accuracy
                + if decision != RoutingDecision::Deferred {
                    1.0
                } else {
                    0.0
                })
                / total as f32;
        }

        self.average_decision_time_us =
            (self.average_decision_time_us * (total - 1) + latency_us) / total;
    }

    pub fn total_decisions(&self) -> u64 {
        self.local_decisions + self.cloud_decisions + self.dual_decisions + self.deferred_decisions
    }

    pub fn local_ratio(&self) -> f32 {
        let total = self.total_decisions();
        if total == 0 {
            0.0
        } else {
            self.local_decisions as f32 / total as f32
        }
    }
}

pub struct AdaptiveRouter {
    config: AdaptiveRouterConfig,
    metrics: Arc<RwLock<RoutingMetrics>>,
    decision_history: Arc<RwLock<Vec<RoutingDecision>>>,
    performance_history: Arc<RwLock<Vec<PerformanceSample>>>,
}

#[derive(Debug, Clone)]
pub struct PerformanceSample {
    pub decision: RoutingDecision,
    pub actual_latency_ms: u64,
    pub quality_score: u8,
    pub tokens_used: u32,
    pub timestamp: Instant,
}

impl AdaptiveRouter {
    pub fn new(config: AdaptiveRouterConfig) -> Self {
        Self {
            config,
            metrics: Arc::new(RwLock::new(RoutingMetrics::default())),
            decision_history: Arc::new(RwLock::new(Vec::new())),
            performance_history: Arc::new(RwLock::new(Vec::new())),
        }
    }

    pub async fn route(&self, context: &RequestContext) -> RoutingDecision {
        let start = Instant::now();

        let decision = self.make_decision(context).await;

        let latency_us = start.elapsed().as_micros() as u64;
        {
            let mut metrics = self.metrics.write().await;
            metrics.record_decision(decision, latency_us);
        }

        {
            let mut history = self.decision_history.write().await;
            history.push(decision);
            if history.len() > 100 {
                history.remove(0);
            }
        }

        decision
    }

    async fn make_decision(&self, context: &RequestContext) -> RoutingDecision {
        if context.urgency == UrgencyLevel::Critical {
            return RoutingDecision::LocalOnly;
        }

        if context.urgency == UrgencyLevel::High && context.estimated_tokens < 500 {
            return RoutingDecision::LocalOnly;
        }

        let complexity_score = self.calculate_complexity_score(context);
        let latency_score = self.calculate_latency_score(context);
        let quality_score = self.calculate_quality_score(context);

        let overall_score = complexity_score * self.config.complexity_weight
            + latency_score * self.config.latency_weight
            + quality_score * self.config.quality_weight;

        if overall_score < 0.3 {
            RoutingDecision::LocalOnly
        } else if overall_score < 0.6 {
            RoutingDecision::DualModel
        } else if overall_score < 0.8 {
            RoutingDecision::CloudOnly
        } else {
            RoutingDecision::Deferred
        }
    }

    fn calculate_complexity_score(&self, context: &RequestContext) -> f32 {
        let complexity = context.estimated_complexity;

        let token_factor = if context.estimated_tokens < 200 {
            0.1
        } else if context.estimated_tokens < 500 {
            0.3
        } else if context.estimated_tokens < 1000 {
            0.5
        } else {
            0.8
        };

        (complexity + token_factor) / 2.0
    }

    fn calculate_latency_score(&self, context: &RequestContext) -> f32 {
        match context.urgency {
            UrgencyLevel::Low => 0.2,
            UrgencyLevel::Medium => 0.5,
            UrgencyLevel::High => 0.8,
            UrgencyLevel::Critical => 1.0,
        }
    }

    fn calculate_quality_score(&self, context: &RequestContext) -> f32 {
        if context.has_context {
            0.6
        } else {
            0.4
        }
    }

    pub async fn record_performance(&self, sample: PerformanceSample) {
        let mut history = self.performance_history.write().await;
        history.push(sample);

        if history.len() > 100 {
            history.remove(0);
        }

        if self.config.auto_tune && history.len() >= 10 {
            self.tune_weights(&history).await;
        }
    }

    async fn tune_weights(&self, history: &[PerformanceSample]) {
        let recent: Vec<_> = history.iter().rev().take(10).collect();

        let mut local_success = 0u32;
        let mut cloud_success = 0u32;
        let mut dual_success = 0u32;

        for sample in &recent {
            let success = if sample.quality_score >= 70 && sample.actual_latency_ms < 5000 {
                1.0
            } else if sample.quality_score >= 50 {
                0.5
            } else {
                0.0
            };

            match sample.decision {
                RoutingDecision::LocalOnly => local_success += success as u32,
                RoutingDecision::CloudOnly => cloud_success += success as u32,
                RoutingDecision::DualModel => dual_success += success as u32,
                RoutingDecision::Deferred => {}
            }
        }

        let total = (local_success + cloud_success + dual_success) as f32;
        if total > 0.0 {
            let complexity_weight = (local_success as f32 / total).max(0.2);
            let latency_weight = (cloud_success as f32 / total).max(0.2);
            let quality_weight = (dual_success as f32 / total).max(0.2);

            let _sum = complexity_weight + latency_weight + quality_weight;
        }
    }

    pub async fn get_metrics(&self) -> RoutingMetrics {
        self.metrics.read().await.clone()
    }

    pub async fn get_recent_decisions(&self) -> Vec<RoutingDecision> {
        self.decision_history.read().await.clone()
    }
}

pub struct DynamicThrottler {
    requests_per_second: Arc<RwLock<f32>>,
    burst_size: Arc<RwLock<u32>>,
    current_rate: Arc<RwLock<f32>>,
    last_check: Arc<RwLock<Instant>>,
}

impl DynamicThrottler {
    pub fn new(rps: f32, burst: u32) -> Self {
        Self {
            requests_per_second: Arc::new(RwLock::new(rps)),
            burst_size: Arc::new(RwLock::new(burst)),
            current_rate: Arc::new(RwLock::new(rps)),
            last_check: Arc::new(RwLock::new(Instant::now())),
        }
    }

    pub async fn should_allow(&self) -> bool {
        let rate = *self.requests_per_second.read().await;
        let current = *self.current_rate.read().await;

        let now = Instant::now();
        let elapsed = now
            .duration_since(*self.last_check.read().await)
            .as_secs_f32();

        if elapsed >= 1.0 {
            let mut current = self.current_rate.write().await;
            let tokens_generated = rate * elapsed;
            let new_rate = (*current * 0.9 + tokens_generated * 0.1).min(rate * 1.5);
            *current = new_rate;

            let mut last = self.last_check.write().await;
            *last = now;
        }

        true
    }

    pub async fn adjust_rate(&self, factor: f32) {
        let mut current = self.current_rate.write().await;
        *current = (*current * factor).max(0.1);
    }
}

pub struct TokenBucket {
    capacity: u32,
    tokens: Arc<RwLock<f32>>,
    refill_rate: f32,
    last_refill: Arc<RwLock<Instant>>,
}

impl TokenBucket {
    pub fn new(capacity: u32, refill_per_second: f32) -> Self {
        Self {
            capacity,
            tokens: Arc::new(RwLock::new(capacity as f32)),
            refill_rate: refill_per_second,
            last_refill: Arc::new(RwLock::new(Instant::now())),
        }
    }

    pub async fn try_acquire(&self, cost: u32) -> bool {
        self.refill().await;

        let mut tokens = self.tokens.write().await;
        if *tokens >= cost as f32 {
            *tokens -= cost as f32;
            true
        } else {
            false
        }
    }

    async fn refill(&self) {
        let now = Instant::now();
        let elapsed = now
            .duration_since(*self.last_refill.read().await)
            .as_secs_f32();

        if elapsed > 0.0 {
            let mut tokens = self.tokens.write().await;
            let refill = elapsed * self.refill_rate;
            *tokens = (*tokens + refill).min(self.capacity as f32);

            let mut last = self.last_refill.write().await;
            *last = now;
        }
    }

    pub async fn available_tokens(&self) -> f32 {
        self.refill().await;
        *self.tokens.read().await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_routing_decisions() {
        let router = AdaptiveRouter::new(AdaptiveRouterConfig::default());

        let context = RequestContext {
            estimated_complexity: 0.5,
            estimated_tokens: 300,
            urgency: UrgencyLevel::Medium,
            has_context: true,
            preferred_model: None,
        };

        let decision = router.route(&context).await;
        assert_ne!(decision, RoutingDecision::Deferred);
    }

    #[tokio::test]
    async fn test_routing_metrics_recording() {
        let router = AdaptiveRouter::new(AdaptiveRouterConfig::default());

        let context = RequestContext {
            estimated_complexity: 0.2,
            estimated_tokens: 100,
            urgency: UrgencyLevel::Low,
            has_context: false,
            preferred_model: None,
        };

        router.route(&context).await;

        let metrics = router.get_metrics().await;
        assert_eq!(metrics.total_decisions(), 1);
    }

    #[tokio::test]
    async fn test_token_bucket_acquisition() {
        let bucket = TokenBucket::new(10, 5.0);

        assert!(bucket.try_acquire(5).await);
        assert!(bucket.try_acquire(4).await);
        assert!(!bucket.try_acquire(2).await);
    }

    #[tokio::test]
    async fn test_dynamic_throttler() {
        let throttler = DynamicThrottler::new(100.0, 10);

        assert!(throttler.should_allow().await);

        throttler.adjust_rate(0.5).await;
    }
}
