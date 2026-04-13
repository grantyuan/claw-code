use crate::ollama_client::OllamaClientInterface;
use crate::strategy::config::StrategyConfig;
use crate::strategy::quality_evaluator::HybridQualityEvaluator;
use crate::strategy::self_assessment::{LocalSelfAssessment, TaskComplexity};
use api::{ApiError, InputContentBlock, InputMessage, MessageRequest, OutputContentBlock};
use std::sync::Arc;
use std::time::Instant;

const TASK_DECOMPOSITION_PROMPT: &str = r#"请将以下复杂任务分解为3-5个简单的子任务。

任务: {task}

请按以下JSON格式返回子任务列表:
{
    "subtasks": [
        {"id": 1, "description": "子任务1描述", "estimated_complexity": "simple"},
        {"id": 2, "description": "子任务2描述", "estimated_complexity": "simple"}
    ]
}

规则:
- 每个子任务应该可以独立执行
- 简单子任务用"simple"标记
- 复杂子任务用"complex"标记
- 只需要返回JSON，不要其他内容"#;

const SUBTASK_EXECUTION_PROMPT: &str = r#"执行以下子任务:

任务: {subtask}

返回你的执行结果。"#;

const QUALITY_REVIEW_PROMPT: &str = r#"请审查以下子任务的执行结果，并对质量不达标的部分进行修正。

原始任务: {original_task}
子任务: {subtask}
执行结果: {result}

如果结果质量达标(完整、准确)，返回原始结果。
如果质量不达标，返回修正后的结果。
只返回结果，不要解释。"#;

const RESULT_INTEGRATION_PROMPT: &str = r#"请整合以下子任务的结果，形成最终答案。

原始任务: {original_task}

{subtasks_results}

请形成完整、连贯的最终答案。"#;

pub struct StrategyProcessor {
    config: StrategyConfig,
    local_client: Arc<dyn OllamaClientInterface>,
    cloud_client: Arc<dyn OllamaClientInterface>,
    self_assessor: LocalSelfAssessment,
    quality_evaluator: HybridQualityEvaluator,
}

#[derive(Debug, Clone)]
struct SubTask {
    id: u32,
    description: String,
    complexity: String,
    result: Option<String>,
}

