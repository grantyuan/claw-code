# Comprehensive Feature Design Document

**Date**: 2026-04-13
**Version**: 1.0
**Author**: Claude Code
**Status**: Draft

---

## Table of Contents

1. [Overview](#1-overview)
2. [Chat History Management System](#2-chat-history-management-system)
3. [Settings Interface Enhancement](#3-settings-interface-enhancement)
4. [Multi-Project Support System](#4-multi-project-support-system)
5. [Implementation Phases](#5-implementation-phases)
6. [Testing Strategy](#6-testing-strategy)

---

## 1. Overview

### 1.1 Design Principles

- **Modularity**: Each system is independent and can be developed, tested, and deployed separately
- **TDD First**: All features follow Test-Driven Development methodology
- **Local-First**: Data stored locally (IndexedDB for chat, filesystem for config)
- **Project Isolation**: Project-specific settings stored within project directory

### 1.2 Data Storage Architecture

| Data Type | Storage Location | Format |
|-----------|-----------------|--------|
| Chat History | IndexedDB | Binary/JSON |
| Global Config | `~/.config/clawcode/config.json` | JSON |
| Project Config | `<project>/.clawcode/config.json` | JSON |
| Config Backups | `~/.config/clawcode/backups/` | JSON + Timestamp |

### 1.3 Technology Stack

- **Frontend**: Svelte 5 + TypeScript + TailwindCSS
- **Backend**: Rust + Tauri 2.x
- **Local Storage**: IndexedDB (via `idb` library)
- **State Management**: Svelte 5 Runes ($state, $derived, $effect)

---

## 2. Chat History Management System

### 2.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Svelte 5)                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │ ChatHistory  │  │ HistoryPanel │  │ KeyboardNavigation    │  │
│  │ Component    │  │ Component    │  │ Handler (↑/↓ keys)    │  │
│  └──────────────┘  └──────────────┘  └───────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                      IndexedDB Service                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ ChatHistoryDB│  │ ProjectIndex │  │ MessageCache          │  │
│  │ (messages,   │  │ (project ->  │  │ (streaming messages)  │  │
│  │  convos)     │  │  convos)     │  │                      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Models

#### 2.2.1 IndexedDB Schema

```typescript
// Database: ChatHistoryDB
// Version: 1

// Object Store: conversations
interface ConversationRecord {
  id: string;                    // UUID
  projectId: string | null;      // null = global/unassigned
  title: string;
  agentId: string;
  createdAt: number;             // Unix timestamp
  updatedAt: number;
  messageCount: number;
  tags: string[];
  isArchived: boolean;
}

// Object Store: messages
interface MessageRecord {
  id: string;                    // UUID
  conversationId: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  attachments?: Attachment[];
  metadata?: MessageMetadata;
}

interface Attachment {
  id: string;
  type: 'image' | 'file' | 'code';
  name: string;
  mimeType: string;
  data: string;                  // Base64 or file reference
  size: number;
}

interface MessageMetadata {
  model?: string;
  provider?: string;
  tokens?: number;
  latency?: number;
  error?: string;
}

// Object Store: projects
interface ProjectRecord {
  id: string;
  name: string;
  path: string;
  conversationIds: string[];
  lastAccessedAt: number;
}

// Object Store: settings
interface HistorySettings {
  id: 'default';
  retentionDays: number | null;  // null = forever
  autoCleanupEnabled: boolean;
  maxMessagesPerConversation: number;
  streamingCacheSize: number;
}
```

### 2.3 Components

#### 2.3.1 ChatHistoryPanel Component

**Location**: `tauri-app/src/lib/components/history/ChatHistoryPanel.svelte`

**Props**:
```typescript
interface Props {
  projectId?: string;             // Filter by project
  onSelectConversation: (id: string) => void;
  onResubmit: (conversationId: string, messageId: string) => void;
}
```

**Features**:
- Display list of conversations grouped by project
- Search/filter by title, content, date
- Keyboard navigation (↑/↓ to select, Enter to open)
- Multi-select for batch operations (archive, delete)
- Drag-and-drop to reorder
- Pull-to-refresh for sync

#### 2.3.2 HistoryListItem Component

**Location**: `tauri-app/src/lib/components/history/HistoryListItem.svelte`

**Features**:
- Shows conversation preview (title + first message snippet)
- Project badge if assigned
- Timestamp (relative: "2 hours ago")
- Message count indicator
- Hover actions: resubmit, delete, archive

#### 2.3.3 ConversationDetail Component

**Location**: `tauri-app/src/lib/components/history/ConversationDetail.svelte`

**Features**:
- Full conversation view
- Message tree with threading
- Resubmit button on each user message
- Export conversation (JSON/Markdown)
- Jump to specific message

#### 2.3.4 KeyboardNavigation Handler

**Location**: `tauri-app/src/lib/components/history/useHistoryNavigation.ts`

**Features**:
- ↑/↓ arrows: Navigate through history list
- Enter: Open selected conversation
- Ctrl+R: Resubmit last user message
- Escape: Close history panel
- Ctrl+F: Focus search input

### 2.4 Services

#### 2.4.1 IndexedDB Service

**Location**: `tauri-app/src/lib/services/chatHistoryService.ts`

```typescript
class ChatHistoryService {
  // Initialization
  async init(): Promise<void>;

  // Conversation operations
  async createConversation(projectId: string | null, title?: string): Promise<string>;
  async getConversation(id: string): Promise<ConversationRecord | null>;
  async listConversations(options?: ListOptions): Promise<ConversationRecord[]>;
  async updateConversation(id: string, updates: Partial<ConversationRecord>): Promise<void>;
  async deleteConversation(id: string): Promise<void>;
  async archiveConversation(id: string): Promise<void>;

  // Message operations
  async addMessage(conversationId: string, message: Omit<MessageRecord, 'id'>): Promise<string>;
  async getMessages(conversationId: string, options?: PaginationOptions): Promise<MessageRecord[]>;
  async updateMessage(id: string, updates: Partial<MessageRecord>): Promise<void>;
  async deleteMessage(id: string): Promise<void>;

  // Project operations
  async createProject(name: string, path: string): Promise<string>;
  async listProjects(): Promise<ProjectRecord[]>;
  async linkConversationToProject(conversationId: string, projectId: string): Promise<void>;

  // Search
  async searchConversations(query: string): Promise<ConversationRecord[]>;
  async searchMessages(query: string): Promise<MessageRecord[]>;

  // Maintenance
  async cleanup(retentionDays: number): Promise<number>;  // Returns deleted count
  async exportConversation(id: string, format: 'json' | 'markdown'): Promise<string>;
}
```

### 2.5 API Endpoints (Rust Backend)

```rust
// chat_history.rs

// Get all conversations for a project (or global)
GET /api/history/conversations?project_id={id}&limit={n}&offset={n}

// Get single conversation with messages
GET /api/history/conversations/{id}

// Search conversations and messages
GET /api/history/search?q={query}&type={convo|message|both}

// Export conversation
GET /api/history/conversations/{id}/export?format={json|markdown}

// Batch operations
POST /api/history/conversations/batch
{
  "action": "delete" | "archive",
  "ids": ["uuid1", "uuid2"]
}
```

### 2.6 Implementation Steps

1. **Phase 1.1**: Set up IndexedDB schema and migration system
2. **Phase 1.2**: Implement ChatHistoryService with basic CRUD
3. **Phase 1.3**: Create ChatHistoryPanel component
4. **Phase 1.4**: Add keyboard navigation support
5. **Phase 1.5**: Implement search functionality
6. **Phase 1.6**: Add conversation resubmit feature
7. **Phase 1.7**: Integration with Rust backend for persistence

---

## 3. Settings Interface Enhancement

### 3.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Dual-Layer Settings System                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Global Settings (Modal)                      │   │
│  │  ├── AI Model Configuration                              │   │
│  │  │   ├── Provider (Anthropic/OpenAI/Local/Custom)        │   │
│  │  │   ├── API Endpoint & Key                             │   │
│  │  │   ├── Model Ranking (drag to reorder)                 │   │
│  │  │   └── Tiered-LM Settings                             │   │
│  │  │       ├── Enable/Disable Toggle                       │   │
│  │  │       ├── Auxiliary Model Selection                  │   │
│  │  │       └── Fallback Chain Configuration                │   │
│  │  ├── Agents Configuration                               │   │
│  │  ├── RAG & Knowledge                                    │   │
│  │  ├── MCP & Tools                                        │   │
│  │  ├── Memory Configuration                               │   │
│  │  ├── Remote & SSH                                       │   │
│  │  ├── P2P Network                                        │   │
│  │  └── UI/UX Settings                                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Project Settings (Panel)                    │   │
│  │  ├── Path Configuration                                 │   │
│  │  │   ├── Working Directory                             │   │
│  │  │   └── Installation Path                             │   │
│  │  ├── Rule Management (CLAUDE.md style)                 │   │
│  │  │   ├── Project Instructions                           │   │
│  │  │   └── Custom Rules List                             │   │
│  │  ├── Exclusion Settings                                 │   │
│  │  │   ├── Excluded Directories                          │   │
│  │  │   └── Excluded File Patterns                         │   │
│  │  └── Inherit Global Settings (with overrides)            │   │
│  │      └── One-click "Restore Defaults"                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Data Models

#### 3.2.1 Global Config Schema

**Location**: `~/.config/clawcode/config.json`

```typescript
interface GlobalConfig {
  version: string;                // Schema version for migrations
  lastModified: string;           // ISO timestamp

  aiModel: AIModelGlobalConfig;
  agents: AgentConfigs;
  rag: RAGConfig;
  mcp: MCPConfig;
  memory: MemoryConfig;
  remote: RemoteConfig;
  p2p: P2PConfig;
  ui: UIConfig;
}

interface AIModelGlobalConfig {
  providers: ProviderConfig[];
  defaultProviderId: string;
  models: ModelConfig[];          // All configured models with rankings
  tieredLM: TieredLMConfig;
}

interface ProviderConfig {
  id: string;                     // UUID
  name: string;                    // "Anthropic", "OpenAI", etc.
  type: 'anthropic' | 'openai' | 'local' | 'custom';
  endpoint?: string;
  apiKey?: string;                // Encrypted
  isDefault: boolean;
}

interface ModelConfig {
  id: string;                     // UUID
  providerId: string;             // Reference to ProviderConfig
  name: string;                   // "claude-3-opus", "gpt-4-turbo"
  displayName: string;            // User-friendly name
  rank: number;                   // 1 = best, N = lowest
  capabilities: ModelCapabilities;
  isDefault: boolean;
  settings: ModelSettings;
}

interface ModelCapabilities {
  vision: boolean;
  functionCalling: boolean;
  streaming: boolean;
  maxTokens: number;
  contextWindow: number;
}

interface ModelSettings {
  temperature: number;
  maxTokens: number;
  topP?: number;
  timeout: number;
}

interface TieredLMConfig {
  enabled: boolean;
  auxiliaryModelId: string | null;  // Reference to ModelConfig.id
  fallbackChain: string[];          // Model IDs in order
  complexityThreshold: number;      // For internal tiered-lm logic
}
```

#### 3.2.2 Project Config Schema

**Location**: `<project>/.clawcode/config.json`

```typescript
interface ProjectConfig {
  version: string;
  projectId: string;              // UUID
  projectPath: string;            // Absolute path

  // Inheritance from global
  inheritGlobal: boolean;

  // Override settings (null = use global)
  overrides: {
    aiModel?: Partial<AIModelGlobalConfig>;
    agents?: Partial<AgentConfigs>;
    // ... other sections
  } | null;

  // Project-specific settings
  project: {
    workingDirectory: string;
    rules: ProjectRules;
    exclusions: ExclusionSettings;
  };
}

interface ProjectRules {
  enabled: boolean;
  instructions: string;          // Main project instructions (like CLAUDE.md)
  additionalRules: AdditionalRule[];
}

interface AdditionalRule {
  id: string;
  name: string;
  pattern: string;               // Glob pattern for file matching
  content: string;                // Rule content
  priority: number;
}

interface ExclusionSettings {
  directories: string[];        // e.g., ["node_modules", ".git", "dist"]
  files: string[];               // e.g., ["*.log", "*.tmp", "package-lock.json"]
  patterns: string[];            // e.g., ["**/cache/**", "**/tmp/**"]
}
```

### 3.3 Components

#### 3.3.1 SettingsPanel Component (Enhanced)

**Location**: `tauri-app/src/lib/components/settings/SettingsPanel.svelte`

**Changes**:
- Remove "Project" tab from Global Settings
- Add "Project Settings" button in left panel footer (opens separate panel)
- Fix "Save Changes" button visibility in light mode
- Implement all missing sub-tab pages

#### 3.3.2 AIModelSettings Component

**Location**: `tauri-app/src/lib/components/settings/AIModelSettings.svelte`

**Features**:
- Provider management (add/edit/delete)
- Model list with drag-to-reorder ranking
- Model card showing: name, provider, capabilities, rank badge
- Add model modal
- Edit model modal

#### 3.3.3 TieredLMSettings Component

**Location**: `tauri-app/src/lib/components/settings/TieredLMSettings.svelte`

**Features**:
- Enable/disable toggle
- Auxiliary model dropdown (populated from configured models)
- Fallback chain visualization
- Complexity threshold slider

#### 3.3.4 ProjectSettingsPanel Component

**Location**: `tauri-app/src/lib/components/settings/ProjectSettingsPanel.svelte`

**Features**:
- Opens as a side panel (not modal)
- Shows current project path
- Inherit Global toggle with visual indicator
- Override sections when inheritance disabled
- "Restore Defaults" button (when overrides exist)
- Rule editor (similar to CLAUDE.md)
- Exclusion pattern manager

#### 3.3.5 RuleEditor Component

**Location**: `tauri-app/src/lib/components/settings/RuleEditor.svelte`

**Features**:
- Rich text editor for project instructions
- Syntax highlighting for markdown
- Additional rules list with add/edit/delete
- Pattern matching preview

#### 3.3.6 ExclusionManager Component

**Location**: `tauri-app/src/lib/components/settings/ExclusionManager.svelte`

**Features**:
- Directory list with add/remove
- File pattern list with add/remove
- Pattern test input (shows which files would be excluded)
- Common presets dropdown (node_modules, .git, etc.)

### 3.4 Services

#### 3.4.1 ConfigService

**Location**: `tauri-app/src/lib/services/configService.ts`

```typescript
class ConfigService {
  // Global config operations
  async loadGlobalConfig(): Promise<GlobalConfig>;
  async saveGlobalConfig(config: GlobalConfig): Promise<void>;
  async resetGlobalConfig(): Promise<void>;
  async backupGlobalConfig(): Promise<string>;  // Returns backup path

  // Project config operations
  async loadProjectConfig(projectPath: string): Promise<ProjectConfig | null>;
  async saveProjectConfig(projectPath: string, config: ProjectConfig): Promise<void>;
  async createProjectConfig(projectPath: string, inheritGlobal: boolean): Promise<ProjectConfig>;
  async deleteProjectConfig(projectPath: string): Promise<void>;

  // Model management
  async addModel(providerId: string, model: Omit<ModelConfig, 'id'>): Promise<string>;
  async updateModel(modelId: string, updates: Partial<ModelConfig>): Promise<void>;
  async deleteModel(modelId: string): Promise<void>;
  async reorderModels(modelIds: string[]): Promise<void>;  // New rankings

  // Validation
  async validateConfig(config: GlobalConfig): Promise<ValidationResult>;
  async migrateConfig(fromVersion: string, toVersion: string): Promise<GlobalConfig>;
}
```

#### 3.4.2 ProjectDetectionService

**Location**: `tauri-app/src/lib/services/projectDetectionService.ts`

```typescript
class ProjectDetectionService {
  // Detect if path is a project (has .clawcode/config.json)
  async isProject(path: string): Promise<boolean>;

  // Get all projects in a directory tree
  async findProjects(rootPath: string): Promise<ProjectInfo[]>;

  // Get effective config (merged global + project overrides)
  async getEffectiveConfig(projectPath: string): Promise<EffectiveConfig>;
}
```

### 3.5 Rust Backend Commands

```rust
// config_commands.rs

// Global config
#[tauri::command]
async fn load_global_config(app: AppHandle) -> Result<GlobalConfig, String>;

#[tauri::command]
async fn save_global_config(app: AppHandle, config: GlobalConfig) -> Result<(), String>;

#[tauri::command]
async fn backup_global_config(app: AppHandle) -> Result<String, String>;  // Returns path

// Project config
#[tauri::command]
async fn load_project_config(project_path: String) -> Result<Option<ProjectConfig>, String>;

#[tauri::command]
async fn save_project_config(project_path: String, config: ProjectConfig) -> Result<(), String>;

#[tauri::command]
async fn create_project_config(project_path: String, inherit_global: bool) -> Result<ProjectConfig, String>;

#[tauri::command]
async fn get_effective_config(project_path: String) -> Result<EffectiveConfig, String>;
```

### 3.6 UI/UX Fixes

#### 3.6.1 Save Changes Button Visibility

**Issue**: Button background/foreground colors indistinguishable in light mode

**Solution**:
```css
/* Button colors - ensure contrast in both themes */
.btn-primary {
  /* Dark mode */
  --btn-bg: var(--color-primary-600);
  --btn-text: white;

  /* Light mode */
  &:not(.dark) {
    --btn-bg: var(--color-primary-500);
    --btn-text: white;
  }
}

/* Or use a more distinct style */
.btn-primary {
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark));
  color: white;
  border: 2px solid transparent;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
```

### 3.7 Implementation Steps

1. **Phase 2.1**: Define new data models (GlobalConfig, ProjectConfig, etc.)
2. **Phase 2.2**: Implement ConfigService with filesystem operations
3. **Phase 2.3**: Add Rust backend commands for config persistence
4. **Phase 2.4**: Enhance SettingsPanel UI - remove Project tab
5. **Phase 2.5**: Implement AIModelSettings with model ranking
6. **Phase 2.6**: Implement TieredLMSettings
7. **Phase 2.7**: Create ProjectSettingsPanel component
8. **Phase 2.8**: Implement RuleEditor and ExclusionManager
9. **Phase 2.9**: Add config versioning and backup system
10. **Phase 2.10**: Fix Save Changes button visibility

---

## 4. Multi-Project Support System

### 4.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Multi-Project UI Architecture                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────────┐  ┌─────────────────┐    │
│  │ Left Panel  │  │ Right Panel     │  │ Project Badge   │    │
│  │             │  │                 │  │                 │    │
│  │ ┌─────────┐ │  │ ┌─────────────┐ │  │ [Project A]     │    │
│  │ │Project A│ │  │ │ Session 1   │ │  │ [Project B]     │    │
│  │ │ Sessions│ │  │ │ (Agent Log) │ │  │                 │    │
│  │ │ ├─ Sess1│ │  │ │             │ │  │                 │    │
│  │ │ ├─ Sess2│ │  │ │ ┌─────────┐ │ │  │                 │    │
│  │ │ └─ Sess3│ │  │ │ │Detail   │ │ │  │                 │    │
│  │ └─────────┘ │  │ │ │View     │ │ │  │                 │    │
│  │ ┌─────────┐ │  │ │ └─────────┘ │ │  │                 │    │
│  │ │Project B│ │  │ │             │ │  │                 │    │
│  │ │ Sessions│ │  │ └─────────────┘ │  │                 │    │
│  │ └─────────┘ │  │                 │  │                 │    │
│  └─────────────┘  └─────────────────┘  └─────────────────┘    │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Project Selector (Dropdown/Modal)                       │   │
│  │ ┌─────────────────────────────────────────────────────┐ │   │
│  │ │ 🔍 Search projects...                              │ │   │
│  │ ├─────────────────────────────────────────────────────┤ │   │
│  │ │ 📁 Project A  (/path/to/projectA)        [Select] │ │   │
│  │ │ 📁 Project B  (/path/to/projectB)        [Select] │ │   │
│  │ │ 📁 Project C  (/path/to/projectC)        [Select] │ │   │
│  │ └─────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Data Models

#### 4.2.1 Project Model

```typescript
interface Project {
  id: string;
  name: string;
  path: string;
  description?: string;
  color: string;                  // For visual identification
  icon?: string;                 // Emoji or icon
  createdAt: number;
  lastAccessedAt: number;
  sessionCount: number;
  config: ProjectConfig;
}
```

#### 4.2.2 Session Model

```typescript
interface Session {
  id: string;
  projectId: string;
  title: string;
  status: 'active' | 'paused' | 'completed' | 'error';
  agentId: string;
  conversationId: string;        // Link to chat history
  createdAt: number;
  updatedAt: number;
  logs: SessionLog[];
}

interface SessionLog {
  id: string;
  sessionId: string;
  timestamp: number;
  level: 'info' | 'warning' | 'error';
  source: 'agent' | 'llm' | 'system';
  message: string;
  details?: Record<string, any>;
}
```

### 4.3 Components

#### 4.3.1 ProjectSelector Component

**Location**: `tauri-app/src/lib/components/projects/ProjectSelector.svelte`

**Features**:
- Dropdown/modal for project selection
- Search projects by name or path
- Show project color/icon
- "Add Project" option
- Recent projects at top
- Keyboard navigation

#### 4.3.2 ProjectCard Component

**Location**: `tauri-app/src/lib/components/projects/ProjectCard.svelte`

**Features**:
- Project name and path
- Color badge
- Session count
- Last activity time
- Quick actions (open, remove)

#### 4.3.3 LeftPanel Enhancement

**Location**: `tauri-app/src/lib/components/panels/LeftPanel.svelte`

**Changes**:
- Project selector at top
- Sessions grouped by project
- Collapsible project sections
- Visual indicators for project colors

#### 4.3.4 RightPanel Enhancement

**Location**: `tauri-app/src/lib/components/panels/RightPanel.svelte`

**Changes**:
- Add project info header
- Bidirectional binding: selecting session updates project context
- Session detail view (when clicking session)
- Back button to return to session list

#### 4.3.5 AgentDetailView Component

**Location**: `tauri-app/src/lib/components/projects/AgentDetailView.svelte`

**Features**:
- Full LLM work logs display
- Scrollable log viewer
- Log level filtering (info/warning/error)
- Export logs
- Session metadata header

#### 4.3.6 ProjectBadge Component

**Location**: `tauri-app/src/lib/components/projects/ProjectBadge.svelte`

**Features**:
- Small colored badge showing project
- Tooltip with project info
- Click to open project settings

### 4.4 Bidirectional Binding Logic

```typescript
// When user selects a session in RightPanel
function selectSession(sessionId: string) {
  // 1. Update right panel to show session
  rightPanelStore.setActiveSession(sessionId);

  // 2. Find project for this session
  const session = sessionStore.getSession(sessionId);
  const project = projectStore.getProject(session.projectId);

  // 3. Update left panel to highlight this project
  leftPanelStore.setSelectedProject(project.id);
  leftPanelStore.expandProject(project.id);

  // 4. Update URL/query params for shareability
  router.setQuery({ project: project.id, session: sessionId });
}

// When user clicks project in left panel
function selectProject(projectId: string) {
  // 1. Update left panel selection
  leftPanelStore.setSelectedProject(projectId);

  // 2. Clear right panel (or show project overview)
  rightPanelStore.clearActiveSession();
  rightPanelStore.setProjectContext(projectId);
}
```

### 4.5 Services

#### 4.5.1 ProjectService

**Location**: `tauri-app/src/lib/services/projectService.ts`

```typescript
class ProjectService {
  // Project CRUD
  async createProject(path: string, name?: string): Promise<Project>;
  async getProject(id: string): Promise<Project | null>;
  async listProjects(): Promise<Project[]>;
  async updateProject(id: string, updates: Partial<Project>): Promise<void>;
  async deleteProject(id: string, keepConfig?: boolean): Promise<void>;

  // Project discovery
  async detectProjects(rootPath: string): Promise<ProjectInfo[]>;
  async importExistingProject(path: string): Promise<Project>;

  // Project operations
  async openProjectTerminal(projectId: string): Promise<void>;
  async runAgent(projectId: string, agentId: string): Promise<Session>;
}
```

#### 4.5.2 SessionService

**Location**: `tauri-app/src/lib/services/sessionService.ts`

```typescript
class SessionService {
  async createSession(projectId: string, agentId: string): Promise<Session>;
  async getSession(id: string): Promise<Session | null>;
  async listSessions(projectId?: string): Promise<Session[]>;
  async updateSession(id: string, updates: Partial<Session>): Promise<void>;
  async deleteSession(id: string): Promise<void>;

  async getSessionLogs(sessionId: string, options?: LogFilter): Promise<SessionLog[]>;
  async streamSessionLogs(sessionId: string): Promise<AsyncIterable<SessionLog>>;
}
```

### 4.6 Rust Backend Commands

```rust
// project_commands.rs

#[tauri::command]
async fn create_project(path: String, name: Option<String>) -> Result<Project, String>;

#[tauri::command]
async fn list_projects() -> Result<Vec<Project>, String>;

#[tauri::command]
async fn get_project(id: String) -> Result<Option<Project>, String>;

#[tauri::command]
async fn delete_project(id: String, keep_config: bool) -> Result<(), String>;

#[tauri::command]
async fn detect_projects(root_path: String) -> Result<Vec<ProjectInfo>, String>;

#[tauri::command]
async fn get_effective_config(project_path: String) -> Result<EffectiveConfig, String>;

// session_commands.rs

#[tauri::command]
async fn create_session(project_id: String, agent_id: String) -> Result<Session, String>;

#[tauri::command]
async fn get_session_logs(session_id: String, level: Option<LogLevel>) -> Result<Vec<SessionLog>, String>;

#[tauri::command]
async fn stream_session_logs(session_id: String) -> Result<tokio::sync::mpsc::Receiver<SessionLog>, String>;
```

### 4.7 Implementation Steps

1. **Phase 3.1**: Define Project and Session data models
2. **Phase 3.2**: Implement ProjectService
3. **Phase 3.3**: Create ProjectSelector component
4. **Phase 3.4**: Enhance LeftPanel with project grouping
5. **Phase 3.5**: Implement bidirectional binding (LeftPanel ↔ RightPanel)
6. **Phase 3.6**: Create AgentDetailView for log viewing
7. **Phase 3.7**: Add ProjectBadge components
8. **Phase 3.8**: Implement back navigation from detail view
9. **Phase 3.9**: Add session management to backend
10. **Phase 3.10**: Integration testing

---

## 5. Implementation Phases

### Phase 1: Chat History Management (2-3 weeks)
- IndexedDB setup and schema
- Basic CRUD operations
- UI components
- Keyboard navigation
- Search functionality
- Resubmit feature

### Phase 2: Settings Enhancement (3-4 weeks)
- Data model redesign
- ConfigService implementation
- Rust backend commands
- AI Model settings with ranking
- Tiered-LM settings
- Project settings panel
- Rule editor
- UI fixes

### Phase 3: Multi-Project Support (2-3 weeks)
- ProjectService implementation
- UI components
- Bidirectional binding
- Session management
- Agent detail view

### Total Estimated Time: 7-10 weeks

---

## 6. Testing Strategy

### 6.1 Unit Tests
- All services: >80% coverage
- All stores: >80% coverage
- Utility functions: 100% coverage

### 6.2 Integration Tests
- IndexedDB operations
- Config file read/write
- Rust-Frontend communication
- Project config inheritance

### 6.3 E2E Tests (Playwright)
- Chat history: create, search, resubmit
- Settings: save, load, reset
- Multi-project: create, switch, view logs

### 6.4 Test Locations
```
tauri-app/
├── src/
│   ├── lib/
│   │   ├── services/
│   │   │   └── *.test.ts
│   │   └── stores/
│   │       └── *.test.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
└── playwright/
```

---

## Appendix A: File Structure

```
tauri-app/src/
├── lib/
│   ├── components/
│   │   ├── history/
│   │   │   ├── ChatHistoryPanel.svelte
│   │   │   ├── HistoryListItem.svelte
│   │   │   ├── ConversationDetail.svelte
│   │   │   └── useHistoryNavigation.ts
│   │   ├── settings/
│   │   │   ├── SettingsPanel.svelte (enhanced)
│   │   │   ├── AIModelSettings.svelte
│   │   │   ├── TieredLMSettings.svelte
│   │   │   ├── ProjectSettingsPanel.svelte
│   │   │   ├── RuleEditor.svelte
│   │   │   └── ExclusionManager.svelte
│   │   ├── projects/
│   │   │   ├── ProjectSelector.svelte
│   │   │   ├── ProjectCard.svelte
│   │   │   ├── ProjectBadge.svelte
│   │   │   └── AgentDetailView.svelte
│   │   └── panels/
│   │       ├── LeftPanel.svelte (enhanced)
│   │       └── RightPanel.svelte (enhanced)
│   ├── services/
│   │   ├── chatHistoryService.ts
│   │   ├── configService.ts
│   │   ├── projectService.ts
│   │   ├── sessionService.ts
│   │   └── projectDetectionService.ts
│   ├── stores/
│   │   ├── chatHistoryStore.ts
│   │   ├── projectStore.ts
│   │   └── sessionStore.ts
│   └── types/
│       ├── chat.ts
│       ├── config.ts (enhanced)
│       └── project.ts
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/

rust/crates/cli-server/src/
├── commands/
│   ├── mod.rs
│   ├── config_commands.rs
│   ├── project_commands.rs
│   └── session_commands.rs
├── config/
│   ├── mod.rs
│   ├── global_config.rs
│   └── project_config.rs
└── lib.rs (enhanced)
```

---

## Appendix B: Migration Strategy

### Config Versioning

```typescript
interface ConfigVersion {
  version: string;      // e.g., "1.0.0"
  appliedAt: string;     // ISO timestamp
  description: string;
}

// Backup before migration
~/.config/clawcode/backups/
├── config-v1.0.0-2026-04-13T10:30:00Z.json
└── config-v2.0.0-2026-04-20T14:00:00Z.json
```

### Migration Steps
1. Load existing config
2. Create backup
3. Validate against new schema
4. Apply transformations
5. Save with new version
6. Verify integrity

---

## Appendix C: Error Handling

### Error Codes

```typescript
enum ErrorCode {
  // Chat History
  CH_001 = 'Failed to initialize IndexedDB',
  CH_002 = 'Conversation not found',
  CH_003 = 'Failed to save message',
  CH_004 = 'Search query too short',

  // Config
  CF_001 = 'Failed to load global config',
  CF_002 = 'Failed to save global config',
  CF_003 = 'Invalid config schema version',
  CF_004 = 'Config backup failed',
  CF_005 = 'Project config not found',

  // Project
  PR_001 = 'Failed to create project',
  PR_002 = 'Project path does not exist',
  PR_003 = 'Failed to detect projects',

  // Session
  SE_001 = 'Failed to create session',
  SE_002 = 'Session not found',
  SE_003 = 'Failed to stream logs',
}
```

---

**Document Status**: Ready for Review
**Next Step**: Implement Phase 1.1 - IndexedDB Schema Setup
