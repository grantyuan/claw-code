use std::collections::VecDeque;

use api::{
    ApiError, ContentBlockStartEvent, ContentBlockStopEvent, InputContentBlock, InputMessage,
    MessageDelta, MessageDeltaEvent, MessageRequest, MessageResponse, MessageStopEvent,
    OutputContentBlock, StreamEvent, Usage,
};
use serde::{Deserialize, Serialize};

pub const DEFAULT_OLLAMA_BASE_URL: &str = "http://localhost:11434";

#[async_trait::async_trait]
pub trait OllamaClientInterface: Send + Sync {
    async fn send_message(&self, request: &MessageRequest) -> Result<MessageResponse, ApiError>;
}

#[derive(Debug, Clone)]
pub struct OllamaClient {
    http: reqwest::Client,
    base_url: String,
    model: String,
}

impl OllamaClient {
    #[must_use]
    pub fn new(model: impl Into<String>) -> Self {
        Self {
            http: reqwest::Client::new(),
            base_url: DEFAULT_OLLAMA_BASE_URL.to_string(),
            model: model.into(),
        }
    }

    #[must_use]
    pub fn with_base_url(mut self, base_url: impl Into<String>) -> Self {
        self.base_url = base_url.into();
        self
    }

    pub async fn send_message(
        &self,
        request: &MessageRequest,
    ) -> Result<MessageResponse, ApiError> {
        let ollama_request = OllamaChatRequest::from_message_request(request, &self.model);
        let request_url = format!("{}/api/chat", self.base_url.trim_end_matches('/'));

        let response = self
            .http
            .post(&request_url)
            .header("content-type", "application/json")
            .json(&ollama_request)
            .send()
            .await
            .map_err(ApiError::from)?;

        if !response.status().is_success() {
            let status = response.status();
            let body: String = response.text().await.unwrap_or_default();
            return Err(ApiError::Api {
                status,
                error_type: None,
                message: Some(body.clone()),
                request_id: None,
                body,
                retryable: false,
            });
        }

        let ollama_response: OllamaChatResponse = response.json().await?;
        Ok(ollama_response.into_message_response())
    }

    pub async fn stream_message(
        &self,
        request: &MessageRequest,
    ) -> Result<OllamaMessageStream, ApiError> {
        let ollama_request = OllamaChatRequest::from_message_request(request, &self.model);
        let request_url = format!("{}/api/chat", self.base_url.trim_end_matches('/'));

        let response = self
            .http
            .post(&request_url)
            .header("content-type", "application/json")
            .json(&ollama_request)
            .send()
            .await
            .map_err(ApiError::from)?;

        if !response.status().is_success() {
            let status = response.status();
            let body: String = response.text().await.unwrap_or_default();
            return Err(ApiError::Api {
                status,
                error_type: None,
                message: Some(body.clone()),
                request_id: None,
                body,
                retryable: false,
            });
        }

        Ok(OllamaMessageStream {
            response,
            pending: VecDeque::new(),
            done: false,
            current_content: String::new(),
        })
    }
}

