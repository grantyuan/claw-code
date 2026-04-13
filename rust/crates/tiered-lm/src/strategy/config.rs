use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProcessingMode {
    SpeedFirst,
    TokenFirst,
}

impl Default for ProcessingMode {
    fn default() -> Self {
        Self::SpeedFirst
    }
}

impl fmt::Display for ProcessingMode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ProcessingMode::SpeedFirst => write!(f, "speed_first"),
            ProcessingMode::TokenFirst => write!(f, "token_first"),
        }
    }
}

#[derive(Debug, Clone)]
pub struct StrategyConfig {
    pub mode: ProcessingMode,
    pub quality_threshold: u8,
    pub enable_local_self_assessment: bool,
    pub self_assessment_timeout_ms: u32,
    pub reasoning_time_weight: f32,
    pub reasoning_steps_weight: f32,
    pub simple_task_local_token_limit: u32,
    pub medium_task_remote_token_limit: u32,
    pub min_quality_threshold: u8,
    pub retry_quality_threshold: u8,
    pub api_timeout_ms: u64,
    pub local_model_timeout_ms: u64,
}

impl Default for StrategyConfig {
    fn default() -> Self {
        Self {
            mode: ProcessingMode::SpeedFirst,
            quality_threshold: 70,
            enable_local_self_assessment: true,
            self_assessment_timeout_ms: 10000,
            reasoning_time_weight: 0.5,
            reasoning_steps_weight: 0.5,
            simple_task_local_token_limit: 500,
            medium_task_remote_token_limit: 2000,
            min_quality_threshold: 50,
            retry_quality_threshold: 35,
            api_timeout_ms: 300_000,
            local_model_timeout_ms: 120_000,
        }
    }
}

impl StrategyConfig {
    pub fn from_env() -> Self {
        let mode = std::env::var("CLAW_PROCESSING_MODE")
            .map(|v| match v.as_str() {
                "token_first" => ProcessingMode::TokenFirst,
                _ => ProcessingMode::SpeedFirst,
            })
            .unwrap_or_default();

        Self {
            mode,
            quality_threshold: std::env::var("CLAW_QUALITY_THRESHOLD")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(70),
            api_timeout_ms: std::env::var("API_TIMEOUT_MS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(300_000),
            local_model_timeout_ms: std::env::var("CLAW_LOCAL_MODEL_TIMEOUT_MS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(120_000),
            ..Default::default()
        }
    }
}
