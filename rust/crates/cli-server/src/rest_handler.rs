use axum::{extract::State, response::Json};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;

use crate::runtime::SessionId;
use crate::AppState;

pub async fn health_check(State(state): State<Arc<AppState>>) -> Json<Value> {
    let runtime_healthy = state.runtime.is_some();
    let session_count = if let Some(ref runtime) = state.runtime {
        runtime.list_sessions().await.len()
    } else {
        0
    };

    Json(json!({
        "status": if runtime_healthy { "ok" } else { "degraded" },
        "uptime": 0,
        "version": env!("CARGO_PKG_VERSION"),
        "runtime": {
            "available": runtime_healthy,
            "session_count": session_count,
        }
    }))
}

pub async fn list_agents(State(state): State<Arc<AppState>>) -> Json<Value> {
    let manager = state.agent_manager.lock().await;
    let agents = manager.list_agents();
    Json(json!({ "agents": agents }))
}

pub async fn get_agent(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<Value>, axum::http::StatusCode> {
    let manager = state.agent_manager.lock().await;
    match manager.get_agent(&id) {
        Some(agent) => Ok(Json(json!({ "agent": agent }))),
        None => Err(axum::http::StatusCode::NOT_FOUND),
    }
}

pub async fn list_tasks(State(state): State<Arc<AppState>>) -> Json<Value> {
    let manager = state.agent_manager.lock().await;
    let tasks = manager.list_tasks();
    Json(json!({ "tasks": tasks }))
}

pub async fn create_task(
    State(state): State<Arc<AppState>>,
    Json(task_request): Json<Value>,
) -> Json<Value> {
    let mut manager = state.agent_manager.lock().await;
    let task = manager.create_task(task_request);
    Json(json!({ "task": task }))
}

pub async fn get_task(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<Value>, axum::http::StatusCode> {
    let manager = state.agent_manager.lock().await;
    match manager.get_task(&id) {
        Some(task) => Ok(Json(json!({ "task": task }))),
        None => Err(axum::http::StatusCode::NOT_FOUND),
    }
}

pub async fn cancel_task(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> axum::http::StatusCode {
    let mut manager = state.agent_manager.lock().await;
    match manager.cancel_task(&id) {
        true => axum::http::StatusCode::OK,
        false => axum::http::StatusCode::NOT_FOUND,
    }
}

pub async fn get_config() -> Json<Value> {
    Json(json!({
        "config": {
            "aiModel": {
                "provider": "anthropic",
                "model": "claude-3-opus"
            }
        }
    }))
}

pub async fn update_config(Json(config): Json<Value>) -> Json<Value> {
    Json(json!({ "success": true, "config": config }))
}

pub async fn deploy_remote(Json(deploy_request): Json<Value>) -> Json<Value> {
    Json(json!({
        "success": true,
        "message": "Deployment initiated",
        "request": deploy_request
    }))
}

#[derive(Debug, Deserialize)]
pub struct CreateSessionRequest {
    pub project_path: String,
    pub name: Option<String>,
}

pub async fn list_sessions(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, axum::http::StatusCode> {
    let runtime = state.runtime.as_ref().ok_or_else(|| {
        tracing::error!("Runtime not available");
        axum::http::StatusCode::SERVICE_UNAVAILABLE
    })?;

    let sessions = runtime.list_sessions().await;
    Ok(Json(json!({ "sessions": sessions })))
}

pub async fn create_session(
    State(state): State<Arc<AppState>>,
    Json(request): Json<CreateSessionRequest>,
) -> Result<Json<Value>, axum::http::StatusCode> {
    let runtime = state.runtime.as_ref().ok_or_else(|| {
        tracing::error!("Runtime not available");
        axum::http::StatusCode::SERVICE_UNAVAILABLE
    })?;

    let project_path = std::path::PathBuf::from(&request.project_path);
    match runtime.create_session(&project_path).await {
        Ok(session_id) => {
            tracing::info!("Session created: {}", session_id);
            Ok(Json(json!({
                "session_id": session_id.to_string(),
                "project_path": request.project_path,
                "name": request.name.unwrap_or_else(|| "Untitled".to_string())
            })))
        }
        Err(e) => {
            tracing::error!("Failed to create session: {}", e);
            Err(axum::http::StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

pub async fn get_session(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<Value>, axum::http::StatusCode> {
    let runtime = state.runtime.as_ref().ok_or_else(|| {
        tracing::error!("Runtime not available");
        axum::http::StatusCode::SERVICE_UNAVAILABLE
    })?;

    let session_id = SessionId::new(id);
    match runtime.get_session(&session_id).await {
        Some(session) => Ok(Json(json!({ "session": session.to_info() }))),
        None => Err(axum::http::StatusCode::NOT_FOUND),
    }
}

pub async fn delete_session(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<axum::http::StatusCode, axum::http::StatusCode> {
    let runtime = state.runtime.as_ref().ok_or_else(|| {
        tracing::error!("Runtime not available");
        axum::http::StatusCode::SERVICE_UNAVAILABLE
    })?;

    let session_id = SessionId::new(id);
    match runtime.close_session(&session_id).await {
        Ok(_) => Ok(axum::http::StatusCode::OK),
        Err(_) => Err(axum::http::StatusCode::NOT_FOUND),
    }
}

pub async fn switch_session(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<Json<Value>, axum::http::StatusCode> {
    let runtime = state.runtime.as_ref().ok_or_else(|| {
        tracing::error!("Runtime not available");
        axum::http::StatusCode::SERVICE_UNAVAILABLE
    })?;

    let session_id = SessionId::new(id.clone());
    match runtime.switch_session(&session_id).await {
        Ok(_) => {
            tracing::info!("Switched to session: {}", id);
            Ok(Json(json!({ "success": true, "session_id": id })))
        }
        Err(e) => {
            tracing::error!("Failed to switch session: {}", e);
            Err(axum::http::StatusCode::NOT_FOUND)
        }
    }
}
