# ClawCode Tauri Application Design

**Date**: 2026-04-09
**Status**: Approved
**Architecture**: Microservices-Style with Central Hub

## Executive Summary

This document outlines the design for a Tauri-based desktop application for ClawCode, featuring a dual-panel interface for AI agent interaction and monitoring, with support for remote CLI servers, SSH-based deployment, and P2P agent cooperation.

## 1. Overall Architecture

### System Components

**1. Tauri Application (GUI Hub)**
- Svelte + TypeScript frontend with dual-panel interface
- Rust backend for SSH operations and system integration
- Connection manager for multiple CLI servers
- Configuration manager with secure credential storage

**2. CLI Server Mode (Enhanced Existing CLI)**
- WebSocket server for real-time communication
- REST API for configuration and control
- P2P communication module for inter-agent cooperation
- Auto-deployment capability via SSH

**3. Remote Deployment System**
- SSH client integration in Tauri backend
- Automated CLI installation script
- Health monitoring and auto-restart
- Version management and updates

**4. P2P Communication Layer**
- libp2p or similar for peer-to-peer messaging
- Task distribution protocol
- Agent discovery and coordination
- Secure channel encryption

### Data Flow

```
User Input (Left Panel)
    ↓
Tauri App (Hub)
    ↓
Route to appropriate CLI Server (local/remote)
    ↓
CLI Server processes with specialized agents
    ↓
Real-time updates via WebSocket
    ↓
Right Panel displays agent status
    ↓
P2P coordination if multi-computer task
```

## 2. Dual-Panel Interface Design

### Left Panel: Claw-User Interaction Interface

**Chat Interface Features:**
- Message input area with multiline support
- Conversation history with scrollable timeline
- Message types: user, AI response, system notifications
- Code blocks with syntax highlighting
- File attachment support
- Voice input button (optional)
- Quick action buttons (clear, export, retry)

**Leader Agent Display:**
- Always visible in left panel
- Shows current conversation with the primary agent
- Status indicator (active, thinking, idle, error)
- Model being used (e.g., "Claude-3 Opus", "GPT-4")
- Token usage and cost tracking
- Response streaming in real-time

### Right Panel: Agent Operation Tracking Dashboard

**Default View (Leader Agent Overview):**
- Active agents list with status badges
  - Color coding: green (active), yellow (thinking), blue (idle), red (error)
  - Agent role icons (coder, reviewer, tester, etc.)
  - Current task description
- Completed tasks section
  - Timestamp and duration
  - Success/failure indicator
  - Quick view of results
- Pending tasks queue
  - Priority indicators (high/medium/low)
  - Estimated completion time
  - Dependencies shown
- Progress visualization
  - Overall progress bar
  - Per-agent progress bars
  - Real-time percentage updates

**Agent Detail View (when clicking an agent):**
- Agent-specific conversation/output
- Task history for this agent
- Performance metrics
- Resource usage (CPU, memory, tokens)
- Back button and ESC key to return to default view

**Multi-Computer View:**
- Computer selector dropdown
- Per-computer agent status
- Network latency indicators
- Connection health status

## 3. Configuration Interface

### Settings Panel Structure

**Persistent Settings Button:**
- Gear icon in top-right corner (always visible)
- Badge indicator for unsaved changes
- Keyboard shortcut access (Ctrl+, or Cmd+,)

**Configuration Sections (Tabbed Interface):**

**Tab 1: AI Model Configuration**
- API endpoint URLs with validation
  - Format check for HTTP/HTTPS
  - Connection test button
  - Timeout settings
- API credentials (secure storage)
  - Text fields with password masking
  - Show/hide toggle
  - Test connection button
- Model selection dropdowns
  - Primary model
  - Fallback models
  - Local models (Ollama, etc.)
- Advanced parameters
  - Temperature slider (0.0 - 2.0)
  - Max tokens slider/input
  - Top-p slider
  - Frequency penalty slider
  - Presence penalty slider

**Tab 2: Agent Behavior & Roles**
- Agent role definitions
  - Coder, Reviewer, Tester, Planner, etc.
  - Custom agent creation form
  - Role-specific configurations
