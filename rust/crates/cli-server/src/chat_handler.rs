use axum::{extract::State, response::Json};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;

use crate::AppState;

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct ChatRequest {
    pub content: String,
    #[serde(default)]
    pub conversation_id: Option<String>,
    pub model: Option<String>,
    pub provider: Option<String>,
    pub endpoint: Option<String>,
    pub api_key: Option<String>,
    pub max_tokens: Option<u32>,
    pub temperature: Option<f32>,
    pub top_p: Option<f32>,
    #[serde(default)]
    pub attachments: Vec<Attachment>,
}

#[derive(Debug, Deserialize, Clone)]
#[allow(dead_code)]
pub struct Attachment {
    pub id: String,
    #[serde(rename = "type")]
    pub attachment_type: String,
    pub name: String,
    pub mime_type: String,
    pub data: String,
    pub size: u64,
}

#[derive(Debug, Serialize)]
#[allow(dead_code)]
pub struct ChatResponse {
    pub id: String,
    pub role: String,
    pub content: String,
    pub model: String,
}

pub async fn chat_message(
    State(state): State<Arc<AppState>>,
    Json(request): Json<ChatRequest>,
) -> Json<Value> {
    let runtime_guard = state.runtime.read().await;
    let runtime = match runtime_guard.as_ref() {
        Some(r) => r,
        None => {
            tracing::error!("RUNTIME_NOT_AVAILABLE: Initialize runtime with /api/runtime/init first");
            return Json(json!({
                "error": "Runtime not available - initialize with /api/runtime/init first",
                "hint": "Configure AI model settings and save to initialize runtime"
            }));
        }
    };

    let session_id = request
        .conversation_id
        .unwrap_or_else(|| "default".to_string());
    let model = request.model.unwrap_or_else(|| "default".to_string());

    tracing::info!(
        "Chat request - session: {}, content_len: {}",
        session_id,
        request.content.len()
    );

    let response = runtime.send_message(&session_id, &request.content).await;

    let result = match response {
        Ok(msg) => {
            let id = format!("msg-{}", uuid::Uuid::new_v4());
            json!({
                "id": id,
                "role": "assistant",
                "content": msg,
                "model": model,
            })
        }
        Err(e) => {
            tracing::error!("Message send failed: {}", e);
            json!({"error": format!("Send failed: {}", e)})
        }
    };

    Json(result)
}
