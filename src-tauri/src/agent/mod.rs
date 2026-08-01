pub mod failure;
pub mod prompt_template;
pub mod provider;
pub mod request_tracker;
pub mod route;
pub mod runtime;

pub mod summary;
pub mod tagging;
pub mod translation;

use serde::{Deserialize, Serialize};

/// Kinds of AI agent tasks.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum AgentTaskKind {
    Summary,
    Translation,
    Tagging,
    TaggingBatch,
}

impl AgentTaskKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            AgentTaskKind::Summary => "summary",
            AgentTaskKind::Translation => "translation",
            AgentTaskKind::Tagging => "tagging",
            AgentTaskKind::TaggingBatch => "tagging_batch",
        }
    }
}

/// Who or what initiated the agent run.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum AgentRunOwner {
    User,
    System,
    Batch,
}

/// Phases in the agent run lifecycle.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum AgentRunPhase {
    Idle,
    Waiting,
    Requesting,
    Generating,
    Persisting,
    Completed,
    Failed,
    Cancelled,
    TimedOut,
}

/// Input specification for an agent run.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentRunInput {
    pub task_kind: AgentTaskKind,
    pub entry_id: Option<i64>,
    pub owner: AgentRunOwner,
    pub parameters: serde_json::Value,
}

/// Result of a completed agent run.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentRunResult {
    pub task_kind: AgentTaskKind,
    pub entry_id: Option<i64>,
    pub phase: AgentRunPhase,
    pub output: Option<serde_json::Value>,
    pub duration_ms: Option<i64>,
    pub error: Option<String>,
}
