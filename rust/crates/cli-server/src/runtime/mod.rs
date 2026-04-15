use futures_util::Stream;
use std::collections::HashMap;
use std::fmt::{Display, Formatter};
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};
use std::pin::Pin;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::sync::Mutex;

use api::{
    ApiError, InputContentBlock, InputMessage, MessageRequest, MessageResponse, OutputContentBlock,
    ProviderClient, StreamEvent,
};
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Clone, Error)]
pub enum RuntimeError {
    #[error("Config error: {0}")]
    Config(String),
    #[error("Session not found: {0}")]
    SessionNotFound(String),
    #[error("Provider error: {0}")]
    Provider(String),
    #[error("Runtime not available")]
    NotAvailable,
    #[error("API error: {0}")]
    Api(String),
    #[error("Internal error: {0}")]
    Internal(String),
}

impl From<ApiError> for RuntimeError {
    fn from(err: ApiError) -> Self {
        RuntimeError::Api(err.to_string())
    }
}

pub type Result<T> = std::result::Result<T, RuntimeError>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionId(String);

impl SessionId {
    pub fn new(id: String) -> Self {
        Self(id)
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl Display for SessionId {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl PartialEq for SessionId {
    fn eq(&self, other: &Self) -> bool {
        self.0 == other.0
    }
}

impl Eq for SessionId {}

impl Hash for SessionId {
    fn hash<H: Hasher>(&self, state: &mut H) {
        self.0.hash(state);
    }
}

impl From<String> for SessionId {
    fn from(s: String) -> Self {
        Self(s)
    }
}

impl From<&str> for SessionId {
    fn from(s: &str) -> Self {
        Self(s.to_string())
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SessionStatus {
    Active,
    Idle,
    Running,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionInfo {
    pub id: SessionId,
    pub name: String,
    pub project_path: PathBuf,
    pub status: SessionStatus,
    pub created_at: u64,
    pub last_active_at: u64,
    pub message_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub role: String,
    pub content: String,
    pub timestamp: u64,
}

#[derive(Debug, Clone)]
pub struct Session {
    pub id: SessionId,
    pub name: String,
    pub project_path: PathBuf,
    pub status: SessionStatus,
    pub created_at: u64,
    pub last_active_at: u64,
    pub message_count: usize,
    pub history: Vec<Message>,
}

impl Session {
    pub fn new(id: SessionId, project_path: PathBuf) -> Self {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let name = project_path
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_else(|| "Untitled".to_string());
        Self {
            id,
            name,
            project_path,
            status: SessionStatus::Idle,
            created_at: now,
            last_active_at: now,
            message_count: 0,
            history: Vec::new(),
        }
    }

    pub fn to_info(&self) -> SessionInfo {
        SessionInfo {
            id: self.id.clone(),
            name: self.name.clone(),
            project_path: self.project_path.clone(),
            status: self.status,
            created_at: self.created_at,
            last_active_at: self.last_active_at,
            message_count: self.message_count,
        }
    }

    pub fn to_api_messages(&self) -> Vec<InputMessage> {
        self.history
            .iter()
            .map(|m| InputMessage {
                role: m.role.clone(),
                content: vec![InputContentBlock::Text {
                    text: m.content.clone(),
                }],
            })
            .collect()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CommandType {
    UserMessage,
    SlashCommand,
    ToolCall,
    SessionReference,
}

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct ProcessedInput {
    pub original: String,
    pub command_type: CommandType,
    pub requires_confirmation: bool,
}

pub struct MessageProcessor;

impl MessageProcessor {
    pub fn parse_input(input: &str) -> ProcessedInput {
        let trimmed = input.trim();
        let command_type = if trimmed.starts_with('/') {
            CommandType::SlashCommand
        } else if trimmed.starts_with('@') {
            CommandType::SessionReference
        } else if trimmed.contains('(') && trimmed.contains(')') {
            CommandType::ToolCall
        } else {
            CommandType::UserMessage
        };

        ProcessedInput {
            original: input.to_string(),
            command_type,
            requires_confirmation: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeConfig {
    pub provider: String,
    pub endpoint: String,
    pub api_key: Option<String>,
    pub model: String,
}

impl Default for RuntimeConfig {
    fn default() -> Self {
        Self {
            provider: std::env::var("CLAW_DEFAULT_PROVIDER")
                .unwrap_or_else(|_| "anthropic".to_string()),
            endpoint: std::env::var("CLAW_DEFAULT_ENDPOINT")
                .unwrap_or_else(|_| "https://api.anthropic.com".to_string()),
            api_key: std::env::var("ANTHROPIC_API_KEY").ok(),
            model: std::env::var("CLAW_DEFAULT_MODEL")
                .unwrap_or_else(|_| "claude-sonnet-4-6".to_string()),
        }
    }
}

#[derive(Debug)]
pub struct ClawRuntime {
    config: RuntimeConfig,
    sessions: Arc<Mutex<HashMap<SessionId, Session>>>,
    provider: ProviderClient,
}

impl Clone for ClawRuntime {
    fn clone(&self) -> Self {
        Self {
            config: self.config.clone(),
            sessions: Arc::clone(&self.sessions),
            provider: self.provider.clone(),
        }
    }
}

impl ClawRuntime {
    pub fn new(config: RuntimeConfig) -> Result<Self> {
        let provider = ProviderClient::from_provider_config(
            &config.provider,
            &config.endpoint,
            config.api_key.as_deref(),
            &config.model,
        )
        .map_err(|e: ApiError| RuntimeError::Provider(e.to_string()))?;

        tracing::info!(
            "Initializing ClawRuntime - provider: {}, endpoint: {}, model: {}",
            config.provider,
            config.endpoint,
            config.model
        );

        Ok(Self {
            config,
            sessions: Arc::new(Mutex::new(HashMap::new())),
            provider,
        })
    }

    pub async fn create_session(&self, project_path: &Path) -> Result<SessionId> {
        let id = SessionId::new(format!("session_{}", uuid::Uuid::new_v4()));
        let session = Session::new(id.clone(), project_path.to_path_buf());
        tracing::info!("Creating session: {} for project: {:?}", id, project_path);
        self.sessions.lock().await.insert(id.clone(), session);
        Ok(id)
    }

    pub async fn list_sessions(&self) -> Vec<SessionInfo> {
        self.sessions
            .lock()
            .await
            .values()
            .map(|s| s.to_info())
            .collect()
    }

    pub async fn get_session(&self, id: &SessionId) -> Option<Session> {
        self.sessions.lock().await.get(id).cloned()
    }

    pub async fn switch_session(&self, id: &SessionId) -> Result<()> {
        let mut sessions = self.sessions.lock().await;
        if !sessions.contains_key(id) {
            return Err(RuntimeError::SessionNotFound(id.to_string()));
        }
        for session in sessions.values_mut() {
            if session.id == *id {
                session.status = SessionStatus::Active;
            } else if session.status == SessionStatus::Active {
                session.status = SessionStatus::Idle;
            }
        }
        tracing::info!("Switched to session: {}", id);
        Ok(())
    }

    pub async fn close_session(&self, id: &SessionId) -> Result<()> {
        let removed = self.sessions.lock().await.remove(id);
        if removed.is_none() {
            return Err(RuntimeError::SessionNotFound(id.to_string()));
        }
        tracing::info!("Closed session: {}", id);
        Ok(())
    }

    pub async fn send_message(&self, session_id: &str, input: &str) -> Result<String> {
        let session_id = SessionId::new(session_id.to_string());

        let processed = MessageProcessor::parse_input(input);
        tracing::info!(
            "Processing message for session: {}, type: {:?}, content_len: {}",
            session_id,
            processed.command_type,
            input.len()
        );

        let response = {
            let mut sessions = self.sessions.lock().await;
            let session = sessions
                .get_mut(&session_id)
                .ok_or_else(|| RuntimeError::SessionNotFound(session_id.to_string()))?;

            session.last_active_at = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs();
            session.status = SessionStatus::Running;
            session.message_count += 1;

            let now = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs();
            session.history.push(Message {
                role: "user".to_string(),
                content: input.to_string(),
                timestamp: now,
            });

            let result = match processed.command_type {
                CommandType::SlashCommand => self.process_slash_command(&session_id, input)?,
                _ => self.call_llm(session, input).await?,
            };

            session.history.push(Message {
                role: "assistant".to_string(),
                content: result.clone(),
                timestamp: SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_secs(),
            });

            session.status = SessionStatus::Idle;
            result
        };

        Ok(response)
    }

    pub async fn send_message_stream(
        &self,
        session_id: &str,
        input: &str,
    ) -> Result<StreamingResponse> {
        let session_id = SessionId::new(session_id.to_string());

        let processed = MessageProcessor::parse_input(input);
        tracing::info!(
            "Processing streaming message for session: {}, type: {:?}, content_len: {}",
            session_id,
            processed.command_type,
            input.len()
        );

        let session_info = {
            let mut sessions = self.sessions.lock().await;
            let session = sessions
                .get_mut(&session_id)
                .ok_or_else(|| RuntimeError::SessionNotFound(session_id.to_string()))?;

            session.last_active_at = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs();
            session.status = SessionStatus::Running;
            session.message_count += 1;

            let now = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs();
            session.history.push(Message {
                role: "user".to_string(),
                content: input.to_string(),
                timestamp: now,
            });

            session.to_api_messages()
        };

        let provider = self.provider.clone();
        let model = self.config.model.clone();
        let history = session_info;

        let (tx, rx) = tokio::sync::mpsc::channel(100);

        let input_owned = input.to_string();
        tokio::spawn(async move {
            let mut stream = match provider
                .stream_message(&MessageRequest {
                    model,
                    max_tokens: 4096,
                    messages: {
                        let mut msgs = history;
                        msgs.push(InputMessage::user_text(&input_owned));
                        msgs
                    },
                    system: None,
                    tools: None,
                    tool_choice: None,
                    stream: true,
                    temperature: None,
                    top_p: None,
                    frequency_penalty: None,
                    presence_penalty: None,
                    stop: None,
                    reasoning_effort: None,
                })
                .await
            {
                Ok(s) => s,
                Err(e) => {
                    let _ = tx
                        .send(ResponseEvent::Error {
                            message: e.to_string(),
                        })
                        .await;
                    return;
                }
            };

            let mut full_text = String::new();

            loop {
                let result = stream.next_event().await;
                match result {
                    Ok(Some(api_event)) => {
                        let response_event: ResponseEvent = api_event.clone().into();
                        if let ResponseEvent::ContentBlockDelta { delta, .. } = &response_event {
                            if let Some(text) = &delta.text {
                                full_text.push_str(text);
                            }
                        }
                        if let ResponseEvent::MessageStop = &response_event {
                            // Message complete - session history will be updated when MessageStop is received
                        }
                        let _ = tx.send(response_event).await;
                    }
                    Ok(None) => break,
                    Err(e) => {
                        let _ = tx
                            .send(ResponseEvent::Error {
                                message: e.to_string(),
                            })
                            .await;
                    }
                }
            }
        });

        Ok(StreamingResponse {
            events: Box::pin(tokio_stream::wrappers::ReceiverStream::new(rx)),
        })
    }

    async fn call_llm(&self, session: &Session, input: &str) -> Result<String> {
        let MessageResponse { content, .. }: MessageResponse = self
            .provider
            .send_message(&MessageRequest {
                model: self.config.model.clone(),
                max_tokens: 4096,
                messages: {
                    let mut msgs = session.to_api_messages();
                    msgs.push(InputMessage::user_text(input));
                    msgs
                },
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
            })
            .await?;

        let text = content
            .into_iter()
            .filter_map(|block| {
                if let OutputContentBlock::Text { text } = block {
                    Some(text)
                } else {
                    None
                }
            })
            .collect::<Vec<_>>()
            .join("\n");

        Ok(text)
    }

    fn process_slash_command(&self, session_id: &SessionId, command: &str) -> Result<String> {
        tracing::debug!("Processing slash command for session: {}", session_id);
        Ok(format!("Executed: {}", command))
    }

    pub async fn health_check(&self) -> HealthStatus {
        HealthStatus {
            status: "healthy".to_string(),
            runtime_available: true,
            session_count: self.sessions.lock().await.len(),
            config: self.config.clone(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthStatus {
    pub status: String,
    pub runtime_available: bool,
    pub session_count: usize,
    pub config: RuntimeConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ResponseEvent {
    ContentBlockStart { index: usize, block_type: String },
    ContentBlockDelta { index: usize, delta: ContentDelta },
    ContentBlockStop { index: usize },
    MessageStart { message_id: String, role: String },
    MessageDelta { delta: MessageDelta },
    MessageStop,
    Error { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContentDelta {
    pub text: Option<String>,
    pub type_: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageDelta {
    pub text: Option<String>,
    pub usage: Option<Usage>,
    pub stop_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Usage {
    pub input_tokens: u32,
    pub output_tokens: u32,
    pub cache_creation_input_tokens: u32,
    pub cache_read_input_tokens: u32,
}

pub struct StreamingResponse {
    pub events: Pin<Box<dyn Stream<Item = ResponseEvent> + Send>>,
}

impl From<StreamEvent> for ResponseEvent {
    fn from(event: StreamEvent) -> Self {
        match event {
            api::StreamEvent::MessageStart(e) => ResponseEvent::MessageStart {
                message_id: e.message.id,
                role: e.message.role,
            },
            api::StreamEvent::MessageDelta(e) => ResponseEvent::MessageDelta {
                delta: MessageDelta {
                    text: None,
                    usage: Some(Usage {
                        input_tokens: e.usage.input_tokens,
                        output_tokens: e.usage.output_tokens,
                        cache_creation_input_tokens: e.usage.cache_creation_input_tokens,
                        cache_read_input_tokens: e.usage.cache_read_input_tokens,
                    }),
                    stop_reason: e.delta.stop_reason,
                },
            },
            api::StreamEvent::ContentBlockStart(e) => ResponseEvent::ContentBlockStart {
                index: e.index as usize,
                block_type: format!("{:?}", e.content_block),
            },
            api::StreamEvent::ContentBlockDelta(e) => {
                let text = if let api::ContentBlockDelta::TextDelta { text } = &e.delta {
                    Some(text.clone())
                } else {
                    None
                };
                ResponseEvent::ContentBlockDelta {
                    index: e.index as usize,
                    delta: ContentDelta {
                        text,
                        type_: format!("{:?}", e.delta),
                    },
                }
            }
            api::StreamEvent::ContentBlockStop(e) => ResponseEvent::ContentBlockStop {
                index: e.index as usize,
            },
            api::StreamEvent::MessageStop(_) => ResponseEvent::MessageStop,
        }
    }
}

pub fn create_runtime() -> Result<ClawRuntime> {
    let config = RuntimeConfig::default();
    ClawRuntime::new(config)
}

pub fn create_runtime_with_config(config: RuntimeConfig) -> Result<ClawRuntime> {
    ClawRuntime::new(config)
}
