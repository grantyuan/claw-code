use axum::{
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;

mod agent_manager;
mod chat_handler;
mod rest_handler;
mod runtime;
mod ws_handler;

pub use agent_manager::AgentManager;
use runtime::{create_runtime, ClawRuntime};

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

#[derive(Debug, Clone)]
pub struct AppState {
    pub agent_manager: Arc<Mutex<AgentManager>>,
    pub runtime: Option<ClawRuntime>,
}

impl AppState {
    pub fn new() -> Self {
        let runtime = create_runtime().ok();
        if runtime.is_some() {
            tracing::info!("ClawRuntime initialized successfully");
        } else {
            tracing::warn!("Failed to initialize ClawRuntime - runtime features will be limited");
        }
        Self {
            agent_manager: Arc::new(Mutex::new(AgentManager::new())),
            runtime,
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}

pub async fn run_server(config: ServerConfig) -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter("cli_server=debug,tower_http=debug")
        .init();

    let state = Arc::new(AppState::new());

    if state.runtime.is_none() {
        tracing::error!("CRITICAL: Runtime unavailable - messages cannot be processed");
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
