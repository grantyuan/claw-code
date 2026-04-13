# 消息路由架构重构 - 迭代开发计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标：** 重构 Claw 消息路由架构，确保所有用户消息通过 claw runtime 处理，移除直接 LLM 调用路径，实现多会话 UI 支持。

**架构概述：**
- 采用库模式集成 claw runtime，tauri-app 直接调用而非启动子进程
- chat_handler.rs 改为适配层，仅转发消息到 runtime
- 支持多会话管理和切换
- 所有消息采用命令行原始文本格式

**技术栈：** Rust (runtime crate), TypeScript/Svelte 5, Tauri 2

**测试配置：** 本地 OpenAI 接口 `http://localhost:8000`，模型 `/model/Qwopus3.5-27B-v3-NVFP4`

---

## 迭代开发流程

```
┌─────────────────────────────────────────────────────────────────────┐
│                    迭代 1 - 5 循环                                  │
│                                                                     │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐       │
│  │ 计划设计 │──►│  开发实现 │──►│  测试验证 │──►│ 问题修复 │       │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘       │
│       ▲                                                │           │
│       │         ┌──────────┐   ┌──────────┐           │           │
│       └─────────│ 用户体验 │◄──│  对齐审查 │◄──────────┘           │
│                 └──────────┘   └──────────┘                       │
│                                                                     │
│  每轮迭代完成 → 执行 E2E 测试 → 全部通过? → 结束                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 每轮迭代任务清单

### 迭代 1：基础架构搭建

#### Phase 1.1: 计划与设计
- [ ] 确认设计方案文档
- [ ] 识别需要修改的核心文件
- [ ] 制定第一阶段开发任务

#### Phase 1.2: 开发实现
- [ ] **Task 1.2.1**: 在 runtime crate 创建统一导出接口 `runtime/src/lib.rs`
- [ ] **Task 1.2.2**: 修改 `runtime/src/session.rs` 支持多会话管理
- [ ] **Task 1.2.3**: 创建 `runtime/src/runtime_api.rs` 定义 ClawRuntime 结构
- [ ] **Task 1.2.4**: 修改 `cli-server/src/chat_handler.rs` 作为适配层

#### Phase 1.3: 测试验证
- [ ] **Task 1.3.1**: 配置测试环境 (localhost:8000, /model/Qwopus3.5-27B-v3-NVFP4)
- [ ] **Task 1.3.2**: 验证 runtime 初始化成功
- [ ] **Task 1.3.3**: 验证会话创建功能

#### Phase 1.4: 问题修复
- [ ] 修复 runtime 初始化问题
- [ ] 修复会话管理问题

#### Phase 1.5: 对齐审查
- [ ] 审查 runtime API 设计是否符合方案
- [ ] 审查消息转发逻辑

#### Phase 1.6: 用户体验拓展
- [ ] 初步设计会话状态展示

---

### 迭代 2：Runtime 核心功能

#### Phase 2.1: 计划与设计
- [ ] 根据迭代 1 结果调整计划
- [ ] 设计消息处理核心流程

#### Phase 2.2: 开发实现
- [ ] **Task 2.2.1**: 实现 `ClawRuntime::send_message()` 核心方法
- [ ] **Task 2.2.2**: 实现 `MessageProcessor` 处理命令行格式
- [ ] **Task 2.2.3**: 集成 `worker_boot.rs` 信任/提示传递
- [ ] **Task 2.2.4**: 实现 SSE 流式响应

#### Phase 2.3: 测试验证
- [ ] **Task 2.3.1**: 测试消息发送和响应
- [ ] **Task 2.3.2**: 测试流式响应
- [ ] **Task 2.3.3**: 测试 worker 状态机

#### Phase 2.4: 问题修复
- [ ] 修复消息处理问题
- [ ] 修复流式响应问题

#### Phase 2.5: 对齐审查
- [ ] 审查 send_message 实现
- [ ] 审查流式响应处理

#### Phase 2.6: 用户体验拓展
- [ ] 设计消息展示组件

---

### 迭代 3：多会话 UI 支持

#### Phase 3.1: 计划与设计
- [ ] 设计前端会话管理组件
- [ ] 定义 Session 数据结构

#### Phase 3.2: 开发实现
- [ ] **Task 3.2.1**: 创建 `src/lib/types/session.ts`
- [ ] **Task 3.2.2**: 创建 `src/lib/stores/sessionStore.ts`
- [ ] **Task 3.2.3**: 创建 `src/lib/components/sessions/SessionSelector.svelte`
- [ ] **Task 3.2.4**: 创建会话列表和切换功能

#### Phase 3.3: 测试验证
- [ ] **Task 3.3.1**: 测试多会话创建
- [ ] **Task 3.3.2**: 测试会话切换
- [ ] **Task 3.3.3**: 测试会话关闭

#### Phase 3.4: 问题修复
- [ ] 修复会话状态同步问题
- [ ] 修复 UI 状态问题

#### Phase 3.5: 对齐审查
- [ ] 审查会话管理功能完整性
- [ ] 审查 UI 交互设计

#### Phase 3.6: 用户体验拓展
- [ ] 添加会话右键菜单
- [ ] 添加会话状态徽章

---

### 迭代 4：移除直接 LLM 调用

#### Phase 4.1: 计划与设计
- [ ] 识别所有直接 LLM 调用路径
- [ ] 设计移除方案

#### Phase 4.2: 开发实现
- [ ] **Task 4.2.1**: 删除 `chat_handler.rs` 中的直接 API 调用
- [ ] **Task 4.2.2**: 重构为消息转发逻辑
- [ ] **Task 4.2.3**: 添加健康检查端点
- [ ] **Task 4.2.4**: 验证无直接调用路径

#### Phase 4.3: 测试验证
- [ ] **Task 4.3.1**: 测试所有消息通过 runtime
- [ ] **Task 4.3.2**: 测试健康检查端点
- [ ] **Task 4.3.3**: 验证无后门路径

#### Phase 4.4: 问题修复
- [ ] 修复发现的后门路径
- [ ] 修复转发逻辑问题

#### Phase 4.5: 对齐审查
- [ ] 完整代码审查
- [ ] 验证架构符合设计

#### Phase 4.6: 用户体验拓展
- [ ] 添加连接状态指示器
- [ ] 添加错误提示优化

---

### 迭代 5：E2E 测试与完善

#### Phase 5.1: 计划与设计
- [ ] 制定完整 E2E 测试计划
- [ ] 定义测试用例

#### Phase 5.2: 开发实现
- [ ] **Task 5.2.1**: 实现会话管理 E2E 测试
- [ ] **Task 5.2.2**: 实现消息发送 E2E 测试
- [ ] **Task 5.2.3**: 实现错误处理 E2E 测试

#### Phase 5.3: 测试验证
- [ ] **Task 5.3.1**: 执行完整 E2E 测试套件
- [ ] **Task 5.3.2**: 验证所有测试通过

#### Phase 5.4: 问题修复
- [ ] 修复任何失败的测试

#### Phase 5.5: 对齐审查
- [ ] 最终架构审查
- [ ] 验证所有需求满足

#### Phase 5.6: 用户体验拓展
- [ ] 最终 UX 优化

---

## 详细任务分解

### Task 1.2.1: 创建 runtime 统一导出接口

**文件:**
- 修改: `rust/crates/runtime/src/lib.rs`

**步骤 1: 添加 ClawRuntime 核心结构**

```rust
// rust/crates/runtime/src/lib.rs

