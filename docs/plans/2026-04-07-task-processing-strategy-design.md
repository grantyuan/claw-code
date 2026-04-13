# Task Processing Strategy Configuration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为clawcode tiered-lm系统添加"速度优先"和"Token优先"两种任务处理策略模式

**Architecture:** 在现有tiered-lm crate中新增StrategyConfig和TaskProcessingStrategy模块，利用本地模型自评估复杂度，结合混合质量评估引擎，实现双模式无缝切换

**Tech Stack:** Rust, tiered-lm crate, OllamaClient, AnthropicClient

---

## Overview

本实现将在 `/home/dss/work_py3_12/claw-code/rust/crates/tiered-lm/` 中添加新的策略处理模块，支持：

1. **速度优先模式** - 复杂任务分配给远程，本地处理简单子任务
2. **Token优先模式** - 本地优先处理，远程仅补充不足

---

## Task List

### Task 1: 创建基础策略配置结构

**Files:**
- Create: `crates/tiered-lm/src/strategy/config.rs`
- Modify: `crates/tiered-lm/src/lib.rs`
- Modify: `crates/tiered-lm/Cargo.toml`

**Step 1: Create strategy/config.rs**

```rust
use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProcessingMode {
    SpeedFirst,   // 速度优先
    TokenFirst,   // Token优先
}

impl Default for ProcessingMode {
    fn default() -> Self {
        Self::SpeedFirst
    }
}

impl fmt::Display for ProcessingMode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ProcessingMode::SpeedFirst => write!(f, "speed_first"),
            ProcessingMode::TokenFirst => write!(f, "token_first"),
        }
    }
}

#[derive(Debug, Clone)]
pub struct StrategyConfig {
    pub mode: ProcessingMode,
    pub quality_threshold: u8,
    pub enable_local_self_assessment: bool,
    pub self_assessment_timeout_ms: u32,
    pub reasoning_time_weight: f32,
    pub reasoning_steps_weight: f32,
    pub simple_task_local_token_limit: u32,
    pub medium_task_remote_token_limit: u32,
    pub min_quality_threshold: u8,
    pub retry_quality_threshold: u8,
}

impl Default for StrategyConfig {
    fn default() -> Self {
        Self {
            mode: ProcessingMode::SpeedFirst,
            quality_threshold: 70,
            enable_local_self_assessment: true,
            self_assessment_timeout_ms: 10000,
            reasoning_time_weight: 0.5,
            reasoning_steps_weight: 0.5,
            simple_task_local_token_limit: 500,
            medium_task_remote_token_limit: 2000,
            min_quality_threshold: 50,
            retry_quality_threshold: 35,
        }
    }
}

impl StrategyConfig {
    pub fn from_env() -> Self {
        let mode = std::env::var("CLAW_PROCESSING_MODE")
            .map(|v| match v.as_str() {
                "token_first" => ProcessingMode::TokenFirst,
                _ => ProcessingMode::SpeedFirst,
            })
            .unwrap_or_default();

        Self {
            mode,
            quality_threshold: std::env::var("CLAW_QUALITY_THRESHOLD")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(70),
            ..Default::default()
        }
    }
}
```

**Step 2: Run cargo check to verify**

```bash
cd /home/dss/work_py3_12/claw-code/rust && cargo check -p tiered-lm
```

**Step 3: Update lib.rs**

Add to lib.rs:
```rust
pub mod strategy;
pub use strategy::config::{ProcessingMode, StrategyConfig};
```

**Step 4: Run cargo check again**

```bash
cargo check -p tiered-lm
```

---

### Task 2: 创建本地模型自评估模块

**Files:**
- Create: `crates/tiered-lm/src/strategy/self_assessment.rs`
- Modify: `crates/tiered-lm/src/strategy/mod.rs`

**Step 1: Create self_assessment.rs**

