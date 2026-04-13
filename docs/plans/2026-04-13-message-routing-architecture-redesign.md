# Claw 消息路由架构重新设计方案

## 1. 背景与目标

### 1.1 当前问题

当前系统存在设计缺陷：tauri-app 界面产生的用户消息被直接发送至 LLM API，绕过了 claw CLI 处理流程。具体表现为 `chat_handler.rs` 中的 `POST /api/chat` 接口直接调用 Anthropic/OpenAI/Ollama API，完全绕过了：

- 信任/提示传递系统 (worker_boot.rs)
- 权限管理系统
- 工具编排系统
- MCP 服务器生命周期管理
- 会话管理

### 1.2 设计目标

1. **消息路由调整**：所有用户输入统一路由至 claw CLI 处理，禁止直接与 LLM 通信的路径
2. **指令标准化**：tauri-app 发送的输入严格遵循 claw CLI 指令格式
3. **库模式集成**：通过库调用而非进程通信与 claw CLI 交互
4. **多会话支持**：tauri-app 支持多会话管理与切换
5. **错误可预期**：claw CLI 不可用时系统完全不可用

---

## 2. 设计原则

1. **所有用户消息必须经过 claw CLI 核心运行时处理**
2. **tauri-app 通过库模式直接调用 claw 运行时，不启动子进程**
3. **指令格式采用命令行原始文本格式，保持与终端输入一致**
4. **多会话支持，每个会话独立管理**
5. **claw CLI 不可用时系统完全不可用，无降级策略**

---

## 3. 架构设计

### 3.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           用户交互层                                     │
│                                                                          │
│   ┌─────────────────────────┐        ┌─────────────────────────────────┐ │
│   │     claw CLI (终端)     │        │      tauri-app (GUI)           │ │
│   │     原始 REPL 交互      │        │      统一 UI + 多会话管理       │ │
│   └───────────┬─────────────┘        └──────────────┬──────────────────┘ │
│               │                                        │                 │
└───────────────┼────────────────────────────────────────┼─────────────────┘
                │                                        │
                │ 库调用                                 │ 库调用
                ▼                                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     claw-runtime 统一运行时库                            │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                      SessionManager (会话管理)                       ││
│  │   - 多会话支持，每个会话独立上下文                                    ││
│  │   - 会话状态跟踪 (active/idle/running/error)                         ││
│  │   - 会话持久化                                                       ││
│  └─────────────────────────────────────────────────────────────────────┘│
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────────────┐ │
│  │ PermissionMgr   │  │  ToolOrchestra  │  │   MCPManager           │ │
│  │ (权限控制)      │  │  (工具编排)     │  │   (MCP生命周期)         │ │
│  └─────────────────┘  └─────────────────┘  └────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                      MessageProcessor (消息处理)                     ││
│  │   - 解析命令行格式输入                                              ││
│  │   - 调用 LLM Provider                                               ││
│  │   - SSE 流式响应                                                    ││
│  └─────────────────────────────────────────────────────────────────────┘│
│  ┌─────────────────┐  ┌─────────────────┐                              │
│  │ TieredLM        │  │  ConfigLoader   │                              │
│  │ (分层模型路由)   │  │  (配置加载)     │                              │
│  └─────────────────┘  └─────────────────┘                              │
└─────────────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        LLM Provider 层                                  │
│                                                                          │
│  ┌──────────────┐  ┌─────────────────┐  ┌───────────────────────────┐  │
│  │  Anthropic   │  │  OpenAI Compat  │  │   Ollama (Local)          │  │
│  └──────────────┘  └─────────────────┘  └───────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 数据流图

```
tauri-app 用户输入
      │
      ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 1. InputCollector (UI层)                                            │
│    - 收集用户文本、指令、交互操作                                      │
│    - 格式化为原始命令行文本                                           │
│    - 支持多附件（图片等）                                             │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. SessionManager (Runtime层)                                        │
│    - 获取/创建会话                                                    │
│    - 附加对话历史                                                      │
│    - 权限上下文合并                                                   │
│    - 返回 SessionHandle                                              │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. MessageProcessor (Runtime层)                                      │
│    - 转发原始文本到运行时核心                                         │
│    - 应用权限规则                                                     │
│    - 触发工具/MCP生命周期                                             │
│    - 管理 Worker 状态机                                               │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4. WorkerBoot (Runtime层)                                            │
│    - Trust Gate 检测与处理                                            │
│    - Prompt 传递与 misdelivery 恢复                                    │
│    - 状态机转换                                                       │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 5. LLM Provider (API层)                                              │
│    - 构建请求（Anthropic/OpenAI/Ollama）                               │
│    - 处理 SSE 流式响应                                               │
│    - 错误重试与降级                                                   │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼ (SSE 流式响应)
┌─────────────────────────────────────────────────────────────────────┐
│ 6. ResponseHandler (Runtime层)                                       │
│    - 解析 LLM 响应                                                   │
│    - 提取工具调用结果                                                 │
│    - 生成用户可读输出                                                 │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
                      tauri-app UI 更新
```

