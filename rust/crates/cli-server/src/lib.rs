use axum::{
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;

mod ws_handler;
mod rest_handler;
mod agent_manager;

pub use agent_manager::AgentManager;

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

pub struct AppState {
    pub agent_manager: Arc<Mutex<AgentManager>>,
}

pub async fn run_server(config: ServerConfig) -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter("cli_server=debug,tower_http=debug")
        .init();

    let agent_manager = Arc::new(Mutex::new(AgentManager::new()));
    let state = Arc::new(AppState {
        agent_manager: agent_manager.clone(),
    });

    let app = Router::new()
        .route("/api/health", get(rest_handler::health_check))
        .route("/api/agents", get(rest_handler::list_agents))
        .route("/api/agents/{id}", get(rest_handler::get_agent))
        .route("/api/tasks", get(rest_handler::list_tasks).post(rest_handler::create_task))
        .route("/api/tasks/{id}", get(rest_handler::get_task).delete(rest_handler::cancel_task))
        .route("/api/config", get(rest_handler::get_config).put(rest_handler::update_config))
        .route("/api/deploy", post(rest_handler::deploy_remote))
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