- Collaboration patterns
  - Sequential vs parallel execution
  - Task assignment rules
  - Conflict resolution strategy
- Behavior parameters
  - Autonomy level slider
  - Verification requirements toggles
  - Approval workflow settings

**Tab 3: RAG & Knowledge Base**
- Document repositories configuration
  - Add/remove knowledge sources
  - File path or URL inputs
  - Sync frequency settings
- Embedding model selection
- Retrieval parameters
  - Top-k results slider
  - Similarity threshold
- Vector database settings
  - Connection details
  - Index management

**Tab 4: MCP & Tools Integration**
- MCP server connections
  - Server URL/endpoint config
  - Authentication settings
  - Enable/disable toggles
- Tool permissions
  - Tool availability matrix per agent
  - Safety restrictions
  - Rate limiting
- Custom tool registration
  - Tool definition forms
  - Schema validation

**Tab 5: Memory & Context**
- Conversation memory settings
  - Maximum context window size
  - Summary compression options
  - History retention period
- Project memory
  - Working directory configuration
  - File watching rules
  - Auto-discovery settings
- Additional memory stores
  - Database connections
  - Cache configuration

**Tab 6: Remote Computers & SSH Deployment**
- **SSH Connection Manager:**
  - Add/Edit/Delete remote computers
  - Fields:
    - Display name (text)
    - Host/IP address (with validation)
    - Port number (default 22)
    - Username (text)
    - Authentication method:
      - Password (encrypted storage)
      - SSH key path (file picker)
      - Key passphrase if needed
    - Connection test button
    - Ping/latency display
  
- **Auto-Deployment Settings:**
  - Deploy CLI server to remote machine
  - Version selector (which version to deploy)
  - Installation path configuration
  - Auto-start on boot toggle
  - Health check interval
  - Update policy (auto-update, manual, notify only)
  
- **Deployment Workflow UI:**
  - Step-by-step deployment wizard
  - Progress indicators for each step:
    1. SSH connection establishment
    2. Environment check (Rust toolchain, dependencies)
    3. Download/install CLI binary
    4. Configure server mode
    5. Start server service
    6. Verify connectivity back to hub
  - Rollback capability
  - Deployment logs viewer

**Tab 7: P2P Network Configuration**
- Network settings
  - Peer discovery method
  - Relay servers
  - NAT traversal options
- Security
  - Encryption settings
  - Peer authentication
  - Access control lists

**Tab 8: UI/UX Preferences**
- Theme selection (Dark/Light/System)
- Font size and family
- Panel layout options
  - Panel sizes (draggable divider)
  - Collapsible panels
- Notification preferences
  - Sound alerts
  - Desktop notifications
  - In-app notifications
- Keyboard shortcuts customization
- Language selection

**Tab 9: Project/Workspace Settings**
- Default working directory
- Git integration
  - Repository paths
  - Auto-commit settings
  - Branch management
- Environment variables
- Project templates

### Form Validation & Error Handling
- Real-time field validation with visual feedback
- Required field indicators
- Format validation (URLs, IPs, ports, paths)
- Cross-field validation (e.g., port range checks)
- Warning messages for non-critical issues
- Error messages with actionable suggestions
- Confirmation dialogs for destructive actions
- Save/Cancel buttons with unsaved changes detection
- Export/Import configuration (JSON format)

## 4. Technical Architecture

### Technology Stack

**Frontend:**
- **Framework**: Svelte 5 + TypeScript
- **State Management**: Svelte stores with WebSocket sync
- **Styling**: TailwindCSS with dark/light theme support
- **UI Components**: Custom components with high-tech aesthetic
- **Real-time Communication**: WebSocket client for live updates
- **Code Highlighting**: Shiki or Prism for code blocks
- **Icons**: Lucide or Heroicons
- **Charts**: Chart.js or D3.js for progress visualization

**Backend (Tauri):**
- **Core**: Tauri v2 with Rust backend
- **HTTP Client**: reqwest for REST API calls
- **WebSocket**: tokio-tungstenite for WS connections
- **SSH**: russh for SSH operations and remote deployment
- **Serialization**: serde + serde_json
- **Secure Storage**: keyring or Tauri's secure storage plugin
- **Async Runtime**: tokio
- **P2P**: libp2p-rs or custom implementation

