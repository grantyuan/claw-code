use api::{ApiError, InputContentBlock, MessageRequest};

use crate::ollama_client::OllamaClient;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TaskComplexity {
    Simple,
    Medium,
    Complex,
}

#[derive(Debug, Clone)]
pub struct TieredRouterConfig {
    pub local_model: String,
    pub local_base_url: String,
    pub cloud_model: String,
    pub complexity_threshold: ComplexityThreshold,
    pub local_model_type: String,
}

#[derive(Debug, Clone, Copy)]
pub struct ComplexityThreshold {
    pub simple_max_tokens: u32,
    pub medium_max_tokens: u32,
}

impl Default for ComplexityThreshold {
    fn default() -> Self {
        Self {
            simple_max_tokens: 500,
            medium_max_tokens: 2000,
        }
    }
}

impl TieredRouterConfig {
    pub fn from_env() -> Self {
        Self {
            local_model: std::env::var("CLAW_LOCAL_MODEL")
                .unwrap_or_else(|_| "llama3.2".to_string()),
            local_base_url: std::env::var("OLLAMA_BASE_URL")
                .unwrap_or_else(|_| "http://localhost:11434".to_string()),
            cloud_model: std::env::var("CLAW_CLOUD_MODEL")
                .unwrap_or_else(|_| "claude-sonnet-4-6".to_string()),
            complexity_threshold: ComplexityThreshold {
                simple_max_tokens: std::env::var("CLAW_SIMPLE_MAX_TOKENS")
                    .ok()
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(500),
                medium_max_tokens: std::env::var("CLAW_MEDIUM_MAX_TOKENS")
                    .ok()
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(2000),
            },
            local_model_type: std::env::var("ASSISTANT_LOCAL_MODEL_TYPE")
                .unwrap_or_else(|_| "Ollama".to_string()),
        }
    }

    pub fn from_config(
        local_model_type: Option<String>,
        local_model_url: Option<String>,
        local_model_name: Option<String>,
        cloud_model: Option<String>,
    ) -> Self {
        Self {
            local_model: local_model_name.unwrap_or_else(|| "qwen3.5:27b".to_string()),
            local_base_url: local_model_url.unwrap_or_else(|| "http://localhost:11434".to_string()),
            cloud_model: cloud_model.unwrap_or_else(|| "claude-sonnet-4-6".to_string()),
            complexity_threshold: ComplexityThreshold::default(),
            local_model_type: local_model_type.unwrap_or_else(|| "Ollama".to_string()),
        }
    }

    pub fn local_client(&self) -> OllamaClient {
        OllamaClient::new(&self.local_model).with_base_url(&self.local_base_url)
    }
}

#[derive(Debug, Clone)]
pub enum RoutedClient {
    Local(OllamaClient),
    Cloud(api::AnthropicClient),
}

impl RoutedClient {
    pub fn route(request: &MessageRequest, config: &TieredRouterConfig) -> Self {
        let complexity = assess_complexity(request, &config.complexity_threshold);

        match complexity {
            TaskComplexity::Simple | TaskComplexity::Medium => Self::Local(config.local_client()),
            TaskComplexity::Complex => {
                let auth = api::AuthSource::from_env()
                    .expect("Failed to load Anthropic auth for cloud provider");
                Self::Cloud(
                    api::AnthropicClient::from_auth(auth).with_base_url(api::read_base_url()),
                )
            }
        }
    }

    pub async fn send_message(
        &self,
        request: &MessageRequest,
    ) -> Result<api::MessageResponse, ApiError> {
        match self {
            Self::Local(client) => client.send_message(request).await,
            Self::Cloud(client) => client.send_message(request).await,
        }
    }
}

pub fn assess_complexity(
    request: &MessageRequest,
    threshold: &ComplexityThreshold,
) -> TaskComplexity {
    let mut score = 0u32;

    let message_tokens = estimate_message_tokens(request);
    if message_tokens > threshold.medium_max_tokens {
        score += 3;
    } else if message_tokens > threshold.simple_max_tokens {
        score += 1;
    }

    let has_tools = request.tools.as_ref().map_or(false, |t| !t.is_empty());
    if has_tools {
        score += 2;
    }

    let has_system = request.system.as_ref().map_or(false, |s| !s.is_empty());
    if has_system {
        score += 1;
    }

    let message_count = request.messages.len();
    if message_count > 5 {
        score += 2;
    } else if message_count > 2 {
        score += 1;
    }

    if score >= 4 {
        TaskComplexity::Complex
    } else if score >= 2 {
        TaskComplexity::Medium
    } else {
        TaskComplexity::Simple
    }
}

fn estimate_message_tokens(request: &MessageRequest) -> u32 {
    let mut total = 0u32;

    for message in &request.messages {
        for block in &message.content {
            match block {
                InputContentBlock::Text { text } => {
                    total += estimate_text_tokens(text);
                }
                InputContentBlock::ImageUrl { url } => {
                    total += estimate_image_tokens(url);
                }
                InputContentBlock::ToolUse { .. } => {
                    total += 50;
                }
                InputContentBlock::ToolResult { .. } => {
                    total += 30;
                }
            }
        }
    }

    if let Some(system) = &request.system {
        total += estimate_text_tokens(system);
    }

    if let Some(tools) = &request.tools {
        total += tools.len() as u32 * 100;
    }

    total
}

fn estimate_text_tokens(text: &str) -> u32 {
    (text.len() as u32 / 4).saturating_add(text.split_whitespace().count() as u32 / 4)
}

fn estimate_image_tokens(url: &str) -> u32 {
    if url.starts_with("data:image") {
        let base64_len = url.split(',').nth(1).map(|s| s.len()).unwrap_or(0);
        base64_len as u32 * 3 / 4
    } else {
        1000
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use api::{InputContentBlock, InputMessage};

    #[test]
    fn test_simple_task_detection() {
        let request = MessageRequest {
            model: "llama3".to_string(),
            max_tokens: 100,
            messages: vec![InputMessage {
                role: "user".to_string(),
                content: vec![InputContentBlock::Text {
                    text: "Hello".to_string(),
                }],
            }],
            system: None,
            tools: None,
            tool_choice: None,
            stream: false,
            temperature: None,
            top_p: None,
            frequency_penalty: None,
            presence_penalty: None,
            stop: None,
            reasoning_effort: None,
        };

        let threshold = ComplexityThreshold::default();
        let complexity = assess_complexity(&request, &threshold);
        assert_eq!(complexity, TaskComplexity::Simple);
    }

    #[test]
    fn test_complex_task_detection() {
        let request = MessageRequest {
            model: "claude".to_string(),
            max_tokens: 4000,
            messages: vec![InputMessage {
                role: "user".to_string(),
                content: vec![InputContentBlock::Text {
                    text: "Explain this code in detail and suggest improvements. ".repeat(100),
                }],
            }],
            system: Some("You are an expert programmer".to_string()),
            tools: Some(vec![api::ToolDefinition {
                name: "search".to_string(),
                description: Some("Search the web".to_string()),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "query": {"type": "string"}
                    }
                }),
            }]),
            tool_choice: Some(api::ToolChoice::Auto),
            stream: false,
            temperature: None,
            top_p: None,
            frequency_penalty: None,
            presence_penalty: None,
            stop: None,
            reasoning_effort: None,
        };

        let threshold = ComplexityThreshold::default();
        let complexity = assess_complexity(&request, &threshold);
        assert_eq!(complexity, TaskComplexity::Complex);
    }
}
