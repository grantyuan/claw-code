use std::sync::Arc;
use tokio::sync::RwLock;

pub mod adaptive;
pub mod dual_model;
pub mod predictive;
pub mod staggered;

#[derive(Debug, Clone)]
pub struct OptimizationMetrics {
    pub token_reduction_percent: f32,
    pub speed_improvement_percent: f32,
    pub quality_score: u8,
    pub processing_time_ms: u64,
    pub tokens_used: u32,
    pub cycle_number: u8,
}

impl OptimizationMetrics {
    pub fn new(cycle: u8) -> Self {
        Self {
            token_reduction_percent: 0.0,
            speed_improvement_percent: 0.0,
            quality_score: 0,
            processing_time_ms: 0,
            tokens_used: 0,
            cycle_number: cycle,
        }
    }

    pub fn with_baseline(mut self, baseline: &BaselineMetrics) -> Self {
        if baseline.tokens_used > 0 && self.tokens_used > 0 {
            self.token_reduction_percent = ((baseline.tokens_used as f32
                - self.tokens_used as f32)
                / baseline.tokens_used as f32)
                * 100.0;
        }
        if baseline.processing_time_ms > 0 && self.processing_time_ms > 0 {
            let baseline_time = baseline.processing_time_ms as f32;
            let current_time = self.processing_time_ms as f32;
            self.speed_improvement_percent =
                ((baseline_time - current_time) / baseline_time) * 100.0;
        }
        self
    }
}

#[derive(Debug, Clone)]
pub struct BaselineMetrics {
    pub tokens_used: u32,
    pub processing_time_ms: u64,
    pub quality_score: u8,
}

impl Default for BaselineMetrics {
    fn default() -> Self {
        Self {
            tokens_used: 1000,
            processing_time_ms: 2000,
            quality_score: 70,
        }
    }
}

pub struct IterationTracker {
    current_cycle: u8,
    baseline: BaselineMetrics,
    metrics_history: Vec<OptimizationMetrics>,
    target_token_reduction: f32,
    target_speed_improvement: f32,
}

impl IterationTracker {
    pub fn new() -> Self {
        Self {
            current_cycle: 0,
            baseline: BaselineMetrics::default(),
            metrics_history: Vec::new(),
            target_token_reduction: 12.0,
            target_speed_improvement: 5.0,
        }
    }

    pub fn with_baseline(mut self, baseline: BaselineMetrics) -> Self {
        self.baseline = baseline;
        self
    }

    pub fn record_iteration(&mut self, metrics: OptimizationMetrics) -> IterationResult {
        self.current_cycle += 1;
        let adjusted_metrics = metrics.with_baseline(&self.baseline);
        self.metrics_history.push(adjusted_metrics.clone());

        let token_ok = adjusted_metrics.token_reduction_percent >= self.target_token_reduction;
        let speed_ok = adjusted_metrics.speed_improvement_percent >= self.target_speed_improvement;

        IterationResult {
            metrics: adjusted_metrics,
            token_target_met: token_ok,
            speed_target_met: speed_ok,
            overall_success: token_ok && speed_ok,
        }
    }

    pub fn get_baseline(&self) -> &BaselineMetrics {
        &self.baseline
    }

    pub fn get_history(&self) -> &[OptimizationMetrics] {
        &self.metrics_history
    }

    pub fn current_cycle(&self) -> u8 {
        self.current_cycle
    }
}

impl Default for IterationTracker {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug)]
pub struct IterationResult {
    pub metrics: OptimizationMetrics,
    pub token_target_met: bool,
    pub speed_target_met: bool,
    pub overall_success: bool,
}

pub struct OptimizationEngine {
    tracker: Arc<RwLock<IterationTracker>>,
    current_strategy: Arc<RwLock<OptimizationStrategy>>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum OptimizationStrategy {
    Baseline,
    DualModelPipeline,
    QualityScoring,
    ContextCompression,
    ParallelPipeline,
    AdaptiveRouting,
}

impl OptimizationEngine {
    pub fn new() -> Self {
        Self {
            tracker: Arc::new(RwLock::new(IterationTracker::new())),
            current_strategy: Arc::new(RwLock::new(OptimizationStrategy::Baseline)),
        }
    }