**CLI Server Enhancements:**
- **WebSocket Server**: axum with websocket support
- **REST API**: axum framework
- **P2P Module**: libp2p integration
- **Process Management**: daemon mode with systemd service generation

### Project Structure

```
claw-code/
├── tauri-app/                          # New Tauri application
│   ├── src/                            # Svelte frontend source
│   │   ├── lib/
│   │   │   ├── stores/                 # Svelte state management
│   │   │   │   ├── agentStore.ts       # Agent status store
│   │   │   │   ├── chatStore.ts        # Conversation store
│   │   │   │   ├── configStore.ts      # Configuration store
│   │   │   │   ├── connectionStore.ts  # Connection management
│   │   │   │   └── uiStore.ts          # UI state store
│   │   │   ├── components/
│   │   │   │   ├── panels/
│   │   │   │   │   ├── LeftPanel.svelte      # Chat interface
│   │   │   │   │   └── RightPanel.svelte     # Agent dashboard
│   │   │   │   ├── agents/
│   │   │   │   │   ├── AgentList.svelte      # Active agents list
│   │   │   │   │   ├── AgentCard.svelte      # Individual agent card
│   │   │   │   │   └── AgentDetail.svelte    # Detailed view
│   │   │   │   ├── tasks/
│   │   │   │   │   ├── TaskList.svelte       # Task list component
│   │   │   │   │   ├── TaskItem.svelte       # Individual task item
│   │   │   │   │   └── ProgressBar.svelte    # Progress visualization
│   │   │   │   ├── settings/
│   │   │   │   │   ├── SettingsPanel.svelte  # Main settings container
│   │   │   │   │   └── tabs/                 # Settings tab components
│   │   │   │   ├── chat/
│   │   │   │   │   ├── MessageInput.svelte   # Input area
│   │   │   │   │   ├── MessageList.svelte    # Conversation history
│   │   │   │   │   └── MessageBubble.svelte  # Individual message
│   │   │   │   └── common/
│   │   │   │       ├── StatusBadge.svelte    # Status indicators
│   │   │   │       ├── Modal.svelte          # Dialog/modal
│   │   │   │       └── Toast.svelte          # Notifications
│   │   │   ├── services/
│   │   │   │   ├── apiService.ts             # API communication
│   │   │   │   ├── webSocketService.ts       # WebSocket management
│   │   │   │   └── sshService.ts             # SSH operations (Tauri commands)
│   │   │   ├── types/
│   │   │   │   ├── agent.ts                  # Agent type definitions
│   │   │   │   ├── task.ts                   # Task type definitions
│   │   │   │   ├── config.ts                 # Configuration types
│   │   │   │   └── connection.ts             # Connection types
│   │   │   ├── utils/
│   │   │   │   ├── validation.ts             # Form validation utilities
│   │   │   │   ├── formatting.ts             # Data formatting helpers
│   │   │   │   └── constants.ts              # App constants
│   │   │   └── App.svelte                    # Root component
│   │   ├── tests/
│   │   │   ├── unit/                         # Unit tests
│   │   │   ├── integration/                  # Integration tests
│   │   │   └── e2e/                          # End-to-end tests
│   │   └── static/                           # Static assets
│   │       └── styles/
│   │           └── global.css                # Global styles + Tailwind
│   ├── src-tauri/
│   │   ├── src/
│   │   │   ├── main.rs                       # Tauri entry point
│   │   │   ├── commands/
│   │   │   │   ├── mod.rs
│   │   │   │   ├── ssh_commands.rs           # SSH operations
│   │   │   │   ├── config_commands.rs        # Config CRUD operations
│   │   │   │   ├── connection_commands.rs    # Connection management
│   │   │   │   └── system_commands.rs         # System-level operations
│   │   │   ├── services/
│   │   │   │   ├── mod.rs
│   │   │   │   ├── ssh_service.rs            # SSH client service
│   │   │   │   ├── deployment_service.rs     # Remote deployment logic
│   │   │   │   ├── config_service.rs         # Configuration persistence
│   │   │   │   └── secure_storage.rs         # Credential encryption
│   │   │   ├── models/
│   │   │   │   ├── mod.rs
│   │   │   │   ├── config.rs                 # Config data structures
│   │   │   │   ├── connection.rs             # Connection models
│   │   │   │   └── deployment.rs             # Deployment models
│   │   │   └── error.rs                      # Error handling
│   │   ├── Cargo.toml
│   │   └── tauri.conf.json
│   ├── package.json
│   ├── svelte.config.js
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── tsconfig.json
├── rust/                               # Existing Rust workspace (enhanced)
│   └── crates/
│       ├── rusty-claude-cli/
│       │   └── src/
│       │       ├── server.rs             # NEW: WebSocket server mode
│       │       ├── rest_api.rs           # NEW: REST API endpoints
│       │       └── p2p_module.rs         # NEW: P2P communication
│       └── cli-server/                  # NEW: Standalone server crate
│           ├── Cargo.toml
│           └── src/
│               ├── main.rs              # Server entry point
│               ├── ws_handler.rs         # WebSocket handling
│               ├── rest_handler.rs       # REST endpoint handlers
│               ├── p2p_handler.rs        # P2P coordination
│               └── agent_manager.rs      # Agent lifecycle management
├── docs/
│   └── plans/
│       └── 2026-04-09-clawcode-tauri-design.md  # This design document
└── tests/
    └── tauri-app-tests/                 # Cross-cutting test suite
```

