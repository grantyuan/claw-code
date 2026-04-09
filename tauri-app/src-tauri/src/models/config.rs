use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub ai_model: AIModelConfig,
    pub remote: RemoteConfig,
    pub ui: UIConfig,
    pub project: ProjectConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIModelConfig {
    pub provider: String,
    pub endpoint: String,
    #[serde(skip_serializing)]
    pub api_key: Option<String>,
    pub model: String,
    pub fallback_models: Vec<String>,
    pub temperature: f32,
    pub max_tokens: u32,
    pub timeout: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteConfig {
    pub computers: Vec<crate::models::SshConnection>,
    pub deployment: crate::models::DeploymentConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UIConfig {
    pub theme: String,
    pub font_size: u8,
    pub font_family: String,
    pub language: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectConfig {
    pub working_directory: String,
    pub git_integration: bool,
    pub environment_variables: HashMap<String, String>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            ai_model: AIModelConfig {
                provider: "anthropic".to_string(),
                endpoint: "https://api.anthropic.com".to_string(),
                api_key: None,
                model: "claude-3-opus".to_string(),
                fallback_models: vec![],
                temperature: 0.7,
                max_tokens: 4096,
                timeout: 120,
            },
            remote: RemoteConfig {
                computers: vec![],
                deployment: crate::models::DeploymentConfig {
                    version: "0.1.0".to_string(),
                    install_path: "/opt/clawcode".to_string(),
                    auto_start: true,
                    auto_update: false,
                    health_check_interval: 30,
                    rollback_on_failure: true,
                },
            },
            ui: UIConfig {
                theme: "dark".to_string(),
                font_size: 14,
                font_family: "Inter".to_string(),
                language: "en".to_string(),
            },
            project: ProjectConfig {
                working_directory: ".".to_string(),
                git_integration: true,
                environment_variables: HashMap::new(),
            },
        }
    }
}