pub mod session;
pub mod config;
pub mod worker_boot;
pub mod conversation;
pub mod permissions;
pub mod mcp;
pub mod tools;

use std::sync::{Arc, Mutex};
use std::path::PathBuf;
use thiserror::Error;

#[derive(Debug, Clone, Error)]
pub enum RuntimeError {
    #[error("Config error: {0}")]
    Config(String),
    #[error("Session not found: {0}")]
    SessionNotFound(String),
    #[error("Provider error: {0}")]
    Provider(String),
    #[error("Internal error: {0}")]
    Internal(String),
}

pub type Result<T> = std::result::Result<T, RuntimeError>;

#[derive(Debug, Clone)]
pub struct SessionId(pub String);

#[derive(Debug, Clone)]
pub enum SessionStatus {
    Active,
    Idle,
    Running,
    Error,
}

#[derive(Debug, Clone)]
pub struct SessionInfo {
    pub id: SessionId,
    pub name: String,
    pub project_path: PathBuf,
    pub status: SessionStatus,
    pub created_at: u64,
    pub last_active_at: u64,
    pub message_count: usize,
}

pub struct ClawRuntime {
    config: RuntimeConfig,
    sessions: Arc<Mutex<HashMap<SessionId, Session>>>,
}

impl ClawRuntime {
    pub fn new(config: RuntimeConfig) -> Result<Self> {
        Ok(Self {
            config,
            sessions: Arc::new(Mutex::new(HashMap::new())),
        })
    }

