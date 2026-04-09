use axum::extract::State;
use axum::response::Json;
use serde_json::{json, Value};
use std::sync::Arc;

use crate::AppState;

pub async fn health_check() -> Json<Value> {
    Json(json!({
        "status": "ok",
        "uptime": 0,
        "version": env!("CARGO_PKG_VERSION")
    }))
}

pub async fn list_agents(
    State(state): State<Arc<AppState>>,
) -> Json<Value> {
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

pub async fn list_tasks(
    State(state): State<Arc<AppState>>,
) -> Json<Value> {
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

pub async fn update_config(
    Json(config): Json<Value>,
) -> Json<Value> {
    Json(json!({ "success": true, "config": config }))
}

pub async fn deploy_remote(
    Json(deploy_request): Json<Value>,
) -> Json<Value> {
    Json(json!({
        "success": true,
        "message": "Deployment initiated",
        "request": deploy_request
    }))
}
