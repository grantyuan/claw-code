use crate::ssh_client::SshClient;
use crate::models::{DeploymentResult, DeploymentStep, DeploymentStepStatus};
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, serde::Serialize)]
pub struct LlmEnvironment {
    pub ollama_installed: bool,
    pub ollama_version: Option<String>,
    pub vllm_installed: bool,
    pub vllm_version: Option<String>,
    pub llama_cpp_installed: bool,
    pub llama_cpp_version: Option<String>,
    pub python_installed: bool,
    pub python_version: Option<String>,
    pub cuda_available: bool,
    pub gpu_info: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct DeploymentProgress {
    pub step: u8,
    pub name: String,
    pub status: DeploymentStepStatus,
    pub message: String,
    pub timestamp: u64,
}

pub struct RemoteDeployment {
    ssh_client: SshClient,
    app_handle: AppHandle,
}

impl RemoteDeployment {
    pub fn new(ssh_client: SshClient, app_handle: AppHandle) -> Self {
        Self {
            ssh_client,
            app_handle,
        }
    }

    fn emit_progress(&self, step: u8, name: &str, status: DeploymentStepStatus, message: &str) {
        let progress = DeploymentProgress {
            step,
            name: name.to_string(),
            status: status.clone(),
            message: message.to_string(),
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64,
        };

        let _ = self.app_handle.emit("deployment-progress", progress);
    }

    pub fn detect_llm_environment(&self) -> Result<LlmEnvironment, String> {
        self.emit_progress(1, "Detecting LLM environment", DeploymentStepStatus::InProgress, "Checking installed software...");

        let ollama_result = self.ssh_client.execute_command("which ollama");
        let ollama_installed = ollama_result.map(|r| r.exit_code == 0).unwrap_or(false);
        
        let ollama_version = if ollama_installed {
            self.ssh_client.execute_command("ollama --version")
                .ok()
                .and_then(|r| r.stdout.lines().next().map(|s| s.to_string()))
        } else {
            None
        };

        let vllm_result = self.ssh_client.execute_command("python3 -c 'import vllm; print(vllm.__version__)'");
        let vllm_installed = vllm_result.as_ref().map(|r| r.exit_code == 0).unwrap_or(false);
        let vllm_version = vllm_result.ok().and_then(|r| {
            if r.exit_code == 0 {
                Some(r.stdout.trim().to_string())
            } else {
                None
            }
        });

        let llama_cpp_result = self.ssh_client.execute_command("which llama-cli || which main");
        let llama_cpp_installed = llama_cpp_result.map(|r| r.exit_code == 0).unwrap_or(false);
        
        let llama_cpp_version = if llama_cpp_installed {
            self.ssh_client.execute_command("llama-cli --version || main --version")
                .ok()
                .and_then(|r| r.stdout.lines().next().map(|s| s.to_string()))
        } else {
            None
        };

        let python_result = self.ssh_client.execute_command("python3 --version");
        let python_installed = python_result.as_ref().map(|r| r.exit_code == 0).unwrap_or(false);
        let python_version = python_result.ok().and_then(|r| {
            if r.exit_code == 0 {
                r.stdout.split_whitespace().nth(1).map(|s| s.to_string())
            } else {
                None
            }
        });

        let cuda_result = self.ssh_client.execute_command("nvidia-smi --query-gpu=name --format=csv,noheader");
        let cuda_available = cuda_result.as_ref().map(|r| r.exit_code == 0).unwrap_or(false);
        let gpu_info = cuda_result.ok().and_then(|r| {
            if r.exit_code == 0 {
                Some(r.stdout.trim().to_string())
            } else {
                None
            }
        });

        let env = LlmEnvironment {
            ollama_installed,
            ollama_version,
            vllm_installed,
            vllm_version,
            llama_cpp_installed,
            llama_cpp_version,
            python_installed,
            python_version,
            cuda_available,
            gpu_info,
        };

        self.emit_progress(1, "Detecting LLM environment", DeploymentStepStatus::Completed, 
            &format!("Ollama: {}, vLLM: {}, Python: {}", 
                if ollama_installed { "✓" } else { "✗" },
                if vllm_installed { "✓" } else { "✗" },
                if python_installed { "✓" } else { "✗" }));

        Ok(env)
    }

