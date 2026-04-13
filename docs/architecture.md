# ClawCode 架构文档

## 概述

ClawCode 是一个基于 Rust 的 AI Agent 开发平台，由三个主要组件构成：

| 组件 | 位置 | 语言 | 用途 |
|------|------|------|------|
| **claw (Rust Workspace)** | `rust/` | Rust | 核心 CLI 和运行时 |
| **tauri-app** | `tauri-app/` | Rust + Svelte 5 | 桌面 GUI 应用 |
| **Python Companion** | `src/` | Python | 迁移辅助、审计工具 |

---

## 1. 组件关系总览

```
┌──────────────────────────────────────────────────────────────────────┐
│                        用户交互层                                    │
│                                                                      │
│   ┌──────────────┐                      ┌────────────────────────┐  │
│   │  claw CLI    │                      │   Tauri Desktop App    │  │
│   │  (终端 REPL) │                      │   (图形界面)           │  │
│   └──────┬───────┘                      └─────────┬──────────────┘  │
│          │                                        │                  │
└──────────┼────────────────────────────────────────┼──────────────────┘
           │                                        │
           │ 直接调用                               │ Tauri IPC (invoke)
           │                                        │
┌──────────┼────────────────────────────────────────┼──────────────────┐
│          ▼                                        ▼                  │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                   Rust Workspace (rust/crates/)              │   │
│  │                                                              │   │
│  │  ┌─────────────────┐  ┌─────────────────────────────────┐   │   │
│  │  │ rusty-claude-cli│  │           runtime               │   │   │
│  │  │ (CLI 入口 bin)  │  │ (会话/权限/MCP/工具编排)       │   │   │
│  │  └────────┬────────┘  └──────────┬──────────────────────┘   │   │
│  │           │                      │                           │   │
│  │  ┌────────┴──────────────────────┴──────────────────┐       │   │
│  │  │                                                   │       │   │
│  │  │  ┌──────┐ ┌──────┐ ┌──────────┐ ┌──────────┐    │       │   │
│  │  │  │ api  │ │tools │ │ plugins  │ │telemetry │    │       │   │
│  │  │  └──────┘ └──────┘ └──────────┘ └──────────┘    │       │   │
│  │  │                                                   │       │   │
│  │  │  ┌──────────┐ ┌──────────┐ ┌────────────────┐   │       │   │
│  │  │  │commands  │ │tiered-lm │ │compat-harness  │   │       │   │
│  │  │  └──────────┘ └──────────┘ └────────────────┘   │       │   │
│  │  └──────────────────────────────────────────────────┘       │   │
│  │                                                              │   │
│  │  ┌──────────────┐                                           │   │
│  │  │  cli-server  │◄── Tauri app 内嵌启动                    │   │
│  │  │ (REST+WS)    │    REST :8766 | WebSocket :8765          │   │
│  │  └──────────────┘                                           │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              Python Companion (src/)                         │   │
│  │  数据导入 (Claude Code → ClawCode) / Parity 审计 / 参考     │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. claw — Rust Workspace

### 2.1 Workspace 结构

```
rust/
├── Cargo.toml              # workspace 定义
└── crates/
    ├── rusty-claude-cli/   # 🎯 CLI 入口 (bin: claw)
    ├── runtime/            # 🧠 核心运行时 (会话/权限/MCP)
    ├── api/                # 📡 LLM Provider 客户端
    ├── commands/           # ⌨️ Slash 命令注册
    ├── tools/              # 🔧 内置工具 (Bash/Read/Write/Edit...)
    ├── plugins/            # 🔌 插件系统
    ├── telemetry/          # 📊 会话追踪
    ├── cli-server/         # 🌐 REST + WebSocket 服务
    ├── tiered-lm/          # ⚡ 分层 LLM 路由
    ├── compat-harness/     # 🧪 TS Manifest 提取
    └── mock-anthropic-service/  # 🎭 Mock API (测试用)
```

### 2.2 Crate 依赖关系

```
rusty-claude-cli (bin)
 ├── runtime (核心)
 │    ├── plugins
 │    ├── telemetry
 │    └── (sha2, glob, tokio...)
 ├── api
 │    ├── runtime
 │    └── telemetry
 ├── commands
 │    ├── plugins
 │    └── runtime
 ├── tools
 │    ├── api
 │    ├── runtime
 │    └── plugins
 ├── cli-server
 │    └── (axum, tokio, serde)
 └── compat-harness
      ├── commands
      ├── tools
      └── runtime