    pub fn create_session(&self, project_path: &PathBuf) -> Result<SessionId> {
        let id = SessionId(format!("session_{}", uuid::Uuid::new_v4()));
        let session = Session::new(id.clone(), project_path.clone());
        self.sessions.lock().unwrap().insert(id.clone(), session);
        Ok(id)
    }

    pub fn list_sessions(&self) -> Vec<SessionInfo> {
        self.sessions.lock().unwrap()
            .values()
            .map(|s| s.to_info())
            .collect()
    }

    pub fn get_session(&self, id: &SessionId) -> Option<Session> {
        self.sessions.lock().unwrap().get(id).cloned()
    }
}
```

**步骤 2: 创建 Session 结构**

```rust
// rust/crates/runtime/src/session.rs

#[derive(Debug, Clone)]
pub struct Session {
    pub id: SessionId,
    pub name: String,
    pub project_path: PathBuf,
    pub status: SessionStatus,
    pub created_at: u64,
    pub last_active_at: u64,
    pub message_count: usize,
    pub history: Vec<Message>,
}

impl Session {
    pub fn new(id: SessionId, project_path: PathBuf) -> Self {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        Self {
            id,
            name: project_path.file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_else(|| "Untitled".to_string()),
            project_path,
            status: SessionStatus::Idle,
            created_at: now,
            last_active_at: now,
            message_count: 0,
            history: Vec::new(),
        }
    }

    pub fn to_info(&self) -> SessionInfo {
        SessionInfo {
            id: self.id.clone(),
            name: self.name.clone(),
            project_path: self.project_path.clone(),
            status: self.status.clone(),
            created_at: self.created_at,
            last_active_at: self.last_active_at,
            message_count: self.message_count,
        }
    }
}
```

**步骤 3: 验证编译**

```bash
cd rust && cargo build --package runtime
```

---

### Task 1.2.2: 修改 chat_handler.rs 作为适配层

**文件:**
- 修改: `rust/crates/cli-server/src/chat_handler.rs`

**步骤 1: 重写 chat_message 函数**

```rust
// rust/crates/cli-server/src/chat_handler.rs

use axum::extract::State;
use axum::response::Json;
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;

use crate::AppState;

#[derive(Debug, Deserialize)]
pub struct ChatRequest {
    pub content: String,
    #[serde(default)]
    pub conversation_id: Option<String>,
    pub model: Option<String>,
}

pub async fn chat_message(
    State(state): State<Arc<AppState>>,
    Json(request): Json<ChatRequest>,
) -> Result<Json<Value>, axum::http::StatusCode> {
    let runtime = state.runtime.as_ref()
        .ok_or_else(|| {
            tracing::error!("Runtime not available - message routing bypass detected");
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
        "session_id": session_id,
        "content": response,
    })))
}
```

**步骤 2: 验证编译**

```bash
cd rust && cargo build --package cli-server
```

---

### Task 1.2.3: 实现 send_message 核心方法

**文件:**
- 修改: `rust/crates/runtime/src/runtime_api.rs`

**步骤 1: 实现消息处理**

```rust
// rust/crates/runtime/src/runtime_api.rs

