use axum::{
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::{Mutex, RwLock};
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;

mod agent_manager;
mod chat_handler;
mod chat_history_commands;
mod rest_handler;
mod runtime;
mod ws_handler;

pub use agent_manager::AgentManager;
use runtime::{create_runtime, create_runtime_with_config, ClawRuntime, RuntimeConfig};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub ws_port: u16,
    pub rest_port: u16,
    pub host: String,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            ws_port: 8765,
            rest_port: 8766,
            host: "0.0.0.0".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIModelConfig {
    pub provider: String,
    pub endpoint: String,
    pub api_key: Option<String>,
    pub model: String,
}

impl Default for AIModelConfig {
    fn default() -> Self {
        Self {
            provider: std::env::var("CLAW_DEFAULT_PROVIDER")
                .unwrap_or_else(|_| "anthropic".to_string()),
            endpoint: std::env::var("CLAW_DEFAULT_ENDPOINT")
                .unwrap_or_else(|_| "https://api.anthropic.com".to_string()),
            api_key: std::env::var("ANTHROPIC_API_KEY")
                .ok()
                .or_else(|| std::env::var("OPENAI_API_KEY").ok()),
            model: std::env::var("CLAW_DEFAULT_MODEL")
                .unwrap_or_else(|_| "claude-sonnet-4-6".to_string()),
        }
    }
}

impl From<AIModelConfig> for RuntimeConfig {
    fn from(config: AIModelConfig) -> Self {
        RuntimeConfig {
            provider: config.provider,
            endpoint: config.endpoint,
            api_key: config.api_key,
            model: config.model,
        }
    }
}

#[derive(Debug)]
pub struct AppState {
    pub agent_manager: Arc<Mutex<AgentManager>>,
    pub runtime: Arc<RwLock<Option<ClawRuntime>>>,
    pub config: Arc<RwLock<AIModelConfig>>,
}

impl AppState {
    pub fn new() -> Self {
        let config = AIModelConfig::default();
        let runtime = match create_runtime() {
            Ok(r) => {
                tracing::info!("ClawRuntime initialized successfully from environment");
                Some(r)
            }
            Err(e) => {
                tracing::warn!("ClawRuntime not initialized from environment: {}", e);
                tracing::info!("Runtime can be initialized via API with model configuration");
                None
            }
        };
        Self {
            agent_manager: Arc::new(Mutex::new(AgentManager::new())),
            runtime: Arc::new(RwLock::new(runtime)),
            config: Arc::new(RwLock::new(config)),
        }
    }

    pub async fn init_runtime(&self, config: AIModelConfig) -> Result<(), String> {
        let runtime_config = RuntimeConfig::from(config.clone());
        match create_runtime_with_config(runtime_config) {
            Ok(runtime) => {
                let mut runtime_guard = self.runtime.write().await;
                *runtime_guard = Some(runtime);
                let mut config_guard = self.config.write().await;
                *config_guard = config;
                tracing::info!("Runtime initialized successfully via API");
                Ok(())
            }
            Err(e) => {
                tracing::error!("Failed to initialize runtime: {}", e);
                Err(e.to_string())
            }
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}

pub async fn run_server(config: ServerConfig) -> Result<(), Box<dyn std::error::Error>> {
    let _ = tracing_subscriber::fmt()
        .with_env_filter("cli_server=debug,tower_http=debug")
        .try_init();

    let state = Arc::new(AppState::new());

    {
        let runtime_guard = state.runtime.read().await;
        if runtime_guard.is_none() {
            tracing::warn!("Runtime not initialized - configure AI model via API to enable");
        }
    }

    let app = Router::new()
        .route("/api/health", get(rest_handler::health_check))
        .route("/api/agents", get(rest_handler::list_agents))
        .route("/api/agents/{id}", get(rest_handler::get_agent))
        .route(
            "/api/tasks",
            get(rest_handler::list_tasks).post(rest_handler::create_task),
        )
        .route(
            "/api/tasks/{id}",
            get(rest_handler::get_task).delete(rest_handler::cancel_task),
        )
        .route(
            "/api/config",
            get(rest_handler::get_config).put(rest_handler::update_config),
        )
        .route("/api/runtime/init", post(rest_handler::init_runtime))
        .route("/api/deploy", post(rest_handler::deploy_remote))
        .route("/api/chat", post(chat_handler::chat_message))
        .route(
            "/api/sessions",
            get(rest_handler::list_sessions).post(rest_handler::create_session),
        )
        .route(
            "/api/sessions/{id}",
            get(rest_handler::get_session).delete(rest_handler::delete_session),
        )
        .route(
            "/api/sessions/{id}/switch",
            post(rest_handler::switch_session),
        )
        .route("/ws", get(ws_handler::ws_handler))
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let addr = format!("{}:{}", config.host, config.rest_port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    tracing::info!("CLI Server listening on {}", addr);
    axum::serve(listener, app).await?;

    Ok(())
}