```

### 2.3 各 Crate 职责

#### `rusty-claude-cli` — CLI 入口
- **二进制**: `claw`
- **职责**: REPL 交互、命令路由、终端渲染
- **入口**: `main.rs` (327KB，包含完整的 CLI 逻辑)

#### `runtime` — 核心运行时
- **职责**: 会话管理、配置加载、权限系统、MCP 生命周期、工具编排
- **关键模块**:
  - `config.rs` — 多源配置加载与合并
  - `session.rs` / `conversation.rs` — 会话管理
  - `permissions.rs` — 权限控制
  - `mcp_stdio.rs` — MCP Server 进程管理 (107KB)
  - `file_ops.rs` — 文件操作工具
  - `prompt.rs` — System Prompt 组装
  - `worker_boot.rs` — Worker 生命周期

#### `api` — LLM Provider 客户端
- **职责**: API 请求封装、流式响应解析
- **支持的 Provider**:
  - Anthropic (`providers/anthropic.rs`)
  - OpenAI 兼容 (`providers/openai_compat.rs`)
- **特性**: OAuth 支持、SSE 流式解析、Prompt 缓存

#### `cli-server` — REST + WebSocket 服务
- **职责**: 为 GUI 应用提供 HTTP/WS 接口
- **端口**: REST `:8766` | WebSocket `:8765`
- **API 端点**:
  - `GET /api/health` — 健康检查
  - `GET/POST /api/agents` — Agent 管理
  - `GET/POST/DELETE /api/tasks` — 任务管理
  - `GET/PUT /api/config` — 配置管理
  - `POST /api/deploy` — 远程部署
  - `WS /ws` — WebSocket 实时通信

#### `tiered-lm` — 分层 LLM 路由
- **职责**: 本地/远程模型智能路由，优化成本和速度
- **子模块**: context, health, monitoring, optimization, performance, strategy

---

## 3. tauri-app — 桌面应用

### 3.1 技术栈

| 层 | 技术 |
|----|------|
| 前端 | Svelte 5 + TypeScript + Tailwind CSS 4 + Vite 8 |
| 后端 | Rust + Tauri 2 + Tokio |
| 测试 | Vitest (单元) + Playwright (E2E) |

### 3.2 目录结构

```
tauri-app/
├── src/                          # 前端 (Svelte)
│   ├── App.svelte                # 根组件（分栏布局）
│   ├── main.ts                   # 前端入口
│   └── lib/
│       ├── components/
│       │   ├── common/           # Button, Modal, Toast, ProgressBar
│       │   ├── panels/           # LeftPanel, RightPanel
│       │   ├── settings/         # SettingsPanel (10 个设置标签页)
│       │   ├── agent/            # AgentIOMonitor
│       │   └── deployment/       # DeploymentProgress
│       ├── services/
│       │   ├── apiService.ts     # REST API 客户端
│       │   └── webSocketService.ts  # WebSocket 客户端
│       ├── stores/
│       │   ├── uiStore.ts        # UI 状态 (主题/面板)
│       │   ├── configStore.ts    # 配置管理
│       │   ├── agentStore.ts     # Agent 状态
│       │   ├── chatStore.ts      # 聊天消息
│       │   ├── connectionStore.ts # 连接管理
│       │   └── taskStore.ts      # 任务管理
│       ├── types/                # TypeScript 类型定义
│       └── utils/                # 工具函数
├── src-tauri/                    # 后端 (Rust)
│   ├── Cargo.toml                # 依赖 cli-server crate
│   └── src/
│       ├── main.rs               # Tauri 入口 + 启动内嵌 cli-server
│       ├── commands/             # Tauri IPC 命令
│       │   ├── config_commands.rs       # 配置读写、API 验证
│       │   ├── ssh_commands.rs          # SSH 连接、远程部署
│       │   ├── connection_commands.rs   # 连接健康检查
│       │   └── config_sync_commands.rs  # 远程配置同步
│       ├── models/               # 数据模型
│       │   ├── config.rs         # AppConfig, AIModelConfig 等
│       │   ├── connection.rs     # SshConnection
│       │   └── deployment.rs     # DeploymentConfig
│       ├── ssh_client.rs         # SSH2 客户端封装
│       └── deployment.rs         # 远程部署逻辑
└── tests/                        # 测试
    ├── unit/                     # Vitest 单元测试
    └── e2e/                      # Playwright E2E 测试