---

## 4. 核心组件 API 设计

### 4.1 Runtime 库导出 (rust/crates/runtime/src/lib.rs)

```rust
pub struct ClawRuntime {
    inner: Arc<ClawRuntimeInner>,
}

pub struct ClawRuntimeInitError {
    pub message: String,
    pub code: RuntimeErrorCode,
}

#[derive(Debug, Clone)]
pub enum RuntimeErrorCode {
    ConfigInvalid,
    ProviderNotAvailable,
    PermissionDenied,
    SessionNotFound,
    MessageDeliveryFailed,
    InternalError,
}

impl ClawRuntime {
    /// 初始化运行时
    pub fn new(config: RuntimeConfig) -> Result<Self, ClawRuntimeInitError>;

    /// 创建新会话
    pub fn create_session(&self, project_path: &Path) -> Result<SessionId, RuntimeError>;

    /// 获取会话列表
    pub fn list_sessions(&self) -> Vec<SessionInfo>;

    /// 切换活跃会话
    pub fn switch_session(&self, session_id: SessionId) -> Result<(), RuntimeError>;

    /// 关闭会话
    pub fn close_session(&self, session_id: SessionId) -> Result<(), RuntimeError>;

    /// 发送消息（命令行原始格式）
    pub async fn send_message(
        &self,
        session_id: SessionId,
        input: &str,
    ) -> Result<StreamingResponse, RuntimeError>;

    /// 检查运行时可用性
    pub fn health_check(&self) -> RuntimeHealthStatus;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionInfo {
    pub id: SessionId,
    pub name: String,
    pub project_path: String,
    pub status: SessionStatus,
    pub created_at: u64,
    pub last_active_at: u64,
    pub message_count: usize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SessionStatus {
    Active,
    Idle,
    Running,
    Error,
}

pub type SessionId = String;

pub struct StreamingResponse {
    pub events: Pin<Box<dyn Stream<Item = ResponseEvent> + Send>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ResponseEvent {
    ContentBlockStart { index: usize, block_type: ContentBlockType },
    ContentBlockDelta { index: usize, delta: ContentDelta },
    ContentBlockStop { index: usize },
    MessageStart { message: MessageMetadata },
    MessageDelta { delta: MessageDelta },
    MessageStop,
    Error { message: String },
}
```

### 4.2 tauri-app 集成 (tauri-app/src-tauri/src/runtime_integration.rs)

```rust
use claw_runtime::{ClawRuntime, SessionId, RuntimeConfig, RuntimeError};

pub struct RuntimeState {
    runtime: ClawRuntime,
    sessions: HashMap<SessionId, SessionContext>,
}

pub struct SessionContext {
    project_path: PathBuf,
    chat_history: Vec<ChatMessage>,
}

#[tauri::command]
pub async fn init_runtime() -> Result<(), String> {
    let config = load_runtime_config().map_err(|e| e.to_string())?;
    let runtime = ClawRuntime::new(config).map_err(|e| e.to_string())?;

    STATE.set(RuntimeState { runtime, sessions: HashMap::new() })
        .map_err(|_| "Runtime already initialized")?;

    Ok(())
}

#[tauri::command]
pub async fn create_session(project_path: String) -> Result<SessionInfo, String> {
    let state = STATE.get().ok_or("Runtime not initialized")?;
    let path = PathBuf::from(&project_path);

    let session_id = state.runtime.create_session(&path).map_err(|e| e.to_string())?;

    state.sessions.insert(session_id.clone(), SessionContext {
        project_path: path,
        chat_history: Vec::new(),
    });

    Ok(state.runtime.get_session_info(&session_id).map_err(|e| e.to_string())?)
}

#[tauri::command]
pub async fn send_message(
    session_id: String,
    content: String,
) -> Result<StreamResponse, String> {
    let state = STATE.get().ok_or("Runtime not initialized")?;

    state.runtime.send_message(&session_id, &content).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_sessions() -> Result<Vec<SessionInfo>, String> {
    let state = STATE.get().ok_or("Runtime not initialized")?;
    Ok(state.runtime.list_sessions())
}

#[tauri::command]
pub async fn switch_session(session_id: String) -> Result<(), String> {
    let state = STATE.get().ok_or("Runtime not initialized")?;
    state.runtime.switch_session(&session_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn close_session(session_id: String) -> Result<(), String> {
    let state = STATE.get().ok_or("Runtime not initialized")?;
    state.sessions.remove(&session_id);
    state.runtime.close_session(&session_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn runtime_health_check() -> Result<HealthStatus, String> {
    let state = STATE.get().ok_or("Runtime not initialized")?;
    Ok(state.runtime.health_check())
}
```

