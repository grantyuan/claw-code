use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    extract::State,
    response::IntoResponse,
};
use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;

use crate::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct WsMessage {
    #[serde(rename = "type")]
    msg_type: String,
    payload: Value,
    timestamp: String,
}

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: Arc<AppState>) {
    let (mut sender, mut receiver) = socket.split();

    let welcome = WsMessage {
        msg_type: "system_notification".to_string(),
        payload: json!({ "message": "Connected to ClawCode CLI Server" }),
        timestamp: chrono::Utc::now().to_rfc3339(),
    };

    if let Ok(msg) = serde_json::to_string(&welcome) {
        let _ = sender.send(Message::Text(msg.into())).await;
    }

    while let Some(msg) = receiver.next().await {
        let msg = match msg {
            Ok(msg) => msg,
            Err(_) => break,
        };

        match msg {
            Message::Text(text) => {
                let parsed: Result<WsMessage, _> = serde_json::from_str(&text);
                match parsed {
                    Ok(ws_msg) => {
                        let response = handle_message(&ws_msg, &state).await;
                        if let Ok(response_str) = serde_json::to_string(&response) {
                            if sender.send(Message::Text(response_str.into())).await.is_err() {
                                break;
                            }
                        }
                    }
                    Err(_) => {
                        let error_msg = WsMessage {
                            msg_type: "error".to_string(),
                            payload: json!({ "message": "Invalid message format" }),
                            timestamp: chrono::Utc::now().to_rfc3339(),
                        };
                        if let Ok(error_str) = serde_json::to_string(&error_msg) {
                            let _ = sender.send(Message::Text(error_str.into())).await;
                        }
                    }
                }
            }
            Message::Close(_) => break,
            _ => {}
        }
    }
}

async fn handle_message(msg: &WsMessage, state: &Arc<AppState>) -> WsMessage {
    match msg.msg_type.as_str() {
        "ping" => WsMessage {
            msg_type: "pong".to_string(),
            payload: json!({}),
            timestamp: chrono::Utc::now().to_rfc3339(),
        },
        "send_message" => WsMessage {
            msg_type: "system_notification".to_string(),
            payload: json!({ "message": "Message received", "original": msg.payload }),
            timestamp: chrono::Utc::now().to_rfc3339(),
        },
        "create_task" => {
            let mut manager = state.agent_manager.lock().await;
            let task = manager.create_task(msg.payload.clone());
            WsMessage {
                msg_type: "task_created".to_string(),
                payload: task,
                timestamp: chrono::Utc::now().to_rfc3339(),
            }
        }
        _ => WsMessage {
            msg_type: "error".to_string(),
            payload: json!({ "message": format!("Unknown message type: {}", msg.msg_type) }),
            timestamp: chrono::Utc::now().to_rfc3339(),
        },
    }
}