### State Management Architecture

**Svelte Store Hierarchy:**
```
App State (Root)
├── UI State
│   ├── Theme (dark/light/system)
│   ├── Panel layout (sizes, visibility)
│   ├── Active view (default/agent-detail)
│   └── Modal/dialog state
├── Connection State
│   ├── Local CLI server (connected/disconnected)
│   ├── Remote servers list
│   ├── Current active connection
│   └── Connection health metrics
├── Chat State
│   ├── Conversations map
│   ├── Active conversation ID
│   ├── Streaming message buffer
│   └── Message history
├── Agent State
│   ├── Agents map (by ID)
│   ├── Leader agent reference
│   ├── Selected agent for detail view
│   └── Agent statuses (real-time)
├── Task State
│   ├── Active tasks queue
│   ├── Completed tasks history
│   ├── Pending tasks queue
│   └── Task progress tracking
└── Config State
    ├── All configuration sections
    ├── Validation state
    ├── Unsaved changes flag
    └── Deployment configurations
```

**WebSocket Event Types:**
```typescript
// Server → Client events
type WSEvent = 
  | { type: 'agent_status_update'; payload: AgentStatus }
  | { type: 'task_update'; payload: TaskUpdate }
  | { type: 'message_chunk'; payload: StreamChunk }
  | { type: 'agent_created'; payload: AgentInfo }
  | { type: 'task_completed'; payload: TaskResult }
  | { type: 'error'; payload: ErrorInfo }
  | { type: 'system_notification'; payload: Notification }
  | { type: 'p2p_message'; payload: P2PMessage };

// Client → Server commands
type WSCommand = 
  | { type: 'send_message'; payload: UserMessage }
  | { type: 'create_task'; payload: TaskRequest }
  | { type: 'cancel_task'; payload: TaskId }
  | { type: 'configure_agent'; payload: AgentConfig }
  | { type: 'request_agent_detail'; payload: AgentId };
```

## 5. Error Handling, Testing & Performance

### Error Handling Strategy

**Frontend Error Handling:**
- **Network Errors**: Automatic reconnection with exponential backoff
  - Display connection status indicator
  - Queue messages during disconnection
  - Retry failed requests (configurable retry count)
- **Validation Errors**: Real-time feedback with inline messages
- **WebSocket Errors**: Graceful degradation to REST API polling
- **UI Errors**: Error boundaries to prevent app crashes
  - Fallback UI components
  - Error reporting to user with actionable messages

**Backend Error Handling:**
- **SSH Connection Errors**: 
  - Timeout handling with configurable limits
  - Authentication failure reporting
  - Network unreachable detection
  - Retry logic with user notification
