use std::collections::HashMap;
use std::fmt::{Display, Formatter};
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::sync::Mutex;

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
    #[error("Internal error: {0}")]
    Internal(String),
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
                .unwrap_or_else(|_| "claude-3-opus".to_string()),
        }
    }
}

#[derive(Debug)]
pub struct ClawRuntime {
    config: RuntimeConfig,
    sessions: Arc<Mutex<HashMap<SessionId, Session>>>,
}

impl Clone for ClawRuntime {
    fn clone(&self) -> Self {
        Self {
            config: self.config.clone(),
            sessions: Arc::clone(&self.sessions),
        }
    }
}

impl ClawRuntime {
    pub fn new(config: RuntimeConfig) -> Result<Self> {
        tracing::info!(
            "Initializing ClawRuntime - provider: {}, endpoint: {}, model: {}",
            config.provider,
            config.endpoint,
            config.model
        );
        Ok(Self {
            config,
            sessions: Arc::new(Mutex::new(HashMap::new())),
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
                CommandType::UserMessage => self.process_user_message(&session_id, input)?,
                CommandType::SlashCommand => self.process_slash_command(&session_id, input)?,
                _ => self.process_user_message(&session_id, input)?,
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

    fn process_user_message(&self, session_id: &SessionId, content: &str) -> Result<String> {
        tracing::debug!("Processing user message for session: {}", session_id);
        Ok(format!(
            "ClawRuntime processed: {} (model: {}, provider: {})",
            content, self.config.model, self.config.provider
        ))
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

pub fn create_runtime() -> Result<ClawRuntime> {
    let config = RuntimeConfig::default();
    ClawRuntime::new(config)
}