```

### 3.3 启动流程

```
1. Tauri 应用启动
   │
   ├── Rust main.rs 执行
   │   ├── 注册所有 Tauri IPC 命令
   │   └── tauri::async_runtime::spawn → 启动内嵌 cli-server
   │       ├── REST API:  http://localhost:8766
   │       └── WebSocket: ws://localhost:8765/ws
   │
   ├── Svelte 前端加载 (App.svelte onMount)
   │   ├── uiStore.loadFromStorage()          # 恢复 UI 偏好
   │   ├── configStore.loadFromStorage()      # 恢复配置
   │   ├── agentStore.initDefaultLeader()     # 初始化 Leader Agent
   │   ├── apiService.healthCheck()           # 检查 cli-server
   │   ├── connectionStore.addConnection()    # 注册本地连接
   │   └── webSocketService.connect()         # 建立 WS 连接
   │
   └── 用户打开 Settings 面板
       ├── loadConfigFromStore()              # 加载已保存配置
       └── initializeFromClaudeCode()         # 自动读取 Claude Code 配置
           └── 仅在用户未配置 API Key 时生效
```

### 3.4 前后端通信机制

```
┌──────────────────┐     Tauri IPC (invoke)     ┌──────────────────┐
│                  │ ──────────────────────────► │                  │
│   Svelte 前端    │                              │   Rust 后端      │
│                  │ ◄────────────────────────── │   (Tauri Commands)│
└────────┬─────────┘     Tauri IPC Result        └──────────────────┘
         │
         │ WebSocket / REST
         │
         ▼
┌──────────────────┐
│   cli-server     │   (内嵌于 Tauri 进程)
│   REST :8766     │
│   WS   :8765     │
└──────────────────┘
```

**两种通信方式**:

1. **Tauri IPC (invoke)** — 用于配置管理、SSH、部署等系统操作
2. **cli-server (REST/WS)** — 用于 Agent 管理、任务编排、实时消息

### 3.5 Tauri IPC 命令清单

| 命令 | 文件 | 功能 |
|------|------|------|
| `get_config` | config_commands | 读取 ClawCode 配置 |
| `save_config` | config_commands | 保存配置 |
| `validate_api_key` | config_commands | 验证 API Key |
| `test_api_connection` | config_commands | 测试 API 连接 |
| `get_claude_code_config` | config_commands | 读取 Claude Code 配置 |
| `test_ssh_connection` | ssh_commands | 测试 SSH 连接 |
| `deploy_cli_server` | ssh_commands | 远程部署 CLI Server |
| `save_ssh_connection` | ssh_commands | 保存 SSH 配置 |
| `list_ssh_connections` | ssh_commands | 列出 SSH 连接 |
| `delete_ssh_connection` | ssh_commands | 删除 SSH 连接 |
| `detect_remote_llm` | ssh_commands | 检测远程 LLM |
| `check_connection_health` | connection_commands | 连接健康检查 |
| `ping_host` | connection_commands | Ping 主机 |
| `sync_config_to_remote` | config_sync_commands | 同步配置到远程 |
| `pull_config_from_remote` | config_sync_commands | 从远程拉取配置 |
| `merge_configs` | config_sync_commands | 合并配置 |

---

## 4. cli-server 与 tauri-app 的关系

`cli-server` 是一个独立的 Rust crate，提供 REST + WebSocket 服务：

```
cli-server crate
├── lib.rs              # ServerConfig, run_server()
├── rest_handler.rs     # REST API 路由与处理
├── ws_handler.rs       # WebSocket 处理器
└── agent_manager.rs    # Agent 生命周期管理
```

**嵌入方式**: tauri-app 的 `Cargo.toml` 通过 `cli-server = { path = "../../rust/crates/cli-server" }` 直接依赖此 crate，在 `main.rs` 的 `setup` 回调中异步启动：

```rust
// tauri-app/src-tauri/src/main.rs
.setup(|_app| {
    tauri::async_runtime::spawn(async move {
        let config = ServerConfig::default();
        run_server(config).await   // 启动 cli-server
    });
    Ok(())
})
```

这意味着 `cli-server` 与 Tauri 应用运行在同一进程中，前端通过 `localhost:8766/8765` 访问。

**独立使用**: `cli-server` 也可以被 `claw` CLI 独立使用，不依赖 Tauri。

---

## 5. 配置体系

### 5.1 配置文件位置

| 文件 | 用途 |
|------|------|
| `~/.config/clawcode/config.json` | ClawCode 自身配置 |
| `~/.claude.json` | Claude Code 配置 (读取 env 中的 API Key/URL/Model) |
| `localStorage('clawcode-config')` | Tauri 前端缓存 |
| `.claude/settings.json` | Claude Code 设置 |

### 5.2 配置继承策略

```
用户在 Settings 面板点击"保存"
         │
         ▼