```rust
use crate::ollama_client::OllamaClientInterface;
use crate::strategy::config::StrategyConfig;
use api::{ApiError, MessageRequest};
use std::sync::Arc;

const SELF_ASSESSMENT_PROMPT: &str = r#"请先评估以下任务的复杂度，然后进行处理。

评估标准:
- 简单任务: 单步完成、无需推理、答案明确 (如: 计算、查询、简单转换)
- 中等任务: 需多步推理、部分上下文依赖 (如: 解释概念、分析代码)
- 复杂任务: 多层面推理、长程依赖、需要分解 (如: 系统设计、代码重构、多文件分析)

任务: {task}

请按以下格式响应:
COMPLEXITY: [简单/中等/复杂]
REASONING: [你的评估理由，不超过50字]
---
[你的实际处理结果]"#;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TaskComplexity {
    Simple,    // 简单
    Medium,    // 中等
    Complex,   // 复杂
}

impl TaskComplexity {
    pub fn from_str(s: &str) -> Self {
        if s.contains("复杂") || s.contains("Complex") {
            TaskComplexity::Complex
        } else if s.contains("中等") || s.contains("Medium") {
            TaskComplexity::Medium
        } else {
            TaskComplexity::Simple
        }
    }
}

#[derive(Debug, Clone)]
pub struct SelfAssessmentResult {
    pub complexity: TaskComplexity,
    pub reasoning: String,
    pub response: String,
    pub processing_time_ms: u64,
}

pub struct LocalSelfAssessment {
    config: StrategyConfig,
    local_client: Arc<dyn OllamaClientInterface>,
}

impl LocalSelfAssessment {
    pub fn new(config: StrategyConfig, local_client: Arc<dyn OllamaClientInterface>) -> Self {
        Self { config, local_client }
    }

    pub async fn assess_and_process(
        &self,
        task: &str,
    ) -> Result<SelfAssessmentResult, ApiError> {
        let start = std::time::Instant::now();

        let prompt = SELF_ASSESSMENT_PROMPT.replace("{task}", task);

        let request = MessageRequest {
            model: "local".to_string(),
            max_tokens: 2000,
            messages: vec![api::InputMessage {
                role: api::Role::User,
                content: vec![api::InputContentBlock::Text { text: prompt }],
            }],
            system: None,
            tools: None,
            tool_choice: None,
            stream: false,
        };

        let response = self.local_client.send_message(&request).await?;

        let response_text = response.content
            .first()
            .and_then(|b| match b {
                api::OutputContentBlock::Text { text } => Some(text.clone()),
                _ => None,
            })
            .unwrap_or_default();

        let (complexity, reasoning) = self.parse_assessment(&response_text);

        Ok(SelfAssessmentResult {
            complexity,
            reasoning,
            response: response_text,
            processing_time_ms: start.elapsed().as_millis() as u64,
        })
    }

    fn parse_assessment(&self, response: &str) -> (TaskComplexity, String) {
        let parts: Vec<&str> = response.split("---").collect();
        let header = parts.first().unwrap_or(&response);

        let complexity = if header.contains("复杂") || header.contains("Complex") {
            TaskComplexity::Complex
        } else if header.contains("中等") || header.contains("Medium") {
            TaskComplexity::Medium
        } else {
            TaskComplexity::Simple
        };

        let reasoning = header
            .lines()
            .find(|l| l.starts_with("REASONING:"))
            .map(|l| l.replace("REASONING:", "").trim().to_string())
            .unwrap_or_default();

        (complexity, reasoning)
    }
}
```

**Step 2: Create strategy/mod.rs**

```rust
pub mod config;
pub mod self_assessment;

pub use config::{ProcessingMode, StrategyConfig};
pub use self_assessment::{LocalSelfAssessment, TaskComplexity, SelfAssessmentResult};
```

**Step 3: Run cargo check**

```bash
cargo check -p tiered-lm
```

---

### Task 3: 创建混合质量评估引擎

**Files:**
- Create: `crates/tiered-lm/src/strategy/quality_evaluator.rs`
- Modify: `crates/tiered-lm/src/strategy/mod.rs`

**Step 1: Create quality_evaluator.rs**