- **Deployment Errors**:
  - Pre-flight checks (Rust toolchain, dependencies)
  - Rollback on failure
  - Detailed error logs
  - Partial deployment recovery
- **Configuration Errors**:
  - Validation before save
  - Backup previous config
  - Migration support for config version changes

**CLI Server Error Handling:**
- **Agent Crashes**: Automatic restart with state recovery
- **Model API Errors**: Fallback to alternative models
- **Resource Exhaustion**: Graceful degradation, task queueing
- **P2P Network Errors**: Relay server fallback

### Testing Strategy (TDD Approach)

**Unit Tests (Target: 80%+ coverage):**

**Frontend Unit Tests:**
```typescript
// Example test structure
describe('AgentStore', () => {
  it('should update agent status on WebSocket event', () => {
    // Test agent status updates
  });
  
  it('should handle multiple agents concurrently', () => {
    // Test concurrent agent management
  });
  
  it('should persist state to localStorage', () => {
    // Test state persistence
  });
});

describe('ValidationUtils', () => {
  it('should validate SSH credentials format', () => {
    // Test SSH config validation
  });
  
  it('should validate API endpoints', () => {
    // Test URL validation
  });
});
```

**Backend Unit Tests:**
```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_ssh_connection_timeout() {
        // Test SSH connection timeout handling
    }
    
    #[test]
    fn test_config_validation() {
        // Test configuration validation logic
    }
    
    #[test]
    fn test_deployment_rollback() {
        // Test deployment failure rollback
    }
}
```

**Integration Tests:**
- **Panel Interactions**: Test left/right panel coordination
  - Agent selection updates detail view
  - Task creation triggers agent assignment
  - Real-time updates across panels
- **WebSocket Communication**: Test bidirectional messaging
  - Message streaming
  - Event broadcasting
  - Connection recovery
- **SSH Deployment Flow**: End-to-end deployment testing
  - Mock SSH server for testing
  - Deployment script execution
  - Service startup verification
- **Configuration Persistence**: Test save/load cycles
  - Config validation
  - Secure credential storage
  - Migration scenarios

**End-to-End Tests:**
- **User Workflows**:
  - Complete chat conversation flow
  - Multi-agent task execution
  - Remote computer setup and deployment
  - Configuration changes and persistence
- **Cross-Component Tests**:
  - WebSocket + UI state synchronization
  - SSH + Deployment + Service management
  - P2P + Multi-computer coordination

**Test Infrastructure:**
- **Frontend**: Vitest + Playwright for E2E
- **Backend**: cargo test + mockall for mocking
- **Integration**: Docker Compose for multi-service testing
- **Coverage**: Istanbul (frontend) + tarpaulin (backend)

### Performance Optimization

**Frontend Performance:**
- **Virtual Scrolling**: For long conversation histories
- **Lazy Loading**: Settings tabs load on demand
- **Debouncing**: Input validation and search operations
- **Memoization**: Expensive computations (agent stats, progress)
- **Code Splitting**: Route-based chunking
- **Bundle Size**: Target < 2MB initial load

**Backend Performance:**
- **Connection Pooling**: Reuse SSH connections
- **Async Operations**: Non-blocking I/O for all network operations
- **Caching**: 
  - Agent status cache (1s TTL)
  - Configuration cache
  - Connection health cache
- **Resource Management**:
  - Limit concurrent SSH connections
  - Task queue with priority handling
  - Memory limits for message history

**WebSocket Optimization:**
- **Message Batching**: Combine rapid updates
- **Delta Updates**: Send only changed data
- **Compression**: Enable permessage-deflate
- **Heartbeat**: 30s interval for connection health

**Memory Management:**
- **Message History**: Limit to last 1000 messages per conversation
- **Agent Logs**: Rotate logs, keep last 10MB per agent
- **Task History**: Archive completed tasks older than 30 days
- **Configuration**: Keep only active configurations in memory

### Security Considerations

**Credential Storage:**
- **API Keys**: Use Tauri's secure storage (OS keychain)
- **SSH Keys**: Encrypted at rest, decrypted on-demand
- **Passwords**: Never store in plain text
- **Session Tokens**: Secure, httpOnly cookies for web components

