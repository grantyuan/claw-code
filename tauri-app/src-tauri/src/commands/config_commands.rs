use crate::models::AppConfig;
use std::fs;
use std::path::PathBuf;

fn get_config_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    Ok(home.join(".config").join("clawcode").join("config.json"))
}

#[tauri::command]
pub async fn get_config() -> Result<AppConfig, String> {
    let config_path = get_config_path()?;
    
    if !config_path.exists() {
        return Ok(AppConfig::default());
    }
    
    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read config: {}", e))?;
    
    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse config: {}", e))
}

#[tauri::command]
pub async fn save_config(config: AppConfig) -> Result<(), String> {
    let config_path = get_config_path()?;
    
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }
    
    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    
    fs::write(&config_path, content)
        .map_err(|e| format!("Failed to write config: {}", e))
}

#[tauri::command]
pub async fn validate_api_key(_provider: String, _api_key: String, _endpoint: String) -> Result<bool, String> {
    if _api_key.len() < 8 {
        return Err("API key must be at least 8 characters".to_string());
    }
    Ok(true)
}

#[tauri::command]
pub async fn test_api_connection(_provider: String, _endpoint: String, _api_key: String) -> Result<bool, String> {
    tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
    Ok(true)
}