```rust
use std::sync::Arc;

#[derive(Debug, Clone)]
pub struct QualityMetrics {
    pub completeness: f32,
    pub coherence: f32,
    pub accuracy: f32,
    pub final_score: f32,
}

impl Default for QualityMetrics {
    fn default() -> Self {
        Self {
            completeness: 50.0,
            coherence: 50.0,
            accuracy: 50.0,
            final_score: 50.0,
        }
    }
}

pub trait QualityEvaluator: Send + Sync {
    fn evaluate(&self, response: &str, context: &str) -> QualityMetrics;
}

pub struct RuleBasedEvaluator;

impl RuleBasedEvaluator {
    pub fn new() -> Self {
        Self
    }

    pub fn evaluate(&self, response: &str, _context: &str) -> QualityMetrics {
        let completeness = self.evaluate_completeness(response);
        let coherence = self.evaluate_coherence(response);
        let accuracy = self.evaluate_accuracy(response);
        let final_score = completeness * 0.3 + coherence * 0.3 + accuracy * 0.4;

        QualityMetrics {
            completeness,
            coherence,
            accuracy,
            final_score,
        }
    }

    fn evaluate_completeness(&self, response: &str) -> f32 {
        let word_count = response.split_whitespace().count();
        let char_count = response.len();

        if word_count < 10 {
            30.0
        } else if word_count < 50 {
            60.0
        } else if char_count > 200 {
            85.0
        } else {
            70.0
        }
    }

    fn evaluate_coherence(&self, response: &str) -> f32 {
        let sentences: Vec<&str> = response.split(|c| c == '.' || c == '!' || c == '?')
            .filter(|s| !s.trim().is_empty())
            .collect();

        if sentences.len() <= 1 {
            50.0
        } else if sentences.len() <= 3 {
            70.0
        } else {
            85.0
        }
    }

    fn evaluate_accuracy(&self, response: &str) -> f32 {
        let has_ending_punctuation = response.trim().ends_with('.')
            || response.trim().ends_with('!')
            || response.trim().ends_with('?');

        if has_ending_punctuation {
            80.0
        } else {
            50.0
        }
    }
}

pub struct HybridQualityEvaluator {
    rule_engine: RuleBasedEvaluator,
}

impl HybridQualityEvaluator {
    pub fn new() -> Self {
        Self {
            rule_engine: RuleBasedEvaluator::new(),
        }
    }

    pub fn evaluate(&self, response: &str, context: &str) -> QualityMetrics {
        self.rule_engine.evaluate(response, context)
    }
}
```

**Step 2: Update strategy/mod.rs**

```rust
pub mod config;
pub mod self_assessment;
pub mod quality_evaluator;

pub use config::{ProcessingMode, StrategyConfig};
pub use self_assessment::{LocalSelfAssessment, TaskComplexity, SelfAssessmentResult};
pub use quality_evaluator::{QualityEvaluator, QualityMetrics, RuleBasedEvaluator, HybridQualityEvaluator};
```

**Step 3: Run cargo check**

```bash
cargo check -p tiered-lm
```

---

### Task 4: 创建主策略处理器

**Files:**
- Create: `crates/tiered-lm/src/strategy/processor.rs`
- Modify: `crates/tiered-lm/src/strategy/mod.rs`
- Modify: `crates/tiered-lm/src/lib.rs`

**Step 1: Create processor.rs**

