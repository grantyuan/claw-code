use std::sync::Arc;
use std::time::Instant;

use tokio::sync::RwLock;

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum WorkflowStage {
    Idle,
    LocalGeneration,
    LocalComplete,
    CloudReview,
    QualityCheck,
    Finalize,
    Completed,
}

impl Default for WorkflowStage {
    fn default() -> Self {
        Self::Idle
    }
}

#[derive(Debug, Clone)]
pub struct WorkflowMetrics {
    pub stage_durations_ms: Vec<u64>,
    pub total_duration_ms: u64,
    pub tokens_processed: u32,
    pub parallel_efficiency: f32,
}

impl WorkflowMetrics {
    pub fn new() -> Self {
        Self {
            stage_durations_ms: Vec::new(),
            total_duration_ms: 0,
            tokens_processed: 0,
            parallel_efficiency: 0.0,
        }
    }

    pub fn add_stage_duration(&mut self, duration_ms: u64) {
        self.stage_durations_ms.push(duration_ms);
    }

    pub fn finalize(&mut self, total_ms: u64) {
        self.total_duration_ms = total_ms;
        if !self.stage_durations_ms.is_empty() {
            let sequential_time: u64 = self.stage_durations_ms.iter().sum();
            if sequential_time > 0 {
                self.parallel_efficiency = (sequential_time as f32 / total_ms as f32).min(2.0);
            }
        }
    }
}

impl Default for WorkflowMetrics {
    fn default() -> Self {
        Self::new()
    }
}

pub struct StaggeredWorkflow {
    current_stage: Arc<RwLock<WorkflowStage>>,
    stage_history: Arc<RwLock<Vec<WorkflowStage>>>,
    stage_timestamps: Arc<RwLock<Vec<Instant>>>,
    metrics: Arc<RwLock<WorkflowMetrics>>,
}

impl StaggeredWorkflow {
    pub fn new() -> Self {
        Self {
            current_stage: Arc::new(RwLock::new(WorkflowStage::Idle)),
            stage_history: Arc::new(RwLock::new(Vec::new())),
            stage_timestamps: Arc::new(RwLock::new(Vec::new())),
            metrics: Arc::new(RwLock::new(WorkflowMetrics::new())),
        }
    }

    pub async fn transition_to(&self, stage: WorkflowStage) -> StageTransitionResult {
        let now = Instant::now();
        let previous = self.get_current_stage().await;

        let mut current = self.current_stage.write().await;
        *current = stage.clone();

        let mut history = self.stage_history.write().await;
        history.push(stage.clone());

        let mut timestamps = self.stage_timestamps.write().await;
        timestamps.push(now);

        if let Some(last_time) = timestamps.iter().rev().nth(1) {
            let duration = now.duration_since(*last_time).as_millis() as u64;
            let mut metrics = self.metrics.write().await;
            metrics.add_stage_duration(duration);
        }

        StageTransitionResult {
            previous_stage: previous,
            new_stage: stage,
            transition_time_ms: 0,
            successful: true,
        }
    }

    pub async fn get_current_stage(&self) -> WorkflowStage {
        *self.current_stage.read().await
    }

    pub async fn get_history(&self) -> Vec<WorkflowStage> {
        self.stage_history.read().await.clone()
    }

    pub async fn get_metrics(&self) -> WorkflowMetrics {
        self.metrics.read().await.clone()
    }

    pub async fn reset(&self) {
        let mut current = self.current_stage.write().await;
        *current = WorkflowStage::Idle;

        let mut history = self.stage_history.write().await;
        history.clear();

        let mut timestamps = self.stage_timestamps.write().await;
        timestamps.clear();

        let mut metrics = self.metrics.write().await;
        *metrics = WorkflowMetrics::new();
    }

    pub async fn is_complete(&self) -> bool {
        *self.current_stage.read().await == WorkflowStage::Completed
    }
}

impl Default for StaggeredWorkflow {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug)]
pub struct StageTransitionResult {
    pub previous_stage: WorkflowStage,
    pub new_stage: WorkflowStage,
    pub transition_time_ms: u64,
    pub successful: bool,
}