#[async_trait::async_trait]
impl OllamaClientInterface for OllamaClient {
    async fn send_message(&self, request: &MessageRequest) -> Result<MessageResponse, ApiError> {
        let ollama_request = OllamaChatRequest::from_message_request(request, &self.model);
        let request_url = format!("{}/api/chat", self.base_url.trim_end_matches('/'));

        let response = self
            .http
            .post(&request_url)
            .header("content-type", "application/json")
            .json(&ollama_request)
            .send()
            .await
            .map_err(ApiError::from)?;

        if !response.status().is_success() {
            let status = response.status();
            let body: String = response.text().await.unwrap_or_default();
            return Err(ApiError::Api {
                status,
                error_type: None,
                message: Some(body.clone()),
                request_id: None,
                body,
                retryable: false,
            });
        }

        let ollama_response: OllamaChatResponse = response.json().await?;
        Ok(ollama_response.into_message_response())
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct OllamaChatRequest {
    model: String,
    messages: Vec<OllamaMessage>,
    stream: bool,
}

impl OllamaChatRequest {
    fn from_message_request(request: &MessageRequest, default_model: &str) -> Self {
        let model = if request.model.is_empty() {
            default_model.to_string()
        } else {
            request.model.clone()
        };

        let messages: Vec<OllamaMessage> = request
            .messages
            .iter()
            .map(OllamaMessage::from_input_message)
            .collect();

        Self {
            model,
            messages,
            stream: request.stream,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "lowercase")]
enum OllamaRole {
    System,
    User,
    Assistant,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct OllamaMessage {
    role: OllamaRole,
    content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    images: Option<Vec<String>>,
}

impl OllamaMessage {
    fn from_input_message(message: &InputMessage) -> Self {
        let role = match message.role.as_str() {
            "system" => OllamaRole::System,
            "assistant" => OllamaRole::Assistant,
            _ => OllamaRole::User,
        };

        let mut content = String::new();
        let mut images: Option<Vec<String>> = None;

        for block in &message.content {
            match block {
                InputContentBlock::Text { text } => {
                    content.push_str(text);
                }
                InputContentBlock::ImageUrl { url } => {
                    if images.is_none() {
                        images = Some(Vec::new());
                    }
                    if let Some(ref mut imgs) = images {
                        imgs.push(url.clone());
                    }
                }
                InputContentBlock::ToolUse { .. } => {}
                InputContentBlock::ToolResult { .. } => {}
            }
        }

        Self {
            role,
            content,
            images,
        }
    }
}

#[derive(Debug, Deserialize)]
struct OllamaChatResponse {
    model: String,
    message: OllamaResponseMessage,
    done: bool,
}

impl OllamaChatResponse {
    fn into_message_response(self) -> MessageResponse {
        MessageResponse {
            id: format!("ollama-{}", uuid_simple()),
            kind: "message".to_string(),
            role: "assistant".to_string(),
            content: vec![OutputContentBlock::Text {
                text: self.message.content,
            }],
            model: self.model,
            stop_reason: if self.done {
                Some("end_turn".to_string())
            } else {
                None
            },
            stop_sequence: None,
            usage: Usage {
                input_tokens: 0,
                cache_creation_input_tokens: 0,
                cache_read_input_tokens: 0,
                output_tokens: 0,
            },
            request_id: None,
        }
    }
}

#[derive(Debug, Deserialize)]
struct OllamaResponseMessage {
    content: String,
}

#[derive(Debug, Deserialize)]
struct OllamaStreamResponse {
    done: bool,
}

impl OllamaStreamResponse {
    fn into_stream_events(self, state: &mut OllamaStreamState) -> Vec<StreamEvent> {
        let mut events = Vec::new();

        if !state.message_started {
            state.message_started = true;
            events.push(StreamEvent::ContentBlockStart(ContentBlockStartEvent {
                index: 0,
                content_block: OutputContentBlock::Text {
                    text: String::new(),
                },
            }));
        }

        if self.done {
            events.push(StreamEvent::ContentBlockStop(ContentBlockStopEvent {
                index: 0,
            }));
            events.push(StreamEvent::MessageDelta(MessageDeltaEvent {
                delta: MessageDelta {
                    stop_reason: Some("end_turn".to_string()),
                    stop_sequence: None,
                },
                usage: Usage::default(),
            }));
            events.push(StreamEvent::MessageStop(MessageStopEvent {}));
        }

        events
    }
}

#[derive(Debug, Default)]
struct OllamaStreamState {
    message_started: bool,
}

#[derive(Debug)]
pub struct OllamaMessageStream {
    response: reqwest::Response,
    pending: VecDeque<StreamEvent>,
    done: bool,
    current_content: String,
}

impl OllamaMessageStream {
    pub async fn next_event(&mut self) -> Result<Option<StreamEvent>, ApiError> {
        loop {
            if let Some(event) = self.pending.pop_front() {
                return Ok(Some(event));
            }

            if self.done {
                return Ok(None);
            }

            match self.response.chunk().await? {
                Some(chunk) => {
                    let text = String::from_utf8_lossy(&chunk);
                    for line in text.lines() {
                        if line.trim().is_empty() {
                            continue;
                        }
                        if let Ok(stream_resp) = serde_json::from_str::<OllamaStreamResponse>(line)
                        {
                            let is_done = stream_resp.done;
                            let mut state = OllamaStreamState {
                                message_started: !self.current_content.is_empty(),
                            };
                            let new_events = stream_resp.into_stream_events(&mut state);
                            self.pending.extend(new_events);
                            if is_done {
                                self.done = true;
                            }
                        }
                    }
                }
                None => {
                    self.done = true;
                }
            }
        }
    }
}

fn uuid_simple() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    format!("{:x}-{:x}", duration.as_secs(), duration.subsec_nanos())
}

#[cfg(test)]
mod tests {
    use super::*;
    use api::types::InputContentBlock;

    #[test]
    fn test_ollama_message_from_text_input() {
        let input = InputMessage {
            role: "user".to_string(),
            content: vec![InputContentBlock::Text {
                text: "Hello".to_string(),
            }],
        };
        let ollama_msg = OllamaMessage::from_input_message(&input);
        assert!(matches!(ollama_msg.role, OllamaRole::User));
        assert_eq!(ollama_msg.content, "Hello");
        assert!(ollama_msg.images.is_none());
    }

    #[test]
    fn test_ollama_message_from_image_input() {
        let input = InputMessage {
            role: "user".to_string(),
            content: vec![
                InputContentBlock::Text {
                    text: "What is this?".to_string(),
                },
                InputContentBlock::ImageUrl {
                    url: "data:image/png;base64,abc123".to_string(),
                },
            ],
        };
        let ollama_msg = OllamaMessage::from_input_message(&input);
        assert!(matches!(ollama_msg.role, OllamaRole::User));
        assert!(ollama_msg.images.is_some());
        assert_eq!(ollama_msg.images.unwrap().len(), 1);
    }
}
