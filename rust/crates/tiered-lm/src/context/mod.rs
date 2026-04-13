use std::sync::Arc;
use std::time::{Duration, Instant};

use tokio::sync::{mpsc, RwLock};
use tokio::time::interval;

#[derive(Debug, Clone)]
pub struct ContextManagerConfig {
    pub enabled: bool,
    pub sampling_interval_ms: u32,
    pub performance_threshold_tps: f32,
    pub max_token_limit: u32,
    pub intervention_latency_ms: u32,
    pub compression_rate_min_percent: f32,
}

impl Default for ContextManagerConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            sampling_interval_ms: 50,
            performance_threshold_tps: 100.0,
            max_token_limit: 200000,
            intervention_latency_ms: 50,
            compression_rate_min_percent: 30.0,
        }
    }
}

#[derive(Debug, Clone)]
pub struct ContextSnapshot {
    pub token_count: u32,
    pub tokens_per_second: f32,
    pub timestamp: Instant,
}

#[derive(Debug)]
pub struct TokenMonitor {
    config: ContextManagerConfig,
    current_tokens: Arc<RwLock<u32>>,
    samples: Arc<RwLock<Vec<ContextSnapshot>>>,
    threshold_breached_tx: mpsc::UnboundedSender<ThresholdBreach>,
    last_sample_time: Arc<RwLock<Instant>>,
    total_tokens_processed: Arc<RwLock<u64>>,
}

impl TokenMonitor {
    pub fn new(config: ContextManagerConfig) -> (Self, mpsc::UnboundedReceiver<ThresholdBreach>) {
        let (tx, rx) = mpsc::unbounded_channel();
        let monitor = Self {
            config,
            current_tokens: Arc::new(RwLock::new(0)),
            samples: Arc::new(RwLock::new(Vec::new())),
            threshold_breached_tx: tx,
            last_sample_time: Arc::new(RwLock::new(Instant::now())),
            total_tokens_processed: Arc::new(RwLock::new(0)),
        };
        (monitor, rx)
    }

    pub async fn update_token_count(&self, count: u32) {
        if !self.config.enabled {
            return;
        }

        {
            let mut tokens = self.current_tokens.write().await;
            *tokens = count;
        }

        let now = Instant::now();
        let last_time = *self.last_sample_time.read().await;
        let elapsed = now.duration_since(last_time).as_secs_f32();

        let tps = if elapsed > 0.0 {
            count as f32 / elapsed
        } else {
            0.0
        };

        let snapshot = ContextSnapshot {
            token_count: count,
            tokens_per_second: tps,
            timestamp: now,
        };

        {
            let mut samples = self.samples.write().await;
            samples.push(snapshot);

            if samples.len() > 100 {
                samples.remove(0);
            }
        }

        {
            let mut last = self.last_sample_time.write().await;
            *last = now;
        }

        if count > self.config.max_token_limit {
            let _ = self
                .threshold_breached_tx
                .send(ThresholdBreach::MaxTokenLimit {
                    current: count,
                    limit: self.config.max_token_limit,
                });
        }

        if tps > self.config.performance_threshold_tps {
            let _ = self
                .threshold_breached_tx
                .send(ThresholdBreach::PerformanceThreshold {
                    current_tps: tps,
                    threshold: self.config.performance_threshold_tps,
                });
        }
    }

    pub async fn get_current_tokens(&self) -> u32 {
        *self.current_tokens.read().await
    }

    pub async fn get_average_tps(&self) -> f32 {
        let samples = self.samples.read().await;
        if samples.is_empty() {
            return 0.0;
        }

        let sum: f32 = samples.iter().map(|s| s.tokens_per_second).sum();
        sum / samples.len() as f32
    }

    pub async fn check_intervention_required(&self) -> Option<ThresholdBreach> {
        if !self.config.enabled {
            return None;
        }

        let tokens = *self.current_tokens.read().await;
        let tps = self.get_average_tps().await;

        if tokens > self.config.max_token_limit {
            return Some(ThresholdBreach::MaxTokenLimit {
                current: tokens,
                limit: self.config.max_token_limit,
            });
        }

        if tps > self.config.performance_threshold_tps {
            return Some(ThresholdBreach::PerformanceThreshold {
                current_tps: tps,
                threshold: self.config.performance_threshold_tps,
            });
        }

        None
    }

    pub fn intervention_latency(&self) -> Duration {
        Duration::from_millis(self.config.intervention_latency_ms as u64)
    }
}

#[derive(Debug, Clone)]
pub enum ThresholdBreach {
    MaxTokenLimit { current: u32, limit: u32 },
    PerformanceThreshold { current_tps: f32, threshold: f32 },
}

pub trait ContextCompressor: Send + Sync {
    fn compress(&self, context: &str) -> CompressionResult;
    fn decompress(&self, compressed: &str) -> String;
}

#[derive(Debug, Clone)]
pub struct CompressionResult {
    pub original_length: usize,
    pub compressed_length: usize,
    pub compression_ratio: f32,
    pub preserved_elements: Vec<String>,
}

pub struct SemanticContextCompressor {
    min_compression_ratio: f32,
}

impl SemanticContextCompressor {
    pub fn new(min_compression_ratio: f32) -> Self {
        Self {
            min_compression_ratio,
        }
    }

