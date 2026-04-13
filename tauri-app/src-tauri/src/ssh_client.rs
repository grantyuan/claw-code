use ssh2::Session;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::Path;
use std::sync::{Arc, Mutex};

#[derive(Debug, Clone, serde::Serialize)]
pub struct SshOutput {
    pub channel: String,
    pub content: String,
    pub timestamp: u64,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct CommandResult {
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
}

pub struct SshClient {
    session: Arc<Mutex<Option<Session>>>,
    host: String,
    port: u16,
    username: String,
}

impl SshClient {
    pub fn new(host: String, port: u16, username: String) -> Self {
        Self {
            session: Arc::new(Mutex::new(None)),
            host,
            port,
            username,
        }
    }

    pub fn connect_with_password(&mut self, password: &str) -> Result<(), String> {
        let addr = format!("{}:{}", self.host, self.port);
        let tcp = TcpStream::connect(&addr)
            .map_err(|e| format!("Failed to connect to {}: {}", addr, e))?;

        let mut sess = Session::new()
            .map_err(|e| format!("Failed to create SSH session: {}", e))?;
        
        sess.set_tcp_stream(tcp);
        sess.handshake()
            .map_err(|e| format!("SSH handshake failed: {}", e))?;

        sess.userauth_password(&self.username, password)
            .map_err(|e| format!("SSH authentication failed: {}", e))?;

        if !sess.authenticated() {
            return Err("SSH authentication failed".to_string());
        }

        let mut session_lock = self.session.lock()
            .map_err(|e| format!("Failed to lock session: {}", e))?;
        *session_lock = Some(sess);

        Ok(())
    }

    pub fn connect_with_key(&mut self, key_path: &str, passphrase: Option<&str>) -> Result<(), String> {
        let addr = format!("{}:{}", self.host, self.port);
        let tcp = TcpStream::connect(&addr)
            .map_err(|e| format!("Failed to connect to {}: {}", addr, e))?;

        let mut sess = Session::new()
            .map_err(|e| format!("Failed to create SSH session: {}", e))?;
        
        sess.set_tcp_stream(tcp);
        sess.handshake()
            .map_err(|e| format!("SSH handshake failed: {}", e))?;

        let expanded_key_path = shellexpand::tilde(key_path);
        let key_path = Path::new(expanded_key_path.as_ref());

        sess.userauth_pubkey_file(
            &self.username,
            None,
            key_path,
            passphrase,
        )
        .map_err(|e| format!("SSH key authentication failed: {}", e))?;

        if !sess.authenticated() {
            return Err("SSH authentication failed".to_string());
        }

        let mut session_lock = self.session.lock()
            .map_err(|e| format!("Failed to lock session: {}", e))?;
        *session_lock = Some(sess);

        Ok(())
    }

    pub fn disconnect(&mut self) -> Result<(), String> {
        let mut session_lock = self.session.lock()
            .map_err(|e| format!("Failed to lock session: {}", e))?;
        
        if let Some(sess) = session_lock.take() {
            sess.disconnect(None, "Closing connection", None)
                .map_err(|e| format!("Failed to disconnect: {}", e))?;
        }

        Ok(())
    }

    pub fn execute_command(&self, command: &str) -> Result<CommandResult, String> {
        let session_lock = self.session.lock()
            .map_err(|e| format!("Failed to lock session: {}", e))?;
        
        let sess = session_lock.as_ref()
            .ok_or("Not connected to SSH server")?;

        let mut channel = sess.channel_session()
            .map_err(|e| format!("Failed to create channel: {}", e))?;

        channel.exec(command)
            .map_err(|e| format!("Failed to execute command: {}", e))?;

        let mut stdout = String::new();
        let mut stderr = String::new();

        channel.read_to_string(&mut stdout)
            .map_err(|e| format!("Failed to read stdout: {}", e))?;

        channel.stderr().read_to_string(&mut stderr)
            .map_err(|e| format!("Failed to read stderr: {}", e))?;

        channel.wait_close()
            .map_err(|e| format!("Failed to close channel: {}", e))?;

        let exit_code = channel.exit_status().unwrap_or(-1);

        Ok(CommandResult {
            exit_code,
            stdout,
            stderr,
        })
    }