#[allow(dead_code)]
pub struct ParallelPipeline {
    workflow: StaggeredWorkflow,
    local_task_handle: Arc<RwLock<Option<TaskHandle>>>,
    review_task_handle: Arc<RwLock<Option<TaskHandle>>>,
    max_parallel_stages: usize,
}

#[allow(dead_code)]
struct TaskHandle {
    started_at: Instant,
    completed: bool,
}

impl ParallelPipeline {
    pub fn new() -> Self {
        Self {
            workflow: StaggeredWorkflow::new(),
            local_task_handle: Arc::new(RwLock::new(None)),
            review_task_handle: Arc::new(RwLock::new(None)),
            max_parallel_stages: 2,
        }
    }

    pub async fn execute_staggered<F1, F2, Fut1, Fut2>(
        &self,
        local_generator: F1,
        cloud_reviewer: F2,
    ) -> PipelineResult
    where
        F1: FnOnce() -> Fut1,
        F2: FnOnce(String) -> Fut2,
        Fut1: std::future::Future<Output = String>,
        Fut2: std::future::Future<Output = String>,
    {
        let start_time = Instant::now();

        self.workflow
            .transition_to(WorkflowStage::LocalGeneration)
            .await;

        let local_handle = TaskHandle {
            started_at: Instant::now(),
            completed: false,
        };
        {
            let mut handle = self.local_task_handle.write().await;
            *handle = Some(local_handle);
        }

        let local_result = local_generator().await;

        {
            let mut handle = self.local_task_handle.write().await;
            if let Some(ref mut h) = *handle {
                h.completed = true;
            }
        }

        self.workflow
            .transition_to(WorkflowStage::LocalComplete)
            .await;
        self.workflow
            .transition_to(WorkflowStage::CloudReview)
            .await;

        let review_handle = TaskHandle {
            started_at: Instant::now(),
            completed: false,
        };
        {
            let mut handle = self.review_task_handle.write().await;
            *handle = Some(review_handle);
        }

        let cloud_result = cloud_reviewer(local_result.clone()).await;

        {
            let mut handle = self.review_task_handle.write().await;
            if let Some(ref mut h) = *handle {
                h.completed = true;
            }
        }

        self.workflow
            .transition_to(WorkflowStage::QualityCheck)
            .await;
        self.workflow.transition_to(WorkflowStage::Finalize).await;

        let final_response = if cloud_result.len() > local_result.len() {
            cloud_result.clone()
        } else {
            local_result.clone()
        };

        self.workflow.transition_to(WorkflowStage::Completed).await;

        let total_duration = start_time.elapsed().as_millis() as u64;
        let mut metrics = self.workflow.get_metrics().await;
        metrics.finalize(total_duration);
        metrics.tokens_processed = (local_result.len() + cloud_result.len()) as u32;

        PipelineResult {
            response: final_response,
            local_response: local_result,
            cloud_response: cloud_result,
            workflow_history: self.workflow.get_history().await,
            metrics,
            total_time_ms: total_duration,
        }
    }

    pub async fn get_workflow(&self) -> &StaggeredWorkflow {
        &self.workflow
    }
}

impl Default for ParallelPipeline {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug)]
pub struct PipelineResult {
    pub response: String,
    pub local_response: String,
    pub cloud_response: String,
    pub workflow_history: Vec<WorkflowStage>,
    pub metrics: WorkflowMetrics,
    pub total_time_ms: u64,
}

pub struct FeasibilityReport {
    pub is_feasible: bool,
    pub technical_score: f32,
    pub resource_score: f32,
    pub risk_score: f32,
    pub estimated_latency_ms: u64,
    pub estimated_token_overhead: u32,
    pub recommendations: Vec<String>,
    pub blockers: Vec<String>,
}

impl FeasibilityReport {
    pub fn new() -> Self {
        Self {
            is_feasible: true,
            technical_score: 0.0,
            resource_score: 0.0,
            risk_score: 0.0,
            estimated_latency_ms: 0,
            estimated_token_overhead: 0,
            recommendations: Vec::new(),
            blockers: Vec::new(),
        }
    }

