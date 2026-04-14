use std::sync::Arc;
use std::time::Instant;

use crate::ollama_client::OllamaClientInterface;

#[derive(Debug, Clone)]
pub struct DualModelConfig {
    pub enabled: bool,
    pub local_timeout_ms: u32,
    pub quality_threshold: u8,
    pub enable_parallel_review: bool,
    pub auto_retry_on_low_quality: bool,
    pub max_retries: u8,
}

impl Default for DualModelConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            local_timeout_ms: 5000,
            quality_threshold: 70,
            enable_parallel_review: false,
            auto_retry_on_low_quality: true,
            max_retries: 2,
        }
    }
}

#[derive(Debug, Clone)]
pub struct DualModelRequest {
    pub user_input: String,
    pub context: Option<String>,
    pub system_prompt: Option<String>,
    pub prefer_local: bool,
}

#[derive(Debug, Clone)]
pub struct DualModelResponse {
    pub final_response: String,
    pub local_response: Option<String>,
    pub quality_score: u8,
    pub improvement_suggestions: Vec<String>,
    pub model_used: ModelSource,
    pub processing_time_ms: u64,
    pub tokens_saved_percent: f32,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ModelSource {
    LocalOnly,
    CloudOnly,
    DualModelPipeline,
}

impl DualModelResponse {
    pub fn from_local_only(
        response: String,
        time_ms: u64,
        tokens: u32,
        baseline_tokens: u32,
    ) -> Self {
        Self {
            final_response: response.clone(),
            local_response: Some(response),
            quality_score: 50,
            improvement_suggestions: Vec::new(),
            model_used: ModelSource::LocalOnly,
            processing_time_ms: time_ms,
            tokens_saved_percent: if baseline_tokens > 0 {
                ((baseline_tokens - tokens) as f32 / baseline_tokens as f32) * 100.0
            } else {
                0.0
            },
        }
    }

    pub fn with_quality_score(mut self, score: u8) -> Self {
        self.quality_score = score;
        self
    }

    pub fn with_suggestions(mut self, suggestions: Vec<String>) -> Self {
        self.improvement_suggestions = suggestions;
        self
    }

    pub fn is_acceptable(&self, threshold: u8) -> bool {
        self.quality_score >= threshold
    }
}

#[allow(dead_code)]
pub struct DualModelProcessor {
    config: DualModelConfig,
    local_client: Arc<dyn OllamaClientInterface>,
    cloud_client: Arc<dyn OllamaClientInterface>,
    metrics: Arc<DualModelMetrics>,
}

#[derive(Debug, Default, Clone)]
pub struct DualModelMetrics {
    pub total_requests: u64,
    pub local_only_count: u64,
    pub cloud_only_count: u64,
    pub dual_pipeline_count: u64,
    pub average_quality_score: f32,
    pub average_tokens_saved: f32,
    pub average_latency_ms: f32,
}

impl DualModelProcessor {
    pub fn new(
        config: DualModelConfig,
        local_client: Arc<dyn OllamaClientInterface>,
        cloud_client: Arc<dyn OllamaClientInterface>,
    ) -> Self {
        Self {
            config,
            local_client,
            cloud_client,
            metrics: Arc::new(DualModelMetrics::default()),
        }
    }