    pub fn install_ollama(&self) -> Result<(), String> {
        self.emit_progress(2, "Installing Ollama", DeploymentStepStatus::InProgress, "Downloading and installing Ollama...");

        let install_script = r#"
            curl -fsSL https://ollama.com/install.sh | sh
        "#;

        let result = self.ssh_client.execute_command_with_output(install_script, |output, _channel| {
            self.emit_progress(2, "Installing Ollama", DeploymentStepStatus::InProgress, output);
        })?;

        if result.exit_code != 0 {
            self.emit_progress(2, "Installing Ollama", DeploymentStepStatus::Failed, &result.stderr);
            return Err(format!("Failed to install Ollama: {}", result.stderr));
        }

        self.emit_progress(2, "Installing Ollama", DeploymentStepStatus::Completed, "Ollama installed successfully");
        Ok(())
    }

    pub fn install_vllm(&self) -> Result<(), String> {
        self.emit_progress(2, "Installing vLLM", DeploymentStepStatus::InProgress, "Installing vLLM via pip...");

        let install_cmd = "pip3 install vllm";

        let result = self.ssh_client.execute_command_with_output(install_cmd, |output, _channel| {
            self.emit_progress(2, "Installing vLLM", DeploymentStepStatus::InProgress, output);
        })?;

        if result.exit_code != 0 {
            self.emit_progress(2, "Installing vLLM", DeploymentStepStatus::Failed, &result.stderr);
            return Err(format!("Failed to install vLLM: {}", result.stderr));
        }

        self.emit_progress(2, "Installing vLLM", DeploymentStepStatus::Completed, "vLLM installed successfully");
        Ok(())
    }