---

## 5. 前端设计与数据模型

### 5.1 会话状态类型 (src/lib/types/session.ts)

```typescript
interface Session {
  id: string;
  name: string;
  projectPath: string;
  createdAt: Date;
  lastActiveAt: Date;
  status: 'active' | 'idle' | 'running' | 'error';
  currentModel?: AIModelConfig;
  messageCount: number;
}

interface SessionState {
  sessions: Session[];
  activeSessionId: string | null;
  isLoading: boolean;
  error: RuntimeError | null;
}

interface RuntimeError {
  type: RuntimeErrorType;
  message: string;
  recoverable: boolean;
  details?: Record<string, unknown>;
}

enum RuntimeErrorType {
  CLI_NOT_AVAILABLE = 'CLI_NOT_AVAILABLE',
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  MESSAGE_DELIVERY_FAILED = 'MESSAGE_DELIVERY_FAILED',
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
}
```

### 5.2 会话 Store (src/lib/stores/sessionStore.ts)

```typescript
interface SessionActions {
  createSession(projectPath: string): Promise<Session>;
  switchSession(sessionId: string): Promise<void>;
  closeSession(sessionId: string): Promise<void>;
  renameSession(sessionId: string, newName: string): Promise<void>;
  listSessions(): Promise<Session[]>;
  getActiveSession(): Session | null;
}

interface SessionStore extends SessionState, SessionActions {
  subscribe: (callback: (state: SessionState) => void) => () => void;
}
```

### 5.3 UI 组件结构

```
src/lib/components/
├── sessions/
│   ├── SessionSelector.svelte    # 顶部会话选择下拉框
│   ├── SessionList.svelte        # 展开的会话列表面板
│   ├── SessionListItem.svelte    # 单个会话项
│   ├── NewSessionDialog.svelte   # 创建新会话对话框
│   └── SessionContextMenu.svelte # 右键菜单
└── common/
    └── SessionBadge.svelte       # 状态徽章
```

### 5.4 SessionSelector UI 布局

```
┌─────────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │ 🔽 project-a-session-1  ▼  [+ New] [≡ Sessions]                 ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  展开的会话列表（点击 ≡ Sessions）:                                    │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │ ● project-a-session-1  (当前)                                    ││
│  │ ○ project-b-session-2                                            ││
│  │ ○ project-c-session-3                                            ││
│  │ ─────────────────────────────────────────────────────────────── ││
│  │ + 创建新会话                                                     ││
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

---

## 6. 移除直接 LLM 调用路径

### 6.1 chat_handler.rs 修改

**删除内容：**
- 移除 `chat_message` 函数中的所有直接 API 调用逻辑
- 移除 `provider`、`endpoint`、`api_key` 参数的直接使用
- 移除 Anthropic/OpenAI/Ollama 的请求构建和发送逻辑

**保留内容：**
- 保留作为 tauri-app 与 runtime 之间的适配层
- 将请求转发到 `runtime.send_message()`

### 6.2 重构后的 chat_handler.rs

```rust
pub async fn chat_message(
    State(state): State<Arc<AppState>>,
    Json(request): Json<ChatRequest>,
) -> Result<Json<Value>, axum::http::StatusCode> {
    let runtime = state.runtime.as_ref()
        .ok_or_else(|| {
            tracing::error!("Runtime not available");
            axum::http::StatusCode::SERVICE_UNAVAILABLE
        })?;

    let session_id = request.conversation_id
        .clone()
        .unwrap_or_else(|| "default".to_string());

    let response = runtime.send_message(&session_id, &request.content)
        .await
        .map_err(|e| {
            tracing::error!("Message send failed: {}", e);
            axum::http::StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(json!({
        "stream": response.events,
        "session_id": session_id,
    })))
}
```

---

## 7. 错误处理机制

### 7.1 错误分类

| 错误类型 | 代码 | 可恢复 | 处理策略 |
|----------|------|--------|----------|
| CLI_NOT_AVAILABLE | 001 | 否 | 阻止应用启动，显示安装指引 |
| SESSION_NOT_FOUND | 002 | 是 | 提示用户选择有效会话 |
| PERMISSION_DENIED | 003 | 是 | 弹出权限请求对话框 |
| MESSAGE_DELIVERY_FAILED | 004 | 是 | 自动重试或提示用户 |
| PROVIDER_ERROR | 005 | 是 | 降级到备用模型 |
| NETWORK_ERROR | 006 | 是 | 提示网络检查 |

### 7.2 UI 错误展示

```typescript
function handleRuntimeError(error: RuntimeError) {
  switch (error.type) {
    case 'CLI_NOT_AVAILABLE':
      showCriticalErrorDialog({
        title: '运行时不可用',
        message: 'Claw CLI 运行时初始化失败，系统无法处理消息。请检查安装。',
        severity: 'critical',
        blocking: true
      });
      break;

    case 'PERMISSION_DENIED':
      showPermissionPrompt(error.details);
      break;

    case 'MESSAGE_DELIVERY_FAILED':
      showRetryDialog({
        message: error.message,
        onRetry: () => resendMessage(),
        onCancel: () => discardMessage()
      });
      break;

    case 'PROVIDER_ERROR':
      showErrorToast({
        message: `模型调用失败: ${error.message}`,
        action: { label: '重试', onClick: retry }
      });
      break;
  }
}
```

### 7.3 启动时检查

```rust
#[tauri::command]
pub async fn check_runtime_ready() -> Result<RuntimeHealthStatus, String> {
    match STATE.get() {
        Some(state) => Ok(state.runtime.health_check()),
        None => Err("Runtime not initialized".to_string()),
    }
}
```

```typescript
async function initializeApp() {
  try {
    await initRuntime();
    const health = await checkRuntimeReady();

    if (health.status !== 'healthy') {
      throw new Error(`Runtime unhealthy: ${health.message}`);
    }

    await loadSessions();
    await connectWebSocket();

  } catch (error) {
    showCriticalErrorDialog({
      title: '启动失败',
      message: `无法初始化 Claw 运行时: ${error.message}`,
      blocking: true,
      action: {
        label: '退出',
        onClick: () => window.close()
      }
    });
  }
}
```

---

## 8. 指令格式规范

### 8.1 命令行格式

所有从 tauri-app 发送到 claw runtime 的消息采用原始命令行文本格式：

| 用户操作 | 发送的文本 | 说明 |
|----------|------------|------|
| 普通消息 | `帮我写一个函数` | 直接透传用户输入 |
| Agent 指令 | `/agent list` | Slash 命令格式 |
| 工具调用 | `/tool bash ls -la` | 显式工具调用 |
| 会话引用 | `@session-abc 帮我看看这个bug` | 引用其他会话 |

### 8.2 消息包装

```rust
impl MessageProcessor {
    pub fn process_input(&self, raw_input: &str) -> ProcessedInput {
        ProcessedInput {
            original: raw_input.to_string(),
            command_type: self.detect_command_type(raw_input),
            session_refs: self.extract_session_refs(raw_input),
            tool_calls: self.parse_tool_calls(raw_input),
            requires_confirmation: self.check_requires_confirmation(raw_input),
        }
    }
}
```

---

## 9. 实现计划

### 9.1 第一阶段：Runtime 库改造

1. 在 `runtime` crate 中创建统一导出接口
2. 重构 `session.rs` 支持多会话
3. 修改 `chat_handler.rs` 作为适配层
4. 添加健康检查端点

### 9.2 第二阶段：tauri-app 集成

1. 创建 `runtime_integration.rs` 模块
2. 实现 Tauri 命令绑定
3. 创建 `sessionStore.ts`
4. 实现会话 UI 组件

### 9.3 第三阶段：功能验证

1. 验证所有消息经过 runtime 处理
2. 测试多会话切换
3. 测试错误场景
4. 移除直接 API 调用路径

---

## 10. 验证清单

- [ ] tauri-app 启动时检查 runtime 可用性
- [ ] 所有聊天消息通过 `runtime.send_message()` 处理
- [ ] 多会话创建、切换、关闭功能正常
- [ ] 会话历史正确加载和保存
- [ ] 错误场景下正确提示用户
- [ ] 无任何直接与 LLM API 通信的代码路径