#[derive(Debug, Clone)]
struct DecomposedTask {
    subtasks: Vec<SubTask>,
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
            crate::strategy::ProcessingMode::SpeedFirst => self.speed_first_process(task).await,
            crate::strategy::ProcessingMode::TokenFirst => self.token_first_process(task).await,
        }
    }

    async fn speed_first_process(&self, task: &str) -> Result<StrategyResult, ApiError> {
        let start = Instant::now();

        if !self.config.enable_local_self_assessment {
            let cloud_response = self.call_cloud(task).await?;
            let quality = self.quality_evaluator.evaluate(&cloud_response, task);
            return Ok(StrategyResult {
                response: cloud_response,
                model_used: "remote".to_string(),
                complexity: TaskComplexity::Complex,
                quality_score: quality.final_score,
                processing_time_ms: start.elapsed().as_millis() as u64,
                tokens_saved_percent: 0.0,
                mode: crate::strategy::ProcessingMode::SpeedFirst,
            });
        }

        let assessment = self.self_assessor.assess_and_process(task).await?;

        match assessment.complexity {
            TaskComplexity::Simple | TaskComplexity::Medium => {
                let quality = self.quality_evaluator.evaluate(&assessment.response, task);
                Ok(StrategyResult {
                    response: assessment.response,
                    model_used: "local".to_string(),
                    complexity: assessment.complexity,
                    quality_score: quality.final_score,
                    processing_time_ms: start.elapsed().as_millis() as u64,
                    tokens_saved_percent: 100.0,
                    mode: crate::strategy::ProcessingMode::SpeedFirst,
                })
            }
            TaskComplexity::Complex => self.complex_task_pipeline(task, start).await,
        }
    }

    async fn complex_task_pipeline(
        &self,
        task: &str,
        start: Instant,
    ) -> Result<StrategyResult, ApiError> {
        // Step 1: 远程LLM分解任务
        let decomposed = self.cloud_decompose_task(task).await?;

        // Step 2: 并行执行子任务
        let subtasks_with_results = self.execute_subtasks_parallel(decomposed.subtasks).await;

        // Step 3: 远程LLM统一评估本地输出质量，不达标的重新处理
        let reviewed_results = self
            .evaluate_and_review_subtasks(task, subtasks_with_results)
            .await;

        // Step 4: 整合最终结果
        let final_response = self.integrate_results(task, reviewed_results).await?;
        let quality = self.quality_evaluator.evaluate(&final_response, task);

        Ok(StrategyResult {
            response: final_response,
            model_used: "local+remote".to_string(),
            complexity: TaskComplexity::Complex,
            quality_score: quality.final_score,
            processing_time_ms: start.elapsed().as_millis() as u64,
            tokens_saved_percent: 30.0,
            mode: crate::strategy::ProcessingMode::SpeedFirst,
        })
    }

    async fn cloud_decompose_task(&self, task: &str) -> Result<DecomposedTask, ApiError> {
        let prompt = TASK_DECOMPOSITION_PROMPT.replace("{task}", task);

        let response = self.call_cloud(&prompt).await?;

        // 解析JSON响应
        let cleaned = response
            .trim()
            .trim_start_matches("```json")
            .trim_start_matches("```")
            .trim_end_matches("```")
            .trim();

        #[derive(serde::Deserialize)]
        struct RawSubTask {
            id: u32,
            description: String,
            estimated_complexity: String,
        }

        #[derive(serde::Deserialize)]
        struct RawDecomposed {
            subtasks: Vec<RawSubTask>,
        }

        match serde_json::from_str::<RawDecomposed>(cleaned) {
            Ok(raw) => Ok(DecomposedTask {
                subtasks: raw
                    .subtasks
                    .into_iter()
                    .map(|st| SubTask {
                        id: st.id,
                        description: st.description,
                        complexity: st.estimated_complexity,
                        result: None,
                    })
                    .collect(),
            }),
            Err(_) => {
                // Fallback: 创建一个简单子任务
                Ok(DecomposedTask {
                    subtasks: vec![SubTask {
                        id: 1,
                        description: task.to_string(),
                        complexity: "simple".to_string(),
                        result: None,
                    }],
                })
            }
        }
    }

    async fn execute_subtasks_parallel(&self, subtasks: Vec<SubTask>) -> Vec<SubTask> {
        let mut results = Vec::new();

        for subtask in subtasks {
            let prompt = SUBTASK_EXECUTION_PROMPT.replace("{subtask}", &subtask.description);

            let result = if subtask.complexity == "simple" {
                match self.call_local(&prompt).await {
                    Ok(r) => r,
                    Err(_) => self.call_cloud(&prompt).await.unwrap_or_default(),
                }
            } else {
                self.call_cloud(&prompt).await.unwrap_or_default()
            };

            results.push(SubTask {
                id: subtask.id,
                description: subtask.description,
                complexity: subtask.complexity,
                result: Some(result),
            });
        }

        results
    }

    async fn evaluate_and_review_subtasks(
        &self,
        original_task: &str,
        subtasks: Vec<SubTask>,
    ) -> Vec<SubTask> {
        let mut reviewed = Vec::new();

        for subtask in subtasks {
            let result = subtask.result.clone().unwrap_or_default();
            let quality = self
                .quality_evaluator
                .evaluate(&result, &subtask.description);

            // 质量不达标，远程重新处理
            if quality.final_score < self.config.min_quality_threshold as f32 {
                let review_prompt = QUALITY_REVIEW_PROMPT
                    .replace("{original_task}", original_task)
                    .replace("{subtask}", &subtask.description)
                    .replace("{result}", &result);

                let reviewed_result = self.call_cloud(&review_prompt).await.unwrap_or(result);

                reviewed.push(SubTask {
                    id: subtask.id,
                    description: subtask.description,
                    complexity: subtask.complexity,
                    result: Some(reviewed_result),
                });
            } else {
                reviewed.push(subtask);
            }
        }

        reviewed
    }

    async fn integrate_results(
        &self,
        original_task: &str,
        subtasks: Vec<SubTask>,
    ) -> Result<String, ApiError> {
        let subtasks_text: String = subtasks
            .iter()
            .map(|st| {
                format!(
                    "子任务{}: {}\n结果: {}\n",
                    st.id,
                    st.description,
                    st.result.as_deref().unwrap_or("N/A")
                )
            })
            .collect();

        let prompt = RESULT_INTEGRATION_PROMPT
            .replace("{original_task}", original_task)
            .replace("{subtasks_results}", &subtasks_text);

        self.call_cloud(&prompt).await
    }

    async fn token_first_process(&self, task: &str) -> Result<StrategyResult, ApiError> {
        let start = Instant::now();

        let local_response = self.call_local(task).await?;
        let initial_quality = self.quality_evaluator.evaluate(&local_response, task);

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
            messages: vec![InputMessage {
                role: "user".to_string(),
                content: vec![InputContentBlock::Text {
                    text: task.to_string(),
                }],
            }],
            system: None,
            tools: None,
            tool_choice: None,
            stream: false,
        };

        let response = self.local_client.send_message(&request).await?;
        Ok(extract_text_from_response(&response))
    }

    async fn call_cloud(&self, task: &str) -> Result<String, ApiError> {
        let request = MessageRequest {
            model: "glm-4.7".to_string(),
            max_tokens: 4000,
            messages: vec![InputMessage {
                role: "user".to_string(),
                content: vec![InputContentBlock::Text {
                    text: task.to_string(),
                }],
            }],
            system: None,
            tools: None,
            tool_choice: None,
            stream: false,
        };

        let response = self.cloud_client.send_message(&request).await?;
        Ok(extract_text_from_response(&response))
    }
}

fn extract_text_from_response(response: &api::MessageResponse) -> String {
    response
        .content
        .iter()
        .find_map(|block| match block {
            OutputContentBlock::Text { text } => Some(text.clone()),
            _ => None,
        })
        .unwrap_or_default()
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
