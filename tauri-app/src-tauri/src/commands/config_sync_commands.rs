use crate::ssh_client::SshClient;
use serde_json::Value;
use std::path::PathBuf;

fn get_config_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    let dir = home.join(".config").join("clawcode");
    Ok(dir.join("config.json"))
}

async fn load_local_config() -> Result<Value, String> {
    let path = get_config_path()?;
    if !path.exists() {
        return Ok(serde_json::json!({}));
    }
    let content = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("Failed to read config: {}", e))?;
    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse config: {}", e))
}

#[tauri::command]
pub async fn sync_config_to_remote(
    host: String,
    port: u16,
    username: String,
    auth_method: String,
    password: Option<String>,
    key_path: Option<String>,
    passphrase: Option<String>,
    remote_path: Option<String>,
) -> Result<(), String> {
    let mut client = SshClient::new(host, port, username);

    match auth_method.as_str() {
        "password" => {
            let pwd = password.ok_or("Password is required for password authentication")?;
            client.connect_with_password(&pwd)?;
        }
        "ssh-key" => {
            let key = key_path.ok_or("Key path is required for SSH key authentication")?;
            client.connect_with_key(&key, passphrase.as_deref())?;
        }
        _ => return Err("Invalid authentication method".to_string()),
    }

    let config = load_local_config().await?;
    let config_json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;

    let remote_config_path = remote_path.unwrap_or_else(|| "/opt/clawcode/config.json".to_string());
    
    let temp_config = tempfile::NamedTempFile::new()
        .map_err(|e| format!("Failed to create temp file: {}", e))?;
    std::fs::write(temp_config.path(), &config_json)
        .map_err(|e| format!("Failed to write config: {}", e))?;

    client.upload_file(temp_config.path().to_str().unwrap(), &remote_config_path)?;

    client.disconnect()?;

    Ok(())
}

#[tauri::command]
pub async fn pull_config_from_remote(
    host: String,
    port: u16,
    username: String,
    auth_method: String,
    password: Option<String>,
    key_path: Option<String>,
    passphrase: Option<String>,
    remote_path: Option<String>,
) -> Result<Value, String> {
    let mut client = SshClient::new(host, port, username);

    match auth_method.as_str() {
        "password" => {
            let pwd = password.ok_or("Password is required for password authentication")?;
            client.connect_with_password(&pwd)?;
        }
        "ssh-key" => {
            let key = key_path.ok_or("Key path is required for SSH key authentication")?;
            client.connect_with_key(&key, passphrase.as_deref())?;
        }
        _ => return Err("Invalid authentication method".to_string()),
    }

    let remote_config_path = remote_path.unwrap_or_else(|| "/opt/clawcode/config.json".to_string());
    
    let temp_config = tempfile::NamedTempFile::new()
        .map_err(|e| format!("Failed to create temp file: {}", e))?;

    client.download_file(&remote_config_path, temp_config.path().to_str().unwrap())?;

    let content = std::fs::read_to_string(temp_config.path())
        .map_err(|e| format!("Failed to read downloaded config: {}", e))?;

    let config: Value = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse remote config: {}", e))?;

    client.disconnect()?;

    Ok(config)
}

#[tauri::command]
pub async fn merge_configs(
    local_config: Value,
    remote_config: Value,
) -> Result<Value, String> {
    let mut merged = local_config.clone();

    if let (Some(local_obj), Some(remote_obj)) = (merged.as_object_mut(), remote_config.as_object()) {
        for (key, value) in remote_obj {
            if !local_obj.contains_key(key) {
                local_obj.insert(key.clone(), value.clone());
            }
        }
    }

    Ok(merged)
}
