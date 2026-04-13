# ClawCode Tauri App

A modern desktop application for managing AI agents and remote deployments, built with Tauri 2, Svelte 5, and Rust.

## Overview

ClawCode is a cross-platform desktop application that provides a graphical interface for interacting with AI agents, managing remote SSH connections, and orchestrating tasks. The application features a split-panel interface with agent management on the left and a chat/task interface on the right.

## Tech Stack

### Frontend

- **Svelte 5** - Modern reactive UI framework with runes
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS 4** - Utility-first CSS framework
- **Vite 8** - Fast build tool and dev server

### Backend

- **Rust** - Systems programming language
- **Tauri 2** - Lightweight cross-platform desktop framework
- **Tokio** - Async runtime for Rust
- **Reqwest** - HTTP client library

### Testing

- **Vitest** - Unit testing framework
- **Testing Library** - Svelte testing utilities

## Features

- **Agent Management**: Create and manage AI agent instances
- **SSH Connections**: Save, test, and manage SSH connection profiles
- **Remote Deployment**: Deploy CLI servers to remote hosts via SSH
- **Task Orchestration**: Create, monitor, and cancel tasks
- **Chat Interface**: Interact with AI agents through a chat UI
- **Configuration Management**: Persistent settings with API key validation
- **Theme Support**: Light and dark mode with system preference detection
- **Responsive Panels**: Collapsible and resizable split-panel layout

## Project Structure

```
tauri-app/
├── src/                          # Frontend source code
│   ├── lib/
│   │   ├── components/
│   │   │   ├── common/          # Reusable UI components
│   │   │   │   ├── Button.svelte
│   │   │   │   ├── Modal.svelte
│   │   │   │   ├── ProgressBar.svelte
│   │   │   │   ├── StatusBadge.svelte
│   │   │   │   └── Toast.svelte
│   │   │   ├── panels/          # Main layout panels
│   │   │   │   ├── LeftPanel.svelte
│   │   │   │   └── RightPanel.svelte
│   │   │   └── settings/        # Settings UI
│   │   │       └── SettingsPanel.svelte
│   │   ├── services/            # API and WebSocket services
│   │   │   ├── apiService.ts
│   │   │   └── webSocketService.ts
│   │   ├── stores/              # Svelte stores for state management
│   │   │   ├── agentStore.ts
│   │   │   ├── chatStore.ts
│   │   │   ├── configStore.ts
│   │   │   ├── connectionStore.ts
│   │   │   ├── taskStore.ts
│   │   │   └── uiStore.ts
│   │   ├── types/               # TypeScript type definitions
│   │   │   ├── agent.ts
│   │   │   ├── config.ts
│   │   │   ├── connection.ts
│   │   │   ├── message.ts
│   │   │   └── task.ts
│   │   └── utils/               # Utility functions
│   │       ├── constants.ts
│   │       ├── formatting.ts
│   │       └── validation.ts
│   ├── static/
│   │   └── styles/
│   │       └── global.css       # Global styles
│   ├── App.svelte               # Root component
│   └── main.ts                  # Application entry point
├── src-tauri/                   # Rust backend
│   ├── src/
│   │   ├── commands/            # Tauri command handlers
│   │   │   ├── config_commands.rs
│   │   │   ├── connection_commands.rs
│   │   │   └── ssh_commands.rs
│   │   ├── models/              # Data models
│   │   │   ├── config.rs
│   │   │   ├── connection.rs
│   │   │   └── deployment.rs
│   │   └── main.rs              # Rust entry point
│   ├── icons/                   # Application icons
│   ├── Cargo.toml               # Rust dependencies
│   └── tauri.conf.json          # Tauri configuration
├── tests/                       # Test files
│   └── unit/
│       ├── config.test.ts
│       ├── stores.test.ts
│       ├── theme.test.ts
│       ├── types.test.ts
│       └── utils.test.ts
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── svelte.config.js
└── tsconfig.json
```

## Prerequisites

- **Node.js** >= 18
- **Rust** >= 1.70
- **npm** or **pnpm**

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd claw-code/tauri-app
   ```
2. Install frontend dependencies:
   ```bash
   npm install
   ```
3. Install Rust dependencies (handled automatically by Tauri)

## Development

### Start Development Server

```bash
npm run tauri dev
```

This command:

- Starts the Vite dev server on `http://localhost:5173`
- Launches the Tauri application in development mode
- Starts the embedded CLI server on `ws://localhost:8765`

### Build for Production

```bash
npm run tauri build
```

This creates platform-specific installers in `src-tauri/target/release/bundle/`.

### Run Tests

```bash
# Run tests once
npm test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

### Code Quality

```bash
# Type checking
npm run typecheck

# Linting
npm run lint
```

## Architecture

### Frontend Architecture

The frontend follows a **store-based architecture** using Svelte 5 stores:

- **agentStore**: Manages AI agent instances and their states
- **chatStore**: Handles chat messages and conversation history
- **configStore**: Persists application configuration
- **connectionStore**: Manages SSH and local connections
- **taskStore**: Tracks task execution and status
- **uiStore**: Controls UI state (theme, panel layout, modals)

### Backend Architecture

The Rust backend provides:

1. **Tauri Commands**: IPC handlers for frontend-backend communication
   - SSH operations (connect, deploy, save connections)
   - Configuration management
   - Connection health checks
2. **Embedded Server**: A CLI server runs within the Tauri application
   - REST API on `http://localhost:8765`
   - WebSocket endpoint at `ws://localhost:8765/ws`

### Data Flow

```
Frontend (Svelte) ←→ Tauri Commands ←→ Rust Backend
      ↓
API Service ←→ Embedded CLI Server (REST/WebSocket)
      ↓
Remote SSH Connections
```

## Configuration

### Tauri Configuration

Edit `src-tauri/tauri.conf.json` to customize:

- Window dimensions and behavior
- Application identifier
- Build settings
- Security policies

### Application Configuration

User settings are persisted locally and managed through:

- `configStore` (frontend)
- `config_commands.rs` (backend)

## API Endpoints

The embedded CLI server provides:

- `GET /api/health` - Health check
- `GET /api/agents` - List agents
- `GET /api/tasks` - List tasks
- `POST /api/tasks` - Create task
- `DELETE /api/tasks/:id` - Cancel task
- `GET /api/config` - Get configuration
- `PUT /api/config` - Update configuration
- `POST /api/chat/message` - Send chat message
- `POST /api/deploy` - Deploy to remote host

## Development Scripts

- `dev-setup.sh` - Development environment setup script
- `run.sh` - Quick start script

## Contributing

1. Follow the existing code style
2. Write tests for new features
3. Ensure all tests pass before submitting PRs
4. Update documentation as needed

## License

MIT License - See LICENSE file for details

## Authors

ClawCode Team