    pub async fn process(&self, request: DualModelRequest) -> DualModelResponse {
        let start_time = Instant::now();

        if request.prefer_local {
            return self.process_local_only(request, start_time).await;
        }

        let local_result = self.generate_local_response(&request).await;

        match local_result {
            Ok(local_response) => {
                let quality_check = self
                    .evaluate_quality(&local_response, &request.user_input)
                    .await;

                if quality_check.score >= self.config.quality_threshold {
                    let elapsed = start_time.elapsed().as_millis() as u64;
                    let tokens_saved = self.calculate_tokens_saved(&local_response);
                    return DualModelResponse::from_local_only(
                        local_response,
                        elapsed,
                        tokens_saved,
                        1000,
                    )
                    .with_quality_score(quality_check.score);
                }

                if self.config.auto_retry_on_low_quality
                    && quality_check.score < self.config.quality_threshold / 2
                {
                    let cloud_result = self.generate_cloud_response(&request).await;
                    if let Ok(cloud_response) = cloud_result {
                        let elapsed = start_time.elapsed().as_millis() as u64;
                        return self
                            .create_dual_model_response(
                                local_response,
                                cloud_response,
                                quality_check,
                                elapsed,
                            )
                            .await;
                    }
                }

                let elapsed = start_time.elapsed().as_millis() as u64;
                DualModelResponse::from_local_only(local_response, elapsed, 800, 1000)
                    .with_quality_score(quality_check.score)
                    .with_suggestions(quality_check.suggestions)
            }
            Err(_) => {
                let cloud_result = self.generate_cloud_response(&request).await;
                match cloud_result {
                    Ok(cloud_response) => {
                        let elapsed = start_time.elapsed().as_millis() as u64;
                        DualModelResponse {
                            final_response: cloud_response,
                            local_response: None,
                            quality_score: 80,
                            improvement_suggestions: Vec::new(),
                            model_used: ModelSource::CloudOnly,
                            processing_time_ms: elapsed,
                            tokens_saved_percent: 0.0,
                        }
                    }
                    Err(_) => DualModelResponse {
                        final_response: "Sorry, both models failed to respond.".to_string(),
                        local_response: None,
                        quality_score: 0,
                        improvement_suggestions: vec!["System error - please retry".to_string()],
                        model_used: ModelSource::CloudOnly,
                        processing_time_ms: start_time.elapsed().as_millis() as u64,
                        tokens_saved_percent: 0.0,
                    },
                }
            }
        }
    }

    async fn process_local_only(
        &self,
        request: DualModelRequest,
        start: Instant,
    ) -> DualModelResponse {
        match self.generate_local_response(&request).await {
            Ok(response) => {
                let elapsed = start.elapsed().as_millis() as u64;
                let tokens = self.calculate_tokens_saved(&response);
                DualModelResponse::from_local_only(response, elapsed, tokens, 1000)
            }
            Err(_) => {
                let cloud_result = self.generate_cloud_response(&request).await;
                match cloud_result {
                    Ok(response) => {
                        let elapsed = start.elapsed().as_millis() as u64;
                        DualModelResponse {
                            final_response: response,
                            local_response: None,
                            quality_score: 75,
                            improvement_suggestions: Vec::new(),
                            model_used: ModelSource::CloudOnly,
                            processing_time_ms: elapsed,
                            tokens_saved_percent: 0.0,
                        }
                    }
                    Err(_) => DualModelResponse {
                        final_response: "All models failed".to_string(),
                        local_response: None,
                        quality_score: 0,
                        improvement_suggestions: vec!["Service unavailable".to_string()],
                        model_used: ModelSource::CloudOnly,
                        processing_time_ms: start.elapsed().as_millis() as u64,
                        tokens_saved_percent: 0.0,
                    },
                }
            }
        }
    }

    async fn generate_local_response(&self, request: &DualModelRequest) -> Result<String, ()> {
        Ok(format!("Local response to: {}", request.user_input))
    }

    async fn generate_cloud_response(&self, request: &DualModelRequest) -> Result<String, ()> {
        Ok(format!("Cloud response to: {}", request.user_input))
    }

    async fn evaluate_quality(&self, response: &str, _original: &str) -> QualityEvaluation {
        let score = if response.len() < 20 {
            30
        } else if response.len() < 100 {
            50
        } else if response.len() < 500 {
            70
        } else {
            85
        };

        let mut suggestions = Vec::new();
        if response.len() < 50 {
            suggestions.push("Response is too brief. Consider adding more detail.".to_string());
        }
        if !response.contains('.') {
            suggestions.push("Add proper punctuation for better readability.".to_string());
        }

        QualityEvaluation {
            score,
            suggestions,
            accuracy_issues: Vec::new(),
        }
    }

    async fn create_dual_model_response(
        &self,
        local_response: String,
        cloud_response: String,
        quality: QualityEvaluation,
        elapsed_ms: u64,
    ) -> DualModelResponse {
        DualModelResponse {
            final_response: cloud_response,
            local_response: Some(local_response),
            quality_score: quality.score,
            improvement_suggestions: quality.suggestions,
            model_used: ModelSource::DualModelPipeline,
            processing_time_ms: elapsed_ms,
            tokens_saved_percent: 15.0,
        }
    }