```rust
use crate::ollama_client::OllamaClientInterface;
use crate::strategy::{LocalSelfAssessment, HybridQualityEvaluator, StrategyConfig, TaskComplexity};
use crate::optimization::dual_model::{DualModelProcessor, DualModelConfig, DualModelRequest};
use api::{ApiError, MessageRequest, Role, InputContentBlock, OutputContentBlock};
use std::sync::Arc;
use std::time::Instant;

#[derive(Debug, Clone)]
pub struct StrategyProcessor {
    config: StrategyConfig,
    local_client: Arc<dyn OllamaClientInterface>,
    cloud_client: Arc<dyn OllamaClientInterface>,
    self_assessor: LocalSelfAssessment,
    quality_evaluator: HybridQualityEvaluator,
}

impl StrategyProcessor {
    pub fn new(
        config: StrategyConfig,
        local_client: Arc<dyn OllamaClientInterface>,
        cloud_client: Arc<dyn OllamaClientInterface>,
    ) -> Self {
        let self_assessor = LocalSelfAssessment::new(config.clone(), local_client.clone());
        let quality_evaluator = HybridQualityEvaluator::new();

        Self {
            config,
            local_client,
            cloud_client,
            self_assessor,
            quality_evaluator,
        }
    }

    pub async fn process(&self, task: &str) -> Result<StrategyResult, ApiError> {
        match self.config.mode {
            crate::strategy::ProcessingMode::SpeedFirst => {
                self.speed_first_process(task).await
            }
            crate::strategy::ProcessingMode::TokenFirst => {
                self.token_first_process(task).await
            }
        }
    }

    async fn speed_first_process(&self, task: &str) -> Result<StrategyResult, ApiError> {
        let start = Instant::now();

        // Step 1: 本地模型自评估复杂度
        let assessment = self.self_assessor.assess_and_process(task).await?;

        let result = match assessment.complexity {
            TaskComplexity::Simple | TaskComplexity::Medium => {
                // 简单/中等任务 - 本地处理
                let quality = self.quality_evaluator.evaluate(&assessment.response, task);
                StrategyResult {
                    response: assessment.response,
                    model_used: "local".to_string(),
                    complexity: assessment.complexity,
                    quality_score: quality.final_score,
                    processing_time_ms: start.elapsed().as_millis() as u64,
                    tokens_saved_percent: 100.0,
                    mode: crate::strategy::ProcessingMode::SpeedFirst,
                }
            }
            TaskComplexity::Complex => {
                // 复杂任务 - 远程处理
                let cloud_response = self.call_cloud(task).await?;
                let quality = self.quality_evaluator.evaluate(&cloud_response, task);
                StrategyResult {
                    response: cloud_response,
                    model_used: "remote".to_string(),
                    complexity: TaskComplexity::Complex,
                    quality_score: quality.final_score,
                    processing_time_ms: start.elapsed().as_millis() as u64,
                    tokens_saved_percent: 0.0,
                    mode: crate::strategy::ProcessingMode::SpeedFirst,
                }
            }
        };

        Ok(result)
    }

    async fn token_first_process(&self, task: &str) -> Result<StrategyResult, ApiError> {
        let start = Instant::now();

        // Step 1: 本地模型生成结果
        let local_response = self.call_local(task).await?;
        let initial_quality = self.quality_evaluator.evaluate(&local_response, task);

        // Step 2: 质量检查
        if initial_quality.final_score >= self.config.quality_threshold as f32 {
            return Ok(StrategyResult {
                response: local_response,
                model_used: "local".to_string(),
                complexity: TaskComplexity::Medium,
                quality_score: initial_quality.final_score,
                processing_time_ms: start.elapsed().as_millis() as u64,
                tokens_saved_percent: 100.0,
                mode: crate::strategy::ProcessingMode::TokenFirst,
            });
        }

        // Step 3: 质量不达标 - 远程补充
        let patch_prompt = format!(
            "请审查并补充以下本地模型生成的输出，使其达到质量标准。\n\n原始任务: {}\n\n本地输出:\n{}\n\n请只修改必要的部分，保持本地生成的有效内容。",
            task, local_response
        );

        let improved_response = self.call_cloud(&patch_prompt).await?;
        let final_quality = self.quality_evaluator.evaluate(&improved_response, task);

        Ok(StrategyResult {
            response: improved_response,
            model_used: "local+remote".to_string(),
            complexity: TaskComplexity::Medium,
            quality_score: final_quality.final_score,
            processing_time_ms: start.elapsed().as_millis() as u64,
            tokens_saved_percent: 50.0,
            mode: crate::strategy::ProcessingMode::TokenFirst,
        })
    }

    async fn call_local(&self, task: &str) -> Result<String, ApiError> {
        let request = MessageRequest {
            model: "local".to_string(),
            max_tokens: 2000,
            messages: vec![api::InputMessage {
                role: Role::User,
                content: vec![InputContentBlock::Text { text: task.to_string() }],
            }],
            system: None,
            tools: None,
            tool_choice: None,
            stream: false,
        };

        let response = self.local_client.send_message(&request).await?;
        Ok(response.content
            .first()
            .and_then(|b| match b {
                OutputContentBlock::Text { text } => Some(text.clone()),
                _ => None,
            })
            .unwrap_or_default())
    }

    async fn call_cloud(&self, task: &str) -> Result<String, ApiError> {
        let request = MessageRequest {
            model: "claude-sonnet-4-6".to_string(),
            max_tokens: 4000,
            messages: vec![api::InputMessage {
                role: Role::User,
                content: vec![InputContentBlock::Text { text: task.to_string() }],
            }],
            system: None,
            tools: None,
            tool_choice: None,
            stream: false,
        };

        let response = self.cloud_client.send_message(&request).await?;
        Ok(response.content
            .first()
            .and_then(|b| match b {
                OutputContentBlock::Text { text } => Some(text.clone()),
                _ => None,
            })
            .unwrap_or_default())
    }
}

#[derive(Debug, Clone)]
pub struct StrategyResult {
    pub response: String,
    pub model_used: String,
    pub complexity: TaskComplexity,
    pub quality_score: f32,
    pub processing_time_ms: u64,
    pub tokens_saved_percent: f32,
    pub mode: crate::strategy::ProcessingMode,
}
```