**Network Security:**
- **WebSocket**: WSS (TLS) required for remote connections
- **SSH**: Key-based authentication preferred
- **P2P**: End-to-end encryption for all peer messages
- **API**: JWT tokens with expiration

**Input Validation:**
- **Sanitization**: All user inputs sanitized before processing
- **Rate Limiting**: Prevent abuse of API endpoints
- **File Paths**: Validate and sanitize file system operations
- **Command Injection**: Prevent shell command injection in SSH operations

## 6. Implementation Sequence

### Phase 1: Foundation (Cycles 1-15)
1. Initialize Tauri project with Svelte + TypeScript
2. Set up project structure and dependencies
3. Implement basic dual-panel layout
4. Create state management foundation
5. Set up testing infrastructure
6. Implement WebSocket client service
7. Add basic error handling
8. Create UI component library
9. Implement theme system (dark/light)
10. Add configuration persistence

### Phase 2: Core Features (Cycles 16-30)
1. Implement chat interface components
2. Build agent dashboard components
3. Create task management UI
4. Implement WebSocket event handling
5. Add real-time status updates
6. Build settings panel structure
7. Implement configuration tabs
8. Add form validation
9. Implement SSH service in backend
10. Add secure credential storage

### Phase 3: CLI Server Integration (Cycles 31-40)
1. Add WebSocket server mode to CLI
2. Implement REST API endpoints
3. Create agent management system
4. Add task routing logic
5. Implement P2P communication foundation
6. Add multi-computer support
7. Implement connection management
8. Add health monitoring
9. Create deployment scripts
10. Add auto-restart functionality

### Phase 4: Advanced Features (Cycles 41-50)
1. Implement remote deployment wizard
2. Add P2P coordination protocol
3. Implement agent cooperation logic
4. Add performance optimizations
5. Implement comprehensive error handling
6. Add logging and debugging tools
7. Create deployment rollback system
8. Add version management
9. Implement advanced configuration features
10. Add final polish and refinements

### Development Cycle Process

Each development cycle follows this sequence:
1. **Test Creation**: Write failing tests for new functionality
2. **Implementation**: Write minimal code to pass tests
3. **Testing**: Run tests, ensure all pass
4. **Code Review**: Evaluate code quality, performance, maintainability
5. **Design Review**: Assess UI/UX for usability and consistency
6. **Documentation**: Update relevant documentation
7. **Improvement**: Implement review feedback
8. **State Clear**: Reset context for next cycle

## 7. Success Criteria

- ✅ Dual-panel interface with responsive layout
- ✅ Real-time agent tracking and status updates
- ✅ Comprehensive configuration system
- ✅ SSH-based remote deployment
- ✅ Multi-computer support
- ✅ P2P agent cooperation
- ✅ 80%+ test coverage
- ✅ Dark/light theme support
- ✅ Performance optimized (< 2MB bundle, < 100ms response times)
- ✅ Secure credential management
- ✅ Comprehensive error handling
- ✅ Clean, maintainable codebase

## 8. Risks and Mitigations

**Risk 1: WebSocket Connection Stability**
- Mitigation: Implement robust reconnection logic with exponential backoff
- Fallback: REST API polling for critical operations

**Risk 2: SSH Deployment Complexity**
- Mitigation: Comprehensive pre-flight checks and rollback capability
- Fallback: Manual deployment instructions

**Risk 3: P2P Network Reliability**
- Mitigation: Relay server fallback and NAT traversal
- Fallback: Hub-and-spoke architecture without P2P

**Risk 4: Performance Degradation with Multiple Agents**
- Mitigation: Efficient state management and message batching
- Fallback: Limit concurrent agents with user notification

**Risk 5: Cross-Platform Compatibility**
- Mitigation: Test on Windows, macOS, Linux throughout development
- Fallback: Platform-specific workarounds documented

## 9. Future Enhancements

- Voice input/output for chat interface
- Plugin system for custom agent types
- Advanced analytics and reporting
- Team collaboration features
- Cloud sync for configurations
- Mobile companion app
- AI model fine-tuning interface
- Advanced workflow automation
- Integration with more AI providers
- Enhanced security features (2FA, audit logs)