优先使用 localStorage 中的已保存配置
         │
         │ 未配置过?
         ▼
读取 ~/.claude.json 中的 Claude Code 配置
(env.ANTHROPIC_AUTH_TOKEN / ANTHROPIC_BASE_URL / ANTHROPIC_DEFAULT_*_MODEL)
         │
         │ 也没有?
         ▼
使用默认值 (Anthropic, claude-3-opus, https://api.anthropic.com)
```

### 5.3 AIModelConfig 字段

```typescript
interface AIModelConfig {
  provider: 'anthropic' | 'openai' | 'local' | 'custom';
  endpoint: string;          // API URL
  apiKey?: string;           // API 密钥
  model: string;             // 模型名称
  customModel?: string;      // 自定义模型名称
  temperature: number;       // 温度 (0-2)
  maxTokens: number;         // 最大 token 数
  timeout: number;           // 超时 (秒)
  useAsTieredLMLocal?: boolean;  // 是否用作 TieredLM 本地模型
  availableModels?: string[];    // 可用模型列表
  fallbackModels?: string[];    // 备选模型
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}
```

---

## 6. Python Companion (src/)

### 6.1 定位

Python 代码是**辅助工具**，不是主要运行时。用途包括：

1. **数据导入**: 从 Claude Code 安装导入会话、配置、MCP、插件、Skills
2. **Parity 审计**: 对比 ClawCode 与 Claude Code 的功能对等性
3. **参考实现**: 作为 Rust 实现的参考

### 6.2 关键模块

| 模块 | 功能 |
|------|------|
| `main.py` | CLI 入口 (summary/manifest/parity-audit/import 等子命令) |
| `import_cmd.py` | 导入命令入口 |
| `importers/config_importer.py` | 导入 Claude Code 配置 |
| `importers/session_importer.py` | 导入 Claude Code 会话 |
| `importers/mcp_importer.py` | 导入 MCP 配置 |
| `importers/plugin_importer.py` | 导入插件 |
| `importers/skills_importer.py` | 导入 Skills |
| `parity_audit.py` | Parity 审计 |
| `runtime.py` | Runtime 端口 |

---

## 7. 数据流

### 7.1 用户发送消息流程

```
用户在 tauri-app 输入消息
    │
    ▼
chatStore.sendMessage()
    │
    ├── apiService.sendMessage()  ──►  cli-server REST API
    │                                     │
    │                                     ▼
    │                               agent_manager
    │                                     │
    │                                     ▼
    │                               调用 api crate
    │                                     │
    │                                     ▼
    │                               Anthropic / OpenAI API
    │                                     │
    │◄─────────────────────────────────────┘ (SSE 流式响应)
    │
    └── webSocketService ──►  cli-server WS  ──►  推送到前端
```

### 7.2 远程部署流程

```
用户在 Settings 配置 SSH 连接
    │
    ▼
tauri invoke: save_ssh_connection
    │
    ▼
config_commands 保存到 ~/.config/clawcode/config.json
    │
    ▼
用户点击部署
    │
    ▼
tauri invoke: deploy_cli_server
    │
    ▼
ssh_commands → ssh_client.rs
    │
    ├── SSH 连接远程主机
    ├── 上传 CLI Server 二进制
    ├── 启动远程 cli-server
    └── 返回连接信息
```

---

## 8. 构建与运行

```bash
# 开发 (Tauri)
cd tauri-app && npm run tauri dev

# 构建 (Tauri)
cd tauri-app && npm run tauri build

# CLI
cd rust && cargo run --bin claw

# Rust 测试
cd rust && cargo test --workspace

# 前端测试
cd tauri-app && npm run test

# E2E 测试
cd tauri-app && npm run test:e2e

# Python 导入
python -m src.main import
```