**Step 2: Update strategy/mod.rs**

```rust
pub mod config;
pub mod self_assessment;
pub mod quality_evaluator;
pub mod processor;

pub use config::{ProcessingMode, StrategyConfig};
pub use self_assessment::{LocalSelfAssessment, TaskComplexity, SelfAssessmentResult};
pub use quality_evaluator::{QualityEvaluator, QualityMetrics, RuleBasedEvaluator, HybridQualityEvaluator};
pub use processor::{StrategyProcessor, StrategyResult};
```

**Step 3: Update lib.rs exports**

```rust
pub mod strategy;
pub use strategy::{ProcessingMode, StrategyConfig, StrategyProcessor, StrategyResult};
```

**Step 4: Run cargo check**

```bash
cargo check -p tiered-lm
```

---

### Task 5: 添加单元测试

**Files:**
- Create: `crates/tiered-lm/src/strategy/tests.rs`
- Run tests

**Step 1: Create tests.rs**

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_processing_mode_default() {
        let config = StrategyConfig::default();
        assert_eq!(config.mode, ProcessingMode::SpeedFirst);
    }

    #[test]
    fn test_processing_mode_display() {
        assert_eq!(ProcessingMode::SpeedFirst.to_string(), "speed_first");
        assert_eq!(ProcessingMode::TokenFirst.to_string(), "token_first");
    }

    #[test]
    fn test_task_complexity_from_str() {
        assert_eq!(TaskComplexity::from_str("复杂"), TaskComplexity::Complex);
        assert_eq!(TaskComplexity::from_str("中等"), TaskComplexity::Medium);
        assert_eq!(TaskComplexity::from_str("简单"), TaskComplexity::Simple);
        assert_eq!(TaskComplexity::from_str("Complex"), TaskComplexity::Complex);
        assert_eq!(TaskComplexity::from_str("unknown"), TaskComplexity::Simple);
    }

    #[test]
    fn test_quality_metrics_default() {
        let metrics = QualityMetrics::default();
        assert_eq!(metrics.final_score, 50.0);
    }

    #[test]
    fn test_rule_based_evaluator_short_response() {
        let evaluator = RuleBasedEvaluator::new();
        let metrics = evaluator.evaluate("Hi", "test");
        assert!(metrics.completeness < 50.0);
    }

    #[test]
    fn test_rule_based_evaluator_long_response() {
        let evaluator = RuleBasedEvaluator::new();
        let metrics = evaluator.evaluate(
            "This is a longer response. It has multiple sentences. And it ends with a period.",
            "test"
        );
        assert!(metrics.final_score > 60.0);
    }
}
```

**Step 2: Run tests**

```bash
cd /home/dss/work_py3_12/claw-code/rust && cargo test -p tiered-lm strategy -- --nocapture
```

---

### Task 6: 运行完整测试套件

**Step 1: Run all tiered-lm tests**

```bash
cargo test -p tiered-lm -- --nocapture
```

**Step 2: Run workspace checks**

```bash
cargo fmt
cargo clippy -p tiered-lm -- -D warnings
```

---

## 验收标准

1. ✅ `StrategyConfig` 可从环境变量读取配置
2. ✅ `LocalSelfAssessment` 可调用本地模型进行自评估
3. ✅ `HybridQualityEvaluator` 提供混合质量评估
4. ✅ `StrategyProcessor` 支持速度优先和Token优先两种模式
5. ✅ 所有单元测试通过
6. ✅ `cargo fmt` 和 `cargo clippy` 无警告

---

## 实现文件清单

```
crates/tiered-lm/src/strategy/
├── mod.rs           # 模块入口
├── config.rs        # 策略配置结构
├── self_assessment.rs  # 本地模型自评估
├── quality_evaluator.rs # 质量评估引擎
├── processor.rs     # 主策略处理器
└── tests.rs        # 单元测试
```

---

**Plan complete.** Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**