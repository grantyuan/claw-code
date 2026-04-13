use std::collections::VecDeque;
use std::sync::Arc;
use std::time::{Duration, Instant};

use tokio::sync::RwLock;

#[derive(Debug, Clone)]
pub struct PredictiveConfig {
    pub enabled: bool,
    pub prediction_window_ms: u32,
    pub confidence_threshold: f32,
    pub cache_ttl_secs: u32,
    pub max_cache_entries: usize,
    pub enable_batch_optimization: bool,
    pub batch_size: usize,
    pub batch_timeout_ms: u32,
}

impl Default for PredictiveConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            prediction_window_ms: 500,
            confidence_threshold: 0.75,
            cache_ttl_secs: 300,
            max_cache_entries: 1000,
            enable_batch_optimization: true,
            batch_size: 10,
            batch_timeout_ms: 100,
        }
    }
}

#[derive(Debug, Clone)]
pub struct Prediction {
    pub predicted_model: ModelChoice,
    pub confidence: f32,
    pub estimated_tokens: u32,
    pub estimated_latency_ms: u32,
    pub features: Vec<f32>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ModelChoice {
    Local,
    Cloud,
    Dual,
    Deferred,
}

impl ModelChoice {
    pub fn is_local(&self) -> bool {
        matches!(self, ModelChoice::Local)
    }

    pub fn is_cloud(&self) -> bool {
        matches!(self, ModelChoice::Cloud)
    }
}

#[derive(Debug, Clone)]
pub struct RequestSignature {
    pub content_hash: u64,
    pub length: usize,
    pub keywords: Vec<String>,
    pub urgency: u8,
}

impl RequestSignature {
    pub fn from_content(content: &str, urgency: u8) -> Self {
        let content_hash = Self::hash_content(content);
        let keywords = Self::extract_keywords(content);
        Self {
            content_hash,
            length: content.len(),
            keywords,
            urgency,
        }
    }

    fn hash_content(content: &str) -> u64 {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        let mut hasher = DefaultHasher::new();
        content.hash(&mut hasher);
        hasher.finish()
    }

    fn extract_keywords(content: &str) -> Vec<String> {
        let keywords = [
            "search", "analyze", "explain", "code", "debug", "refactor", "test", "deploy",
        ];
        content
            .split_whitespace()
            .filter(|w| keywords.iter().any(|k| w.to_lowercase().contains(k)))
            .map(|s| s.to_lowercase())
            .take(5)
            .collect()
    }
}

pub struct PredictiveCache {
    entries: Arc<RwLock<VecDeque<CacheEntry>>>,
    config: PredictiveConfig,
    hits: Arc<RwLock<u64>>,
    misses: Arc<RwLock<u64>>,
}

#[derive(Debug, Clone)]
struct CacheEntry {
    signature: RequestSignature,
    response: String,
    model_used: ModelChoice,
    timestamp: Instant,
    tokens_used: u32,
}

impl PredictiveCache {
    pub fn new(config: PredictiveConfig) -> Self {
        Self {
            entries: Arc::new(RwLock::new(VecDeque::new())),
            config,
            hits: Arc::new(RwLock::new(0)),
            misses: Arc::new(RwLock::new(0)),
        }
    }

    pub async fn get(&self, signature: &RequestSignature) -> Option<(String, ModelChoice, u32)> {
        let entries = self.entries.read().await;
        let now = Instant::now();

        for entry in entries.iter() {
            if entry.signature.content_hash == signature.content_hash {
                let age = now.duration_since(entry.timestamp);
                if age < Duration::from_secs(self.config.cache_ttl_secs as u64) {
                    let mut hits = self.hits.write().await;
                    *hits += 1;
                    return Some((entry.response.clone(), entry.model_used, entry.tokens_used));
                }
            }
        }

        let mut misses = self.misses.write().await;
        *misses += 1;
        None
    }

    pub async fn insert(
        &self,
        signature: RequestSignature,
        response: String,
        model: ModelChoice,
        tokens: u32,
    ) {
        let mut entries = self.entries.write().await;

        if entries.len() >= self.config.max_cache_entries {
            entries.pop_front();
        }

        entries.push_back(CacheEntry {
            signature,
            response,
            model_used: model,
            timestamp: Instant::now(),
            tokens_used: tokens,
        });
    }