    pub fn deploy_clawcode(&self, install_path: &str, config_json: &str) -> Result<DeploymentResult, String> {
        let start = std::time::Instant::now();
        let mut steps = Vec::new();

        self.emit_progress(3, "Creating installation directory", DeploymentStepStatus::InProgress, 
            &format!("Creating directory: {}", install_path));
        
        self.ssh_client.create_remote_directory(install_path)?;
        steps.push(DeploymentStep {
            step: 3,
            name: "Create installation directory".to_string(),
            status: DeploymentStepStatus::Completed,
            message: Some(format!("Created: {}", install_path)),
        });

        self.emit_progress(4, "Uploading ClawCode binary", DeploymentStepStatus::InProgress, 
            "Uploading ClawCode executable...");
        
        let local_binary = std::env::current_exe()
            .map_err(|e| format!("Failed to get current executable: {}", e))?;
        
        let remote_binary = format!("{}/clawcode", install_path);
        self.ssh_client.upload_file(local_binary.to_str().unwrap(), &remote_binary)?;
        
        self.ssh_client.execute_command(&format!("chmod +x {}", remote_binary))?;
        
        steps.push(DeploymentStep {
            step: 4,
            name: "Upload ClawCode binary".to_string(),
            status: DeploymentStepStatus::Completed,
            message: Some(format!("Uploaded to: {}", remote_binary)),
        });

        self.emit_progress(5, "Uploading configuration", DeploymentStepStatus::InProgress, 
            "Uploading configuration file...");
        
        let config_path = format!("{}/config.json", install_path);
        let temp_config = tempfile::NamedTempFile::new()
            .map_err(|e| format!("Failed to create temp file: {}", e))?;
        std::fs::write(temp_config.path(), config_json)
            .map_err(|e| format!("Failed to write config: {}", e))?;
        
        self.ssh_client.upload_file(temp_config.path().to_str().unwrap(), &config_path)?;
        
        steps.push(DeploymentStep {
            step: 5,
            name: "Upload configuration".to_string(),
            status: DeploymentStepStatus::Completed,
            message: Some(format!("Config uploaded to: {}", config_path)),
        });

        self.emit_progress(6, "Creating systemd service", DeploymentStepStatus::InProgress, 
            "Creating systemd service file...");
        
        let service_content = format!(r#"[Unit]
Description=ClawCode CLI Server
After=network.target

[Service]
Type=simple
User={}
WorkingDirectory={}
ExecStart={}/clawcode server --config {}/config.json
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
"#, 
            self.ssh_client.get_username(),
            install_path,
            install_path,
            install_path
        );

        let temp_service = tempfile::NamedTempFile::new()
            .map_err(|e| format!("Failed to create temp file: {}", e))?;
        std::fs::write(temp_service.path(), &service_content)
            .map_err(|e| format!("Failed to write service file: {}", e))?;

        self.ssh_client.upload_file(temp_service.path().to_str().unwrap(), "/tmp/clawcode.service")?;
        self.ssh_client.execute_command("sudo mv /tmp/clawcode.service /etc/systemd/system/")?;
        self.ssh_client.execute_command("sudo systemctl daemon-reload")?;
        
        steps.push(DeploymentStep {
            step: 6,
            name: "Create systemd service".to_string(),
            status: DeploymentStepStatus::Completed,
            message: Some("Service created and enabled".to_string()),
        });

        self.emit_progress(7, "Starting ClawCode service", DeploymentStepStatus::InProgress, 
            "Starting ClawCode service...");
        
        let start_result = self.ssh_client.execute_command("sudo systemctl start clawcode")?;
        if start_result.exit_code != 0 {
            self.emit_progress(7, "Starting ClawCode service", DeploymentStepStatus::Failed, &start_result.stderr);
            steps.push(DeploymentStep {
                step: 7,
                name: "Start ClawCode service".to_string(),
                status: DeploymentStepStatus::Failed,
                message: Some(start_result.stderr.clone()),
            });
            
            return Ok(DeploymentResult {
                success: false,
                steps,
                error: Some(format!("Failed to start service: {}", start_result.stderr)),
                elapsed_ms: start.elapsed().as_millis() as u64,
            });
        }

        self.ssh_client.execute_command("sudo systemctl enable clawcode")?;
        
        steps.push(DeploymentStep {
            step: 7,
            name: "Start ClawCode service".to_string(),
            status: DeploymentStepStatus::Completed,
            message: Some("Service started and enabled".to_string()),
        });

        self.emit_progress(8, "Verifying deployment", DeploymentStepStatus::InProgress, 
            "Checking service status...");
        
        std::thread::sleep(std::time::Duration::from_secs(3));
        
        let status_result = self.ssh_client.execute_command("sudo systemctl is-active clawcode")?;
        let is_active = status_result.stdout.trim() == "active";

        steps.push(DeploymentStep {
            step: 8,
            name: "Verify deployment".to_string(),
            status: if is_active { DeploymentStepStatus::Completed } else { DeploymentStepStatus::Failed },
            message: Some(if is_active { "Service is running".to_string() } else { "Service is not running".to_string() }),
        });

        self.emit_progress(8, "Verifying deployment", 
            if is_active { DeploymentStepStatus::Completed } else { DeploymentStepStatus::Failed },
            if is_active { "✓ Service is running" } else { "✗ Service is not running" });

        Ok(DeploymentResult {
            success: is_active,
            steps,
            error: if is_active { None } else { Some("Service failed to start".to_string()) },
            elapsed_ms: start.elapsed().as_millis() as u64,
        })
    }

    pub fn full_deployment(
        &self,
        install_path: &str,
        config_json: &str,
        preferred_llm: &str,
    ) -> Result<DeploymentResult, String> {
        let llm_env = self.detect_llm_environment()?;

        if preferred_llm == "ollama" && !llm_env.ollama_installed {
            self.install_ollama()?;
        } else if preferred_llm == "vllm" && !llm_env.vllm_installed {
            if !llm_env.python_installed {
                return Err("Python is required for vLLM but not installed".to_string());
            }
            self.install_vllm()?;
        }

        self.deploy_clawcode(install_path, config_json)
    }
}
