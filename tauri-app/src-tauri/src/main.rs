#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod models;

use cli_server::{run_server, ServerConfig};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            commands::ssh_commands::test_ssh_connection,
            commands::ssh_commands::deploy_cli_server,
            commands::ssh_commands::save_ssh_connection,
            commands::ssh_commands::list_ssh_connections,
            commands::ssh_commands::delete_ssh_connection,
            commands::config_commands::get_config,
            commands::config_commands::save_config,
            commands::config_commands::validate_api_key,
            commands::config_commands::test_api_connection,
            commands::connection_commands::check_connection_health,
            commands::connection_commands::ping_host,
        ])
        .setup(|_app| {
            tauri::async_runtime::spawn(async move {
                let config = ServerConfig::default();
                
                tracing_subscriber::fmt()
                    .with_env_filter("cli_server=info,clawcode=info")
                    .init();
                
                println!("🚀 Starting ClawCode CLI Server...");
                println!("   REST API: http://{}:{}", config.host, config.rest_port);
                println!("   WebSocket: ws://{}:{}/ws", config.host, config.rest_port);
                
                if let Err(e) = run_server(config).await {
                    eprintln!("❌ CLI Server error: {}", e);
                }
            });
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
