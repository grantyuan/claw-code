use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct ConnectionStatus {
    pub id: String,
    pub status: String,
    pub latency: Option<u64>,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn check_connection_health(endpoint: String) -> Result<ConnectionStatus, String> {
    let start = std::time::Instant::now();
    
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;
    
    match client.get(format!("{}/api/health", endpoint)).send().await {
        Ok(response) => {
            let latency = start.elapsed().as_millis() as u64;
            if response.status().is_success() {
                Ok(ConnectionStatus {
                    id: endpoint.clone(),
                    status: "connected".to_string(),
                    latency: Some(latency),
                    error: None,
                })
            } else {
                Ok(ConnectionStatus {
                    id: endpoint.clone(),
                    status: "error".to_string(),
                    latency: Some(latency),
                    error: Some(format!("HTTP {}", response.status())),
                })
            }
        }
        Err(e) => Ok(ConnectionStatus {
            id: endpoint.clone(),
            status: "disconnected".to_string(),
            latency: None,
            error: Some(e.to_string()),
        }),
    }
}

#[tauri::command]
pub async fn ping_host(_host: String) -> Result<u64, String> {
    let start = std::time::Instant::now();
    tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
    Ok(start.elapsed().as_millis() as u64)
}
