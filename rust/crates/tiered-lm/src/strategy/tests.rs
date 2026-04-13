#[cfg(test)]
mod tests {
    use crate::strategy::{
        HybridQualityEvaluator, ProcessingMode, QualityMetrics, RuleBasedEvaluator, StrategyConfig,
        TaskComplexity,
    };

    #[test]
    fn test_processing_mode_default() {
        let config = StrategyConfig::default();
        assert_eq!(config.mode, ProcessingMode::SpeedFirst);
    }

    #[test]
    fn test_processing_mode_display() {
        assert_eq!(ProcessingMode::SpeedFirst.to_string(), "speed_first");
        assert_eq!(ProcessingMode::TokenFirst.to_string(), "token_first");
    }

    #[test]
    fn test_task_complexity_from_str() {
        assert_eq!(TaskComplexity::from_str("复杂"), TaskComplexity::Complex);
        assert_eq!(TaskComplexity::from_str("中等"), TaskComplexity::Medium);
        assert_eq!(TaskComplexity::from_str("简单"), TaskComplexity::Simple);
        assert_eq!(TaskComplexity::from_str("Complex"), TaskComplexity::Complex);
        assert_eq!(TaskComplexity::from_str("unknown"), TaskComplexity::Simple);
    }

    #[test]
    fn test_quality_metrics_default() {
        let metrics = QualityMetrics::default();
        assert_eq!(metrics.final_score, 50.0);
    }

    #[test]
    fn test_rule_based_evaluator_short_response() {
        let evaluator = RuleBasedEvaluator::new();
        let metrics = evaluator.evaluate("Hi", "test");
        assert!(metrics.completeness < 50.0);
    }

    #[test]
    fn test_rule_based_evaluator_long_response() {
        let evaluator = RuleBasedEvaluator::new();
        let metrics = evaluator.evaluate(
            "This is a longer response. It has multiple sentences. And it ends with a period.",
            "test",
        );
        assert!(metrics.final_score > 60.0);
    }

    #[test]
    fn test_rule_based_evaluator_missing_ending() {
        let evaluator = RuleBasedEvaluator::new();
        let metrics = evaluator.evaluate("This is a response without ending", "test");
        assert!(metrics.accuracy < 80.0);
    }

    #[test]
    fn test_strategy_config_default_values() {
        let config = StrategyConfig::default();
        assert_eq!(config.quality_threshold, 70);
        assert_eq!(config.self_assessment_timeout_ms, 10000);
        assert!(config.enable_local_self_assessment);
        assert_eq!(config.simple_task_local_token_limit, 500);
        assert_eq!(config.medium_task_remote_token_limit, 2000);
        assert_eq!(config.api_timeout_ms, 300_000);
        assert_eq!(config.local_model_timeout_ms, 120_000);
    }

    #[test]
    fn test_hybrid_evaluator_implements_trait() {
        let evaluator = HybridQualityEvaluator::new();
        let metrics = evaluator.evaluate("This is a test response.", "test context");
        assert!(metrics.final_score >= 50.0);
    }

    #[test]
    fn test_task_complexity_eq() {
        assert_eq!(TaskComplexity::Simple, TaskComplexity::Simple);
        assert_ne!(TaskComplexity::Simple, TaskComplexity::Complex);
    }

    #[test]
    fn test_quality_metrics_all_fields() {
        let metrics = QualityMetrics {
            completeness: 80.0,
            coherence: 75.0,
            accuracy: 85.0,
            final_score: 80.0,
        };
        assert_eq!(metrics.completeness, 80.0);
        assert_eq!(metrics.coherence, 75.0);
        assert_eq!(metrics.accuracy, 85.0);
        assert_eq!(metrics.final_score, 80.0);
    }
}
