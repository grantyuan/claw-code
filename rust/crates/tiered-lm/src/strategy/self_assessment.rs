use crate::ollama_client::OllamaClientInterface;
use crate::strategy::config::StrategyConfig;
use api::{ApiError, InputContentBlock, InputMessage, MessageRequest, MessageResponse};
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
    Simple,
    Medium,
    Complex,
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

#[allow(dead_code)]
pub struct LocalSelfAssessment {
    config: StrategyConfig,
    local_client: Arc<dyn OllamaClientInterface>,
}

impl LocalSelfAssessment {
    pub fn new(config: StrategyConfig, local_client: Arc<dyn OllamaClientInterface>) -> Self {
        Self {
            config,
            local_client,
        }
    }

    pub async fn assess_and_process(&self, task: &str) -> Result<SelfAssessmentResult, ApiError> {
        let start = std::time::Instant::now();

        let prompt = SELF_ASSESSMENT_PROMPT.replace("{task}", task);

        let request = MessageRequest {
            model: "local".to_string(),
            max_tokens: 2000,
            messages: vec![InputMessage {
                role: "user".to_string(),
                content: vec![InputContentBlock::Text { text: prompt }],
            }],
            system: None,
            tools: None,
            tool_choice: None,
            stream: false,
            temperature: None,
            top_p: None,
            frequency_penalty: None,
            presence_penalty: None,
            stop: None,
            reasoning_effort: None,
        };

        let response = self.local_client.send_message(&request).await?;

        let response_text = extract_text_from_response(&response);

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

fn extract_text_from_response(response: &MessageResponse) -> String {
    response
        .content
        .iter()
        .find_map(|block| match block {
            api::OutputContentBlock::Text { text } => Some(text.clone()),
            _ => None,
        })
        .unwrap_or_default()
}