use crate::{ClawRuntime, RuntimeError, Result, SessionId, SessionStatus};

#[derive(Debug, Clone)]
pub struct Message {
    pub role: String,
    pub content: String,
    pub timestamp: u64,
}

#[derive(Debug, Clone)]
pub struct ProcessedInput {
    pub original: String,
    pub command_type: CommandType,
    pub requires_confirmation: bool,
}

#[derive(Debug, Clone)]
pub enum CommandType {
    UserMessage,
    SlashCommand,
    ToolCall,
    SessionReference,
}

pub struct MessageProcessor {
    runtime: ClawRuntime,
}

impl MessageProcessor {
    pub fn new(runtime: ClawRuntime) -> Self {
        Self { runtime }
    }

    pub async fn process(&self, session_id: &SessionId, input: &str) -> Result<String> {
        let session = self.runtime.get_session(session_id)
            .ok_or_else(|| RuntimeError::SessionNotFound(session_id.0.clone()))?;

        let processed = self.parse_input(input);

        match processed.command_type {
            CommandType::UserMessage => {
                self.process_user_message(session_id, input).await
            }
            CommandType::SlashCommand => {
                self.process_slash_command(session_id, input).await
            }
            _ => self.process_user_message(session_id, input).await,
        }
    }

    fn parse_input(&self, input: &str) -> ProcessedInput {
        let trimmed = input.trim();
        let command_type = if trimmed.starts_with('/') {
            CommandType::SlashCommand
        } else if trimmed.starts_with('@') {
            CommandType::SessionReference
        } else if trimmed.contains("(") && trimmed.contains(")") {
            CommandType::ToolCall
        } else {
            CommandType::UserMessage
        };

        ProcessedInput {
            original: input.to_string(),
            command_type,
            requires_confirmation: false,
        }
    }

    async fn process_user_message(&self, session_id: &SessionId, content: &str) -> Result<String> {
        tracing::info!("Processing user message for session: {}", session_id.0);
        Ok(format!("Processed: {}", content))
    }

    async fn process_slash_command(&self, session_id: &SessionId, command: &str) -> Result<String> {
        tracing::info!("Processing slash command for session: {}", session_id.0);
        Ok(format!("Executed: {}", command))
    }
}
```

---

## 测试配置

### 本地测试环境

```bash
# 设置环境变量
export OPENAI_API_KEY="dummy"
export OPENAI_BASE_URL="http://localhost:8000"
export TEST_MODEL="/model/Qwopus3.5-27B-v3-NVFP4"
```

### E2E 测试命令

```bash
# 启动本地 OpenAI 兼容服务（假设已运行在 localhost:8000）

# 运行 E2E 测试
cd tauri-app && npm run test:e2e

# 或运行特定测试
cd tauri-app && npm run test:e2e -- --grep "session"
```

---

## 成功标准

每轮迭代完成需满足：

| 迭代 | 成功标准 |
|------|----------|
| 1 | Runtime 库编译通过，基础 API 可用 |
| 2 | 消息处理核心功能可用 |
| 3 | 多会话 UI 功能完整 |
| 4 | 无直接 LLM 调用路径 |
| 5 | 所有 E2E 测试通过 |

---

## 质量门禁

每轮迭代结束时执行：

```bash
# 1. Rust 编译检查
cd rust && cargo fmt && cargo clippy --workspace --all-targets -- -D warnings

# 2. Rust 测试
cd rust && cargo test --workspace

# 3. 前端类型检查
cd tauri-app && npm run typecheck

# 4. 前端测试
cd tauri-app && npm run test

# 5. E2E 测试
cd tauri-app && npm run test:e2e
```

---

## 文档更新

- [ ] `docs/plans/2026-04-13-message-routing-architecture-redesign.md` - 设计文档
- [ ] `docs/plans/2026-04-13-iteration-plan.md` - 本计划
- [ ] `CLAUDE.md` - 更新架构说明
- [ ] `rust/README.md` - 更新 runtime 使用说明