    fn calculate_tokens_saved(&self, response: &str) -> u32 {
        (response.len() as f32 * 0.75) as u32
    }

    pub async fn get_metrics(&self) -> DualModelMetrics {
        self.metrics.as_ref().clone()
    }
}

#[derive(Debug, Clone)]
pub struct QualityEvaluation {
    pub score: u8,
    pub suggestions: Vec<String>,
    pub accuracy_issues: Vec<String>,
}

#[allow(dead_code)]
pub struct QualityReviewer {
    cloud_client: Arc<dyn OllamaClientInterface>,
    scoring_model: ScorerType,
}

#[derive(Debug, Clone, Copy)]
pub enum ScorerType {
    CloudModel,
    Heuristic,
}

impl QualityReviewer {
    pub fn new(cloud_client: Arc<dyn OllamaClientInterface>) -> Self {
        Self {
            cloud_client,
            scoring_model: ScorerType::Heuristic,
        }
    }

    pub fn with_scorer(mut self, scorer: ScorerType) -> Self {
        self.scoring_model = scorer;
        self
    }

    pub async fn review(
        &self,
        local_response: &str,
        original_request: &str,
    ) -> QualityReviewResult {
        match self.scoring_model {
            ScorerType::CloudModel => self.cloud_review(local_response, original_request).await,
            ScorerType::Heuristic => self.heuristic_review(local_response),
        }
    }

    async fn cloud_review(
        &self,
        local_response: &str,
        _original_request: &str,
    ) -> QualityReviewResult {
        let score = self.calculate_base_score(local_response);
        let suggestions = self.generate_suggestions(local_response, score);

        QualityReviewResult {
            score,
            suggestions,
            accuracy_issues: Vec::new(),
            completeness_issues: Vec::new(),
        }
    }

    fn heuristic_review(&self, response: &str) -> QualityReviewResult {
        let score = self.calculate_base_score(response);
        let suggestions = self.generate_suggestions(response, score);

        QualityReviewResult {
            score,
            suggestions,
            accuracy_issues: Vec::new(),
            completeness_issues: Vec::new(),
        }
    }

    fn calculate_base_score(&self, response: &str) -> u8 {
        let len_score = if response.len() < 50 {
            20
        } else if response.len() < 200 {
            50
        } else if response.len() < 500 {
            75
        } else {
            85
        };

        let structure_score = if response.contains('.') && response.contains(' ') {
            10
        } else {
            0
        };

        (len_score + structure_score).min(100) as u8
    }

    fn generate_suggestions(&self, response: &str, score: u8) -> Vec<String> {
        let mut suggestions = Vec::new();

        if score < 60 {
            suggestions.push("Consider providing more detailed explanations.".to_string());
        }
        if !response.contains('\n') && response.len() > 200 {
            suggestions.push("Add line breaks for better readability.".to_string());
        }
        if response.ends_with('.') {
            suggestions.push("Response ends properly with good structure.".to_string());
        }

        suggestions
    }
}

#[derive(Debug, Clone)]
pub struct QualityReviewResult {
    pub score: u8,
    pub suggestions: Vec<String>,
    pub accuracy_issues: Vec<String>,
    pub completeness_issues: Vec<String>,
}

impl QualityReviewResult {
    pub fn is_acceptable(&self, threshold: u8) -> bool {
        self.score >= threshold
    }

    pub fn improvement_count(&self) -> usize {
        self.suggestions.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_dual_model_response_quality() {
        let response =
            DualModelResponse::from_local_only("Test response".to_string(), 100, 500, 1000);

        assert!(response.is_acceptable(40));
        assert!(!response.is_acceptable(60));
    }

    #[test]
    fn test_quality_review_result_acceptance() {
        let result = QualityReviewResult {
            score: 75,
            suggestions: vec!["Add details".to_string()],
            accuracy_issues: Vec::new(),
            completeness_issues: Vec::new(),
        };

        assert!(result.is_acceptable(70));
        assert!(!result.is_acceptable(80));
    }
}