    pub async fn hit_rate(&self) -> f32 {
        let hits = *self.hits.read().await as f32;
        let misses = *self.misses.read().await as f32;
        let total = hits + misses;
        if total > 0.0 {
            hits / total
        } else {
            0.0
        }
    }
}

pub struct PredictiveModelSelector {
    config: PredictiveConfig,
    historical_data: Arc<RwLock<Vec<HistoricalSample>>>,
    current_weights: Arc<RwLock<FeatureWeights>>,
}

#[derive(Debug, Clone)]
pub struct HistoricalSample {
    pub features: Vec<f32>,
    pub actual_model: ModelChoice,
    pub latency_ms: u32,
    pub quality_score: u8,
    pub tokens_used: u32,
}

#[derive(Debug, Clone)]
pub struct FeatureWeights {
    pub length_weight: f32,
    pub keyword_weight: f32,
    pub urgency_weight: f32,
    pub historical_weight: f32,
    pub complexity_weight: f32,
}

impl Default for FeatureWeights {
    fn default() -> Self {
        Self {
            length_weight: 0.15,
            keyword_weight: 0.25,
            urgency_weight: 0.20,
            historical_weight: 0.25,
            complexity_weight: 0.15,
        }
    }
}

impl PredictiveModelSelector {
    pub fn new(config: PredictiveConfig) -> Self {
        Self {
            config,
            historical_data: Arc::new(RwLock::new(Vec::new())),
            current_weights: Arc::new(RwLock::new(FeatureWeights::default())),
        }
    }

    pub async fn predict(&self, content: &str, urgency: u8) -> Prediction {
        let features = self.extract_features(content, urgency);
        let weights = self.current_weights.read().await.clone();

        let score = self.calculate_score(&features, &weights);

        let predicted_model = self.score_to_model(score);
        let confidence = (score - 0.5).abs().min(1.0);

        let estimated_tokens = self.estimate_tokens(content);
        let estimated_latency = self.estimate_latency(predicted_model, estimated_tokens);

        Prediction {
            predicted_model,
            confidence,
            estimated_tokens,
            estimated_latency_ms: estimated_latency,
            features,
        }
    }

    fn extract_features(&self, content: &str, urgency: u8) -> Vec<f32> {
        let length_score = (content.len() as f32 / 1000.0).min(1.0);
        let keyword_score = Self::keyword_complexity_score(content);
        let urgency_score = urgency as f32 / 10.0;
        let complexity_score = Self::estimate_complexity(content);

        vec![length_score, keyword_score, urgency_score, complexity_score]
    }

    fn keyword_complexity_score(content: &str) -> f32 {
        let complex_keywords = [
            "analyze",
            "compare",
            "evaluate",
            "design",
            "architect",
            "optimize",
            "refactor",
            "implement",
            "debug",
            "performance",
        ];
        let simple_keywords = ["hi", "hello", "help", "what", "how", "?"];

        let content_lower = content.to_lowercase();
        let complex_count = complex_keywords
            .iter()
            .filter(|k| content_lower.contains(*k))
            .count() as f32;
        let simple_count = simple_keywords
            .iter()
            .filter(|k| content_lower.contains(*k))
            .count() as f32;

        (complex_count - simple_count).max(0.0).min(1.0)
    }

    fn estimate_complexity(content: &str) -> f32 {
        let has_code =
            content.contains("```") || content.contains("function") || content.contains("class");
        let has_numbers = content.chars().any(|c| c.is_numeric());
        let has_technical =
            content.contains("API") || content.contains("database") || content.contains("server");

        let mut score: f32 = 0.0;
        if has_code {
            score += 0.3;
        }
        if has_numbers {
            score += 0.2;
        }
        if has_technical {
            score += 0.3;
        }
        if content.len() > 500 {
            score += 0.2;
        }

        score.min(1.0_f32)
    }

    fn calculate_score(&self, features: &[f32], weights: &FeatureWeights) -> f32 {
        features[0] * weights.length_weight
            + features[1] * weights.keyword_weight
            + features[2] * weights.urgency_weight
            + features[3] * weights.complexity_weight
    }

    fn score_to_model(&self, score: f32) -> ModelChoice {
        if score < 0.3 {
            ModelChoice::Local
        } else if score < 0.6 {
            ModelChoice::Dual
        } else if score < 0.8 {
            ModelChoice::Cloud
        } else {
            ModelChoice::Deferred
        }
    }

    fn estimate_tokens(&self, content: &str) -> u32 {
        (content.len() as f32 * 1.3) as u32
    }

    fn estimate_latency(&self, model: ModelChoice, tokens: u32) -> u32 {
        match model {
            ModelChoice::Local => (tokens as f32 * 0.5) as u32 + 100,
            ModelChoice::Cloud => (tokens as f32 * 1.2) as u32 + 300,
            ModelChoice::Dual => (tokens as f32 * 1.5) as u32 + 400,
            ModelChoice::Deferred => 0,
        }
    }

    pub async fn record_outcome(
        &self,
        prediction: &Prediction,
        actual_model: ModelChoice,
        actual_latency: u32,
        quality: u8,
        tokens: u32,
    ) {
        let sample = HistoricalSample {
            features: prediction.features.clone(),
            actual_model,
            latency_ms: actual_latency,
            quality_score: quality,
            tokens_used: tokens,
        };

        let mut data = self.historical_data.write().await;
        data.push(sample);

        if data.len() > 1000 {
            data.remove(0);
        }

        if data.len() >= 10 {
            self.retrain_weights(&data).await;
        }
    }

