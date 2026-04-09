use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SshConnection {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_method: SshAuthMethod,
    pub enabled: bool,
    pub auto_connect: bool,
    pub health_check_interval: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SshAuthMethod {
    Password { password: String },
    SshKey { key_path: String, passphrase: Option<String> },
}
