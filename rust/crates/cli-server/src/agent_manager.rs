use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentInfo {
    pub id: String,
    pub name: String,
    pub role: String,
    pub status: String,
    pub model: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current_task: Option<String>,
    pub progress: f32,
    pub metrics: AgentMetrics,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentMetrics {
    pub tasks_completed: u32,
    pub tasks_failed: u32,
    pub average_response_time_ms: u64,
    pub total_tokens_used: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub status: String,
    pub priority: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub assigned_agent: Option<String>,
    pub progress: f32,
    pub dependencies: Vec<String>,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub started_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<String>,
}

pub struct AgentManager {
    agents: HashMap<String, AgentInfo>,
    tasks: HashMap<String, TaskInfo>,
}

impl AgentManager {
    pub fn new() -> Self {
        let mut agents = HashMap::new();
        
        let leader = AgentInfo {
            id: "leader-default".to_string(),
            name: "Leader Agent".to_string(),
            role: "leader".to_string(),
            status: "idle".to_string(),
            model: "claude-3-opus".to_string(),
            current_task: None,
            progress: 0.0,
            metrics: AgentMetrics {
                tasks_completed: 0,
                tasks_failed: 0,
                average_response_time_ms: 0,
                total_tokens_used: 0,
            },
            created_at: chrono::Utc::now().to_rfc3339(),
            updated_at: chrono::Utc::now().to_rfc3339(),
        };
        agents.insert(leader.id.clone(), leader);

        Self { agents, tasks: HashMap::new() }
    }

    pub fn list_agents(&self) -> Vec<&AgentInfo> {
        self.agents.values().collect()
    }

    pub fn get_agent(&self, id: &str) -> Option<&AgentInfo> {
        self.agents.get(id)
    }

    pub fn list_tasks(&self) -> Vec<&TaskInfo> {
        self.tasks.values().collect()
    }

    pub fn get_task(&self, id: &str) -> Option<&TaskInfo> {
        self.tasks.get(id)
    }

    pub fn create_task(&mut self, request: Value) -> Value {
        let id = format!("task-{}", Uuid::new_v4());
        let now = chrono::Utc::now().to_rfc3339();
        
        let task = TaskInfo {
            id: id.clone(),
            name: request.get("name").and_then(|v| v.as_str()).unwrap_or("Unnamed Task").to_string(),
            description: request.get("description").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            status: "pending".to_string(),
            priority: request.get("priority").and_then(|v| v.as_str()).unwrap_or("medium").to_string(),
            assigned_agent: request.get("assignedAgent").and_then(|v| v.as_str()).map(String::from),
            progress: 0.0,
            dependencies: request.get("dependencies")
                .and_then(|v| v.as_array())
                .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                .unwrap_or_default(),
            created_at: now,
            started_at: None,
            completed_at: None,
        };

        self.tasks.insert(id.clone(), task);
        json!({ "id": id, "status": "created" })
    }

    pub fn cancel_task(&mut self, id: &str) -> bool {
        if let Some(task) = self.tasks.get_mut(id) {
            task.status = "cancelled".to_string();
            task.completed_at = Some(chrono::Utc::now().to_rfc3339());
            true
        } else {
            false
        }
    }
}