    pub fn execute_command_with_output<F>(&self, command: &str, mut output_callback: F) -> Result<CommandResult, String>
    where
        F: FnMut(&str, &str),
    {
        let session_lock = self.session.lock()
            .map_err(|e| format!("Failed to lock session: {}", e))?;
        
        let sess = session_lock.as_ref()
            .ok_or("Not connected to SSH server")?;

        let mut channel = sess.channel_session()
            .map_err(|e| format!("Failed to create channel: {}", e))?;

        channel.exec(command)
            .map_err(|e| format!("Failed to execute command: {}", e))?;

        let mut stdout = String::new();
        let mut stderr = String::new();
        let mut buffer = [0u8; 4096];

        loop {
            let len = channel.read(&mut buffer)
                .map_err(|e| format!("Failed to read from channel: {}", e))?;
            
            if len == 0 {
                break;
            }

            let output = String::from_utf8_lossy(&buffer[..len]);
            stdout.push_str(&output);
            output_callback(&output, "stdout");
        }

        let mut stderr_buffer = [0u8; 4096];
        loop {
            let len = channel.stderr().read(&mut stderr_buffer)
                .map_err(|e| format!("Failed to read stderr: {}", e))?;
            
            if len == 0 {
                break;
            }

            let output = String::from_utf8_lossy(&stderr_buffer[..len]);
            stderr.push_str(&output);
            output_callback(&output, "stderr");
        }

        channel.wait_close()
            .map_err(|e| format!("Failed to close channel: {}", e))?;

        let exit_code = channel.exit_status().unwrap_or(-1);

        Ok(CommandResult {
            exit_code,
            stdout,
            stderr,
        })
    }

    pub fn upload_file(&self, local_path: &str, remote_path: &str) -> Result<(), String> {
        let session_lock = self.session.lock()
            .map_err(|e| format!("Failed to lock session: {}", e))?;
        
        let sess = session_lock.as_ref()
            .ok_or("Not connected to SSH server")?;

        let local_content = std::fs::read(local_path)
            .map_err(|e| format!("Failed to read local file: {}", e))?;

        let sftp = sess.sftp()
            .map_err(|e| format!("Failed to create SFTP session: {}", e))?;

        let remote_path = Path::new(remote_path);
        
        if let Some(parent) = remote_path.parent() {
            self.create_remote_directory(parent.to_str().unwrap())?;
        }

        let mut remote_file = sftp.create(remote_path)
            .map_err(|e| format!("Failed to create remote file: {}", e))?;

        remote_file.write_all(&local_content)
            .map_err(|e| format!("Failed to write to remote file: {}", e))?;

        Ok(())
    }

    pub fn download_file(&self, remote_path: &str, local_path: &str) -> Result<(), String> {
        let session_lock = self.session.lock()
            .map_err(|e| format!("Failed to lock session: {}", e))?;
        
        let sess = session_lock.as_ref()
            .ok_or("Not connected to SSH server")?;

        let sftp = sess.sftp()
            .map_err(|e| format!("Failed to create SFTP session: {}", e))?;

        let remote_path = Path::new(remote_path);
        let mut remote_file = sftp.open(remote_path)
            .map_err(|e| format!("Failed to open remote file: {}", e))?;

        let mut content = Vec::new();
        remote_file.read_to_end(&mut content)
            .map_err(|e| format!("Failed to read remote file: {}", e))?;

        std::fs::write(local_path, content)
            .map_err(|e| format!("Failed to write local file: {}", e))?;

        Ok(())
    }

    pub fn create_remote_directory(&self, path: &str) -> Result<(), String> {
        let result = self.execute_command(&format!("mkdir -p {}", path))?;
        if result.exit_code != 0 {
            return Err(format!("Failed to create directory: {}", result.stderr));
        }
        Ok(())
    }

    pub fn file_exists(&self, path: &str) -> Result<bool, String> {
        let result = self.execute_command(&format!("test -f {}", path))?;
        Ok(result.exit_code == 0)
    }

    pub fn directory_exists(&self, path: &str) -> Result<bool, String> {
        let result = self.execute_command(&format!("test -d {}", path))?;
        Ok(result.exit_code == 0)
    }

    pub fn get_system_info(&self) -> Result<SystemInfo, String> {
        let uname_result = self.execute_command("uname -a")?;
        let os_info = uname_result.stdout.trim().to_string();

        let os_type = if os_info.contains("Linux") {
            "Linux"
        } else if os_info.contains("Darwin") {
            "macOS"
        } else {
            "Unknown"
        };

        let arch_result = self.execute_command("uname -m")?;
        let arch = arch_result.stdout.trim().to_string();

        let cpu_result = self.execute_command("nproc")?;
        let cpu_cores = cpu_result.stdout.trim().parse().unwrap_or(1);

        let mem_result = self.execute_command("free -g | awk '/^Mem:/{print $2}'")?;
        let memory_gb = mem_result.stdout.trim().parse().unwrap_or(0);

        Ok(SystemInfo {
            os_type: os_type.to_string(),
            os_info,
            arch,
            cpu_cores,
            memory_gb,
        })
    }

    pub fn is_connected(&self) -> bool {
        if let Ok(session_lock) = self.session.lock() {
            session_lock.is_some()
        } else {
            false
        }
    }

    pub fn get_username(&self) -> &str {
        &self.username
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct SystemInfo {
    pub os_type: String,
    pub os_info: String,
    pub arch: String,
    pub cpu_cores: usize,
    pub memory_gb: usize,
}
