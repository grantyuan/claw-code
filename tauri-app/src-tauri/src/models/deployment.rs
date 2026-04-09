use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeploymentConfig {
    pub version: String,
    pub install_path: String,
    pub auto_start: bool,
    pub auto_update: bool,
    pub health_check_interval: u64,
    pub rollback_on_failure: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeploymentStep {
    pub step: u8,
    pub name: String,
    pub status: DeploymentStepStatus,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DeploymentStepStatus {
    Pending,
    InProgress,
    Completed,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeploymentResult {
    pub success: bool,
    pub steps: Vec<DeploymentStep>,
    pub error: Option<String>,
    pub elapsed_ms: u64,
}