    async fn retrain_weights(&self, data: &[HistoricalSample]) {
        let mut weights = self.current_weights.write().await;

        let mut local_correct = 0u32;
        let mut cloud_correct = 0u32;
        let mut dual_correct = 0u32;

        for sample in data.iter().rev().take(10) {
            let score = self.calculate_score(&sample.features, &weights);
            let predicted = self.score_to_model(score);

            if predicted == sample.actual_model {
                match sample.actual_model {
                    ModelChoice::Local => local_correct += 1,
                    ModelChoice::Cloud => cloud_correct += 1,
                    ModelChoice::Dual => dual_correct += 1,
                    ModelChoice::Deferred => {}
                }
            }
        }

        let total = data.len() as f32;
        weights.historical_weight =
            ((local_correct + cloud_correct + dual_correct) as f32 / total).max(0.1);
        weights.keyword_weight = (cloud_correct as f32 / total.max(1.0) * 1.5).min(0.5);
    }
}

pub struct BatchOptimizer {
    config: PredictiveConfig,
    pending_requests: Arc<RwLock<Vec<PendingRequest>>>,
    processed_count: Arc<RwLock<u64>>,
}

#[derive(Debug, Clone)]
struct PendingRequest {
    content: String,
    urgency: u8,
    signature: RequestSignature,
    added_at: Instant,
}

impl BatchOptimizer {
    pub fn new(config: PredictiveConfig) -> Self {
        Self {
            config,
            pending_requests: Arc::new(RwLock::new(Vec::new())),
            processed_count: Arc::new(RwLock::new(0)),
        }
    }

    pub async fn add_request(&self, content: String, urgency: u8) {
        let signature = RequestSignature::from_content(&content, urgency);
        let mut pending = self.pending_requests.write().await;
        pending.push(PendingRequest {
            content,
            urgency,
            signature,
            added_at: Instant::now(),
        });
    }

    pub async fn should_process_batch(&self) -> Option<Vec<(String, u8)>> {
        let mut pending = self.pending_requests.write().await;
        let now = Instant::now();

        if pending.len() >= self.config.batch_size {
            let batch: Vec<(String, u8)> = pending
                .drain(..self.config.batch_size)
                .map(|r| (r.content, r.urgency))
                .collect();

            let mut count = self.processed_count.write().await;
            *count += batch.len() as u64;

            return Some(batch);
        }

        if let Some(oldest) = pending.first() {
            let age = now.duration_since(oldest.added_at);
            if age > Duration::from_millis(self.config.batch_timeout_ms as u64)
                && !pending.is_empty()
            {
                let batch: Vec<(String, u8)> =
                    pending.drain(..).map(|r| (r.content, r.urgency)).collect();

                let mut count = self.processed_count.write().await;
                *count += batch.len() as u64;

                return Some(batch);
            }
        }

        None
    }

    pub async fn processed_count(&self) -> u64 {
        *self.processed_count.read().await
    }

    pub async fn pending_count(&self) -> usize {
        self.pending_requests.read().await.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_predictive_cache_basic() {
        let config = PredictiveConfig::default();
        let cache = PredictiveCache::new(config);

        let sig = RequestSignature::from_content("test content", 5);

        cache.insert(
            sig.clone(),
            "cached response".to_string(),
            ModelChoice::Local,
            100,
        );

        let rate = cache.hit_rate().await;
        assert!(rate >= 0.0);
    }

    #[tokio::test]
    async fn test_predictive_model_selector() {
        let config = PredictiveConfig::default();
        let selector = PredictiveModelSelector::new(config);

        let prediction = selector.predict("analyze this code", 7).await;

        assert!(prediction.confidence >= 0.0);
        assert!(prediction.estimated_tokens > 0);
    }

    #[tokio::test]
    async fn test_batch_optimizer_size_trigger() {
        let config = PredictiveConfig {
            batch_size: 3,
            ..Default::default()
        };
        let optimizer = BatchOptimizer::new(config);

        optimizer.add_request("req1".to_string(), 5).await;
        optimizer.add_request("req2".to_string(), 5).await;

        assert!(optimizer.should_process_batch().await.is_none());

        optimizer.add_request("req3".to_string(), 5).await;

        let batch = optimizer.should_process_batch().await;
        assert!(batch.is_some());
        assert_eq!(batch.unwrap().len(), 3);
    }

    #[test]
    fn test_request_signature_hash() {
        let sig1 = RequestSignature::from_content("hello world", 5);
        let sig2 = RequestSignature::from_content("hello world", 5);
        let sig3 = RequestSignature::from_content("different", 5);

        assert_eq!(sig1.content_hash, sig2.content_hash);
        assert_ne!(sig1.content_hash, sig3.content_hash);
    }

    #[tokio::test]
    async fn test_cache_hit_rate() {
        let config = PredictiveConfig::default();
        let cache = PredictiveCache::new(config);

        let sig = RequestSignature::from_content("test", 5);
        cache.insert(sig.clone(), "response".to_string(), ModelChoice::Local, 50);

        let rate = cache.hit_rate().await;
        assert!(rate >= 0.0);
    }
}
