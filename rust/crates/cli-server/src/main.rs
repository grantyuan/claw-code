use cli_server::{run_server, ServerConfig};
use std::env;

fn main() {
    let rt = tokio::runtime::Runtime::new().expect("Failed to create Tokio runtime");
    
    rt.block_on(async {
        let config = ServerConfig {
            ws_port: env::var("WS_PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(8765),
            rest_port: env::var("REST_PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(8766),
            host: env::var("HOST")
                .unwrap_or_else(|_| "0.0.0.0".to_string()),
        };

        println!("ClawCode CLI Server v{}", env!("CARGO_PKG_VERSION"));
        println!("REST API: http://{}:{}", config.host, config.rest_port);
        println!("WebSocket: ws://{}:{}", config.host, config.rest_port);

        if let Err(e) = run_server(config).await {
            eprintln!("Server error: {}", e);
            std::process::exit(1);
        }
    });
}