    pub fn with_assessment(
        &mut self,
        technical: f32,
        resource: f32,
        risk: f32,
        latency: u64,
        overhead: u32,
    ) {
        self.technical_score = technical;
        self.resource_score = resource;
        self.risk_score = risk;
        self.estimated_latency_ms = latency;
        self.estimated_token_overhead = overhead;

        let overall_score = (technical + resource) / 2.0 - risk;
        self.is_feasible = overall_score >= 50.0 && risk < 50.0;
    }

    pub fn add_recommendation(&mut self, rec: &str) {
        self.recommendations.push(rec.to_string());
    }

    pub fn add_blocker(&mut self, blocker: &str) {
        self.blockers.push(blocker.to_string());
        self.is_feasible = false;
    }
}

impl Default for FeasibilityReport {
    fn default() -> Self {
        Self::new()
    }
}

pub struct ArchitectureAnalyzer;

impl ArchitectureAnalyzer {
    pub fn analyze_staggered_workflow(
        local_model_latency_ms: u64,
        cloud_model_latency_ms: u64,
        network_overhead_ms: u64,
    ) -> FeasibilityReport {
        let mut report = FeasibilityReport::new();

        let technical_score = if local_model_latency_ms < cloud_model_latency_ms {
            85.0
        } else {
            65.0
        };

        let resource_score = 75.0;

        let risk_score = if network_overhead_ms > 100 {
            40.0
        } else if network_overhead_ms > 50 {
            20.0
        } else {
            10.0
        };

        let total_latency = local_model_latency_ms + network_overhead_ms + cloud_model_latency_ms;
        let estimated_overhead = (network_overhead_ms as f32 * 0.1) as u32;

        report.with_assessment(
            technical_score,
            resource_score,
            risk_score,
            total_latency,
            estimated_overhead,
        );
        report.add_recommendation("Use local model for simple queries to reduce latency");
        report.add_recommendation("Implement caching for repeated queries");

        if network_overhead_ms > 200 {
            report.add_blocker("Network latency too high for real-time collaboration");
        }

        report
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_workflow_stage_transitions() {
        let workflow = StaggeredWorkflow::new();

        assert_eq!(workflow.get_current_stage().await, WorkflowStage::Idle);

        workflow.transition_to(WorkflowStage::LocalGeneration).await;
        assert_eq!(
            workflow.get_current_stage().await,
            WorkflowStage::LocalGeneration
        );

        workflow.transition_to(WorkflowStage::CloudReview).await;
        assert_eq!(
            workflow.get_current_stage().await,
            WorkflowStage::CloudReview
        );
    }

    #[tokio::test]
    async fn test_workflow_reset() {
        let workflow = StaggeredWorkflow::new();

        workflow.transition_to(WorkflowStage::LocalGeneration).await;
        workflow.transition_to(WorkflowStage::LocalComplete).await;

        workflow.reset().await;

        assert_eq!(workflow.get_current_stage().await, WorkflowStage::Idle);
        assert!(workflow.get_history().await.is_empty());
    }

    #[tokio::test]
    async fn test_pipeline_execution() {
        let pipeline = ParallelPipeline::new();

        let result = pipeline
            .execute_staggered(
                || async { "local response".to_string() },
                |input| async move { format!("reviewed: {}", input) },
            )
            .await;

        assert_eq!(result.local_response, "local response");
        assert_eq!(result.cloud_response, "reviewed: local response");
        assert!(result.workflow_history.len() >= 5);
    }

    #[test]
    fn test_feasibility_report_generation() {
        let report = ArchitectureAnalyzer::analyze_staggered_workflow(100, 200, 30);

        assert!(report.is_feasible);
        assert!(report.technical_score > 0.0);
        assert!(!report.recommendations.is_empty());
    }

    #[tokio::test]
    async fn test_parallel_pipeline_metrics() {
        let pipeline = ParallelPipeline::new();

        let result = pipeline
            .execute_staggered(
                || async { "local".to_string() },
                |_| async { "cloud".to_string() },
            )
            .await;

        assert!(result.metrics.tokens_processed > 0);
    }
}
