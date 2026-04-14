use std::sync::Arc;
use std::time::Duration;

use tokio::sync::RwLock;

#[derive(Debug, Clone)]
pub struct PerformanceModeConfig {
    pub enabled: bool,
    pub dual_model_enabled: bool,
    pub quality_threshold: u8,
    pub local_model_timeout_ms: u32,
}

impl Default for PerformanceModeConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            dual_model_enabled: false,
            quality_threshold: 70,
            local_model_timeout_ms: 5000,
        }
    }
}

#[derive(Debug, Clone)]
pub struct QualityScore {
    pub score: u8,
    pub suggestions: Vec<String>,
    pub accuracy_issues: Vec<String>,
    pub completeness_issues: Vec<String>,
}

impl QualityScore {
    pub fn is_acceptable(&self, threshold: u8) -> bool {
        self.score >= threshold
    }

    pub fn new(score: u8) -> Self {
        Self {
            score,
            suggestions: Vec::new(),
            accuracy_issues: Vec::new(),
            completeness_issues: Vec::new(),
        }
    }

    pub fn with_suggestions(mut self, suggestions: Vec<String>) -> Self {
        self.suggestions = suggestions;
        self
    }
}

#[derive(Debug, Clone)]
pub struct DualModelResponse {
    pub local_response: String,
    pub quality_score: Option<QualityScore>,
    pub cloud_review: Option<String>,
    pub processing_time_ms: u64,
}

pub trait QualityScorer: Send + Sync {
    fn score(&self, local_response: &str, original_request: &str) -> QualityScore;
}

#[allow(dead_code)]
pub struct CloudModelScorer {
    cloud_client: Arc<dyn crate::ollama_client::OllamaClientInterface>,
}

impl CloudModelScorer {
    pub fn new() -> Self {
        Self {
            cloud_client: Arc::new(crate::ollama_client::OllamaClient::new("dummy")),
        }
    }
}

impl QualityScorer for CloudModelScorer {
    fn score(&self, local_response: &str, original_request: &str) -> QualityScore {
        let base_score = 75u8;

        let mut accuracy_issues = Vec::new();
        let mut suggestions = Vec::new();

        if local_response.len() < 50 {
            accuracy_issues.push("Response too short".to_string());
        }

        if local_response.len() > original_request.len() * 10 {
            suggestions.push("Response may be verbose".to_string());
        }

        let final_score = if accuracy_issues.is_empty() {
            base_score
        } else {
            base_score.saturating_sub(10)
        };

        QualityScore {
            score: final_score,
            suggestions,
            accuracy_issues,
            completeness_issues: Vec::new(),
        }
    }
}

#[allow(dead_code)]
pub struct DualModelProcessor {
    config: PerformanceModeConfig,
    local_client: Arc<dyn crate::ollama_client::OllamaClientInterface>,
    scorer: Box<dyn QualityScorer>,
}

impl DualModelProcessor {
    pub fn new(
        config: PerformanceModeConfig,
        local_client: Arc<dyn crate::ollama_client::OllamaClientInterface>,
        scorer: Box<dyn QualityScorer>,
    ) -> Self {
        Self {
            config,
            local_client,
            scorer,
        }
    }

    pub fn local_timeout(&self) -> Duration {
        Duration::from_millis(self.config.local_model_timeout_ms as u64)
    }

    pub fn quality_threshold(&self) -> u8 {
        self.config.quality_threshold
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum WorkflowStep {
    LocalGenerated,
    CloudReview,
    QualityPassed,
    QualityFailed,
    RetryLocal,
    Completed,
}

pub struct InterleavedWorkflow {
    current_step: Arc<RwLock<WorkflowStep>>,
    steps_history: Arc<RwLock<Vec<WorkflowStep>>>,
}

impl InterleavedWorkflow {
    pub fn new() -> Self {
        Self {
            current_step: Arc::new(RwLock::new(WorkflowStep::LocalGenerated)),
            steps_history: Arc::new(RwLock::new(Vec::new())),
        }
    }

    pub async fn advance(&self, step: WorkflowStep) {
        let mut current = self.current_step.write().await;
        *current = step;

        let mut history = self.steps_history.write().await;
        history.push(step);
    }

    pub async fn get_current_step(&self) -> WorkflowStep {
        *self.current_step.read().await
    }

    pub async fn get_history(&self) -> Vec<WorkflowStep> {
        self.steps_history.read().await.clone()
    }

    pub async fn reset(&self) {
        let mut current = self.current_step.write().await;
        *current = WorkflowStep::LocalGenerated;

        let mut history = self.steps_history.write().await;
        history.clear();
    }
}

impl Default for InterleavedWorkflow {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_quality_score_acceptance() {
        let score = QualityScore::new(85);
        assert!(score.is_acceptable(70));
        assert!(!score.is_acceptable(90));
    }

    #[tokio::test]
    async fn test_workflow_state_transitions() {
        let workflow = InterleavedWorkflow::new();

        assert_eq!(
            workflow.get_current_step().await,
            WorkflowStep::LocalGenerated
        );

        workflow.advance(WorkflowStep::CloudReview).await;
        assert_eq!(workflow.get_current_step().await, WorkflowStep::CloudReview);

        workflow.advance(WorkflowStep::QualityPassed).await;
        assert_eq!(
            workflow.get_current_step().await,
            WorkflowStep::QualityPassed
        );

        workflow.advance(WorkflowStep::Completed).await;
        assert_eq!(workflow.get_current_step().await, WorkflowStep::Completed);

        let history = workflow.get_history().await;
        assert_eq!(history.len(), 3);
    }
}