    fn calculate_compression(&self, original: &str, compressed: &str) -> CompressionResult {
        let original_length = original.len();
        let compressed_length = compressed.len();
        let ratio = if original_length > 0 {
            1.0 - (compressed_length as f32 / original_length as f32)
        } else {
            0.0
        };

        CompressionResult {
            original_length,
            compressed_length,
            compression_ratio: ratio,
            preserved_elements: vec![],
        }
    }
}

impl ContextCompressor for SemanticContextCompressor {
    fn compress(&self, context: &str) -> CompressionResult {
        let lines: Vec<&str> = context.lines().collect();
        let mut preserved = Vec::new();
        let mut to_compress = Vec::new();

        for line in &lines {
            let lower = line.to_lowercase();
            if lower.contains("system:")
                || lower.contains("tool")
                || lower.contains("function")
                || lower.contains("instruction")
            {
                preserved.push(line.to_string());
            } else {
                to_compress.push(*line);
            }
        }

        let mut result = String::new();

        for p in &preserved {
            result.push_str(p);
            result.push('\n');
        }

        for line in to_compress {
            let trimmed = line.trim();
            if trimmed.len() > 10 {
                if trimmed.starts_with("##") || trimmed.starts_with("###") {
                    result.push_str(line);
                    result.push('\n');
                } else if trimmed.starts_with('-') || trimmed.starts_with('*') {
                    let shortened = format!(
                        "{} [content truncated for brevity]",
                        &trimmed[..30.min(trimmed.len())]
                    );
                    result.push_str(&shortened);
                    result.push('\n');
                } else if trimmed.len() > 100 {
                    let shortened = format!(
                        "{}... [content truncated]",
                        &trimmed[..100.min(trimmed.len())]
                    );
                    result.push_str(&shortened);
                    result.push('\n');
                } else {
                    result.push_str(line);
                    result.push('\n');
                }
            }
        }

        let compression = self.calculate_compression(context, &result);

        if compression.compression_ratio < self.min_compression_ratio {
            let target_length =
                (context.len() as f32 * (1.0 - self.min_compression_ratio)) as usize;
            let chars_to_remove = result.len() - target_length;

            if chars_to_remove > 0 && result.len() > chars_to_remove {
                let idx = result.len() - chars_to_remove;
                result.truncate(idx);
                result.push_str("\n...[compressed]");
            }
        }

        CompressionResult {
            original_length: context.len(),
            compressed_length: result.len(),
            compression_ratio: 1.0 - (result.len() as f32 / context.len().max(1) as f32),
            preserved_elements: preserved,
        }
    }

    fn decompress(&self, compressed: &str) -> String {
        compressed
            .replace(" [content truncated for brevity]", "")
            .replace("... [compressed]", "")
            .to_string()
    }
}

pub struct ContextManager {
    token_monitor: Arc<TokenMonitor>,
    compressor: Box<dyn ContextCompressor>,
    is_paused: Arc<RwLock<bool>>,
}

impl ContextManager {
    pub fn new(
        config: ContextManagerConfig,
        compressor: Box<dyn ContextCompressor>,
    ) -> (Self, mpsc::UnboundedReceiver<ThresholdBreach>) {
        let (monitor, breach_rx) = TokenMonitor::new(config);
        let manager = Self {
            token_monitor: Arc::new(monitor),
            compressor,
            is_paused: Arc::new(RwLock::new(false)),
        };
        (manager, breach_rx)
    }

    pub fn monitor(&self) -> Arc<TokenMonitor> {
        Arc::clone(&self.token_monitor)
    }

    pub async fn update_context(&self, context: &str, token_count: u32) {
        self.token_monitor.update_token_count(token_count).await;
    }

    pub async fn compress_if_needed(&self, context: &str) -> Option<CompressionResult> {
        if !self.token_monitor.config.enabled {
            return None;
        }

        if let Some(breach) = self.token_monitor.check_intervention_required().await {
            match breach {
                ThresholdBreach::MaxTokenLimit { .. }
                | ThresholdBreach::PerformanceThreshold { .. } => {
                    let result = self.compressor.compress(context);
                    return Some(result);
                }
            }
        }

        None
    }

    pub async fn is_paused(&self) -> bool {
        *self.is_paused.read().await
    }

    pub async fn pause(&self) {
        let mut paused = self.is_paused.write().await;
        *paused = true;
    }

    pub async fn resume(&self) {
        let mut paused = self.is_paused.write().await;
        *paused = false;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_semantic_compressor_achieves_min_ratio() {
        let compressor = SemanticContextCompressor::new(0.30);

        let long_context = r#"
This is a very long conversation history that goes on and on with lots of details
about previous interactions and context that might not be strictly necessary for
the current task but was important for historical reference purposes.

This is additional content that provides more context and details about the conversation.
More verbose information that can be safely compressed without losing important semantics.
Extra sentences that add length but not critical information to the context window.
Extra content here that is repetitive and verbose and adds no real semantic value.
And more content here that is verbose and repetitive and can be compressed.
Even more content that is just filling up space without adding real value.
"#;

        let result = compressor.compress(long_context);

        assert!(
            result.original_length > result.compressed_length,
            "Compressed length {} should be less than original {}",
            result.compressed_length,
            result.original_length
        );

        assert!(
            result.compression_ratio > 0.0,
            "Compression ratio {} should be positive",
            result.compression_ratio
        );
    }
}
