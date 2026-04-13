pub mod ollama_client;
pub mod tiered_router;

pub mod context;
pub mod health;
pub mod monitoring;
pub mod optimization;
pub mod performance;

pub mod strategy;

pub use monitoring::{
    ContextMetrics, HealthMetrics, LogLevel, Logger, MetricsExporter, PerformanceMetrics,
};
pub use ollama_client::{OllamaClient, OllamaClientInterface};
pub use strategy::{
    ProcessingMode, QualityMetrics, StrategyConfig, StrategyProcessor, StrategyResult,
    TaskComplexity,
};
pub use tiered_router::{RoutedClient, TieredRouterConfig};

pub mod optimization_modules {
    pub use crate::optimization::adaptive::{
        AdaptiveRouter, AdaptiveRouterConfig, DynamicThrottler, RequestContext, RoutingDecision,
        RoutingMetrics, TokenBucket,
    };
    pub use crate::optimization::dual_model::{
        DualModelConfig, DualModelMetrics, DualModelProcessor, DualModelRequest, DualModelResponse,
        ModelSource, QualityReviewResult, QualityReviewer,
    };
    pub use crate::optimization::predictive::{
        BatchOptimizer, ModelChoice, Prediction, PredictiveCache, PredictiveConfig,
        PredictiveModelSelector, RequestSignature,
    };
    pub use crate::optimization::staggered::{
        ArchitectureAnalyzer, FeasibilityReport, ParallelPipeline, PipelineResult,
        StaggeredWorkflow, WorkflowMetrics, WorkflowStage,
    };
    pub use crate::optimization::{
        BaselineMetrics, CumulativeImprovement, IterationResult, IterationTracker,
        OptimizationEngine, OptimizationMetrics, OptimizationStrategy,
    };
}
