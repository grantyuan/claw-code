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

## 文档与代码对齐状态

> **最后更新**: 2026-04-14
> **审核结果**: 文档与代码存在多处不一致，以下为需要关注的对齐项

### ✅ 已对齐

| 项目 | 文档描述 | 实际代码 |
|------|---------|---------|
| ClawRuntime 核心功能 | send_message, create_session, list_sessions | `cli-server/src/runtime/mod.rs` 已实现 |
| chat_handler.rs 适配层 | 转发消息到 runtime | 已正确实现 |
| MessageProcessor | 解析命令行格式输入 | 已实现 CommandType 枚举 |
| Session Status | Active/Idle/Running/Error | 已对齐 |
| Session Store (TS) | 会话状态管理 | `tauri-app/src/lib/stores/sessionStore.ts` 已实现 |
| ChatHistoryDB | IndexedDB 存储 | `tauri-app/src/lib/services/chatHistoryDB.ts` 已实现 |
| ChatHistoryService | CRUD + 搜索 + resubmit | `tauri-app/src/lib/services/chatHistoryService.ts` 已实现 |
| 历史组件 | ChatHistoryPanel, HistoryListItem | `src/lib/components/history/` 已实现 |

### ⚠️ 未对齐/需修复

| 项目 | 文档描述 | 实际代码 | 状态 |
|------|---------|---------|------|
| ClawRuntime 位置 | `runtime/src/lib.rs` | `cli-server/src/runtime/mod.rs` | 已更新文档 |
| SessionId 类型 | `type alias String` | `struct SessionId(String)` wrapper | 已更新文档 |
| send_message 返回值 | `StreamingResponse` (SSE) | `Result<String>` | 待实现 SSE |
| 前端 Session 类型 | 包含 agentId, tags, isArchived | `tauri-app/src/lib/types/session.ts` 缺少字段 | 需要补充 |
| runtime_integration.rs | `tauri-app/src-tauri/src/runtime_integration.rs` | 不存在 | 待创建 |

### 📋 后续行动

1. **高优先级**: 实现 SSE 流式响应支持 (`StreamingResponse`)
2. **中优先级**: 补充前端 Session 类型缺失字段
3. **中优先级**: 创建 `runtime_integration.rs` 或在现有代码中实现 tauri 命令

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
- [x] **Task 1.2.4**: 修改 `cli-server/src/chat_handler.rs` 作为适配层 ✅ 已完成

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
- [x] **Task 2.2.1**: 实现 `ClawRuntime::send_message()` 核心方法 ✅ 已完成
- [x] **Task 2.2.2**: 实现 `MessageProcessor` 处理命令行格式 ✅ 已完成
- [ ] **Task 2.2.3**: 集成 `worker_boot.rs` 信任/提示传递
- [x] **Task 2.2.4**: 实现 SSE 流式响应 ✅ 已完成 (StreamingResponse 已添加)

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
- 修改: `rust/crates/cli-server/src/runtime/mod.rs` (实际 ClawRuntime 位置)
- 注意: `rust/crates/runtime/src/lib.rs` 是 core runtime primitives，不包含 ClawRuntime

**步骤 1: 确认 ClawRuntime 核心结构**

```rust
// rust/crates/cli-server/src/runtime/mod.rs

#[derive(Debug, Clone)]
pub struct SessionId(String);  // 注意：这是 struct wrapper，不是 type alias

impl SessionId {
    pub fn new(id: String) -> Self { Self(id) }
    pub fn as_str(&self) -> &str { &self.0 }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SessionStatus {
    Active,
    Idle,
    Running,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionInfo {
    pub id: SessionId,
    pub name: String,
    pub project_path: PathBuf,
    pub status: SessionStatus,
    pub created_at: u64,
    pub last_active_at: u64,
    pub message_count: usize,
}

#[derive(Debug)]
pub struct ClawRuntime {
    config: RuntimeConfig,
    sessions: Arc<Mutex<HashMap<SessionId, Session>>>,
    provider: ProviderClient,
}

impl ClawRuntime {
    pub fn new(config: RuntimeConfig) -> Result<Self> {
        let provider = ProviderClient::from_model(&config.model)
            .map_err(|e: ApiError| RuntimeError::Provider(e.to_string()))?;
        Ok(Self {
            config,
            sessions: Arc::new(Mutex::new(HashMap::new())),
            provider,
        })
    }

    pub async fn create_session(&self, project_path: &Path) -> Result<SessionId> { ... }
    pub async fn list_sessions(&self) -> Vec<SessionInfo> { ... }
    pub async fn get_session(&self, id: &SessionId) -> Option<Session> { ... }
    pub async fn send_message(&self, session_id: &str, input: &str) -> Result<String> { ... }
    pub async fn health_check(&self) -> HealthStatus { ... }
}
```

**注意**: 当前 `send_message` 返回 `Result<String>`，文档设计要求返回 `StreamingResponse` (SSE stream)，这是一个未对齐项。

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
- 修改: `rust/crates/cli-server/src/runtime/mod.rs` (实际位置)

**步骤 1: send_message 实现**

```rust
// rust/crates/cli-server/src/runtime/mod.rs

impl ClawRuntime {
    pub async fn send_message(&self, session_id: &str, input: &str) -> Result<String> {
        let session_id = SessionId::new(session_id.to_string());
        let processed = MessageProcessor::parse_input(input);

        tracing::info!(
            "Processing message for session: {}, type: {:?}, content_len: {}",
            session_id,
            processed.command_type,
            input.len()
        );

        let response = {
            let mut sessions = self.sessions.lock().await;
            let session = sessions
                .get_mut(&session_id)
                .ok_or_else(|| RuntimeError::SessionNotFound(session_id.to_string()))?;

            session.last_active_at = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs();
            session.status = SessionStatus::Running;
            session.message_count += 1;

            // 添加用户消息到历史
            session.history.push(Message {
                role: "user".to_string(),
                content: input.to_string(),
                timestamp: now,
            });

            let result = match processed.command_type {
                CommandType::SlashCommand => self.process_slash_command(&session_id, input)?,
                _ => self.call_llm(session, input).await?,
            };

            // 添加助手消息到历史
            session.history.push(Message {
                role: "assistant".to_string(),
                content: result.clone(),
                timestamp: SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_secs(),
            });

            session.status = SessionStatus::Idle;
            result
        };

        Ok(response)
    }

    async fn call_llm(&self, session: &Session, input: &str) -> Result<String> {
        let MessageResponse { content, .. }: MessageResponse = self
            .provider
            .send_message(&MessageRequest {
                model: self.config.model.clone(),
                max_tokens: 4096,
                messages: {
                    let mut msgs = session.to_api_messages();
                    msgs.push(InputMessage::user_text(input));
                    msgs
                },
                // ... 其他参数
            })
            .await?;
        // 提取文本内容
        let text = content.into_iter().filter_map(|block| {
            if let OutputContentBlock::Text { text } = block { Some(text) } else { None }
        }).collect::<Vec<_>>().join("\n");
        Ok(text)
    }
}
```

**注意**: 当前实现已包含 `send_message` 方法，但返回类型是 `Result<String>` 而不是设计文档中的 `StreamingResponse` (SSE 流)。如需支持流式响应，需要实现 SSE 支持。

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