    pub async fn next_iteration(&self) -> u8 {
        let mut tracker = self.tracker.write().await;
        tracker.current_cycle += 1;
        tracker.current_cycle
    }

    pub async fn record_metrics(&self, metrics: OptimizationMetrics) -> IterationResult {
        let mut tracker = self.tracker.write().await;
        tracker.record_iteration(metrics)
    }

    pub async fn get_strategy(&self) -> OptimizationStrategy {
        *self.current_strategy.read().await
    }

    pub async fn set_strategy(&self, strategy: OptimizationStrategy) {
        let mut current = self.current_strategy.write().await;
        *current = strategy;
    }

    pub async fn get_cumulative_improvement(&self) -> CumulativeImprovement {
        let tracker = self.tracker.read().await;
        let history = &tracker.metrics_history;

        if history.is_empty() {
            return CumulativeImprovement::default();
        }

        let total_token_reduction = history
            .iter()
            .map(|m| m.token_reduction_percent)
            .sum::<f32>()
            / history.len() as f32;
        let total_speed_improvement = history
            .iter()
            .map(|m| m.speed_improvement_percent)
            .sum::<f32>()
            / history.len() as f32;
        let avg_quality =
            history.iter().map(|m| m.quality_score as f32).sum::<f32>() / history.len() as f32;

        CumulativeImprovement {
            total_token_reduction_percent: total_token_reduction,
            total_speed_improvement_percent: total_speed_improvement,
            average_quality_score: avg_quality as u8,
            cycles_completed: history.len() as u8,
        }
    }
}

impl Default for OptimizationEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone, Default)]
pub struct CumulativeImprovement {
    pub total_token_reduction_percent: f32,
    pub total_speed_improvement_percent: f32,
    pub average_quality_score: u8,
    pub cycles_completed: u8,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_baseline_metrics_calculation() {
        let baseline = BaselineMetrics {
            tokens_used: 1000,
            processing_time_ms: 2000,
            quality_score: 70,
        };

        let metrics = OptimizationMetrics::new(1);
        let adjusted = metrics.with_baseline(&baseline);

        assert_eq!(adjusted.token_reduction_percent, 0.0);
        assert_eq!(adjusted.speed_improvement_percent, 0.0);
    }

    #[test]
    fn test_iteration_metrics_with_improvement() {
        let baseline = BaselineMetrics {
            tokens_used: 1000,
            processing_time_ms: 2000,
            quality_score: 70,
        };

        let mut metrics = OptimizationMetrics::new(1);
        metrics.tokens_used = 850;
        metrics.processing_time_ms = 1800;
        metrics.quality_score = 75;

        let adjusted = metrics.with_baseline(&baseline);

        assert!((adjusted.token_reduction_percent - 15.0).abs() < 0.1);
        assert!((adjusted.speed_improvement_percent - 10.0).abs() < 0.1);
    }

    #[tokio::test]
    async fn test_optimization_engine_tracking() {
        let engine = OptimizationEngine::new();

        let mut metrics = OptimizationMetrics::new(1);
        metrics.token_reduction_percent = 15.0;
        metrics.speed_improvement_percent = 10.0;
        metrics.tokens_used = 850;
        metrics.processing_time_ms = 1800;
        let result = engine.record_metrics(metrics).await;

        assert!(result.token_target_met);
        assert!(result.speed_target_met);
        assert!(result.overall_success);
    }

    #[tokio::test]
    async fn test_strategy_transitions() {
        let engine = OptimizationEngine::new();

        assert_eq!(engine.get_strategy().await, OptimizationStrategy::Baseline);

        engine
            .set_strategy(OptimizationStrategy::DualModelPipeline)
            .await;
        assert_eq!(
            engine.get_strategy().await,
            OptimizationStrategy::DualModelPipeline
        );

        engine
            .set_strategy(OptimizationStrategy::QualityScoring)
            .await;
        assert_eq!(
            engine.get_strategy().await,
            OptimizationStrategy::QualityScoring
        );
    }
}
