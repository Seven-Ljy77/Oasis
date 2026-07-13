pub mod failure_policy;
pub mod job_runner;
pub mod task_queue;

use serde::{Deserialize, Serialize};

/// Kinds of background tasks the tasking system manages.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum TaskKind {
    SyncFeed,
    SyncAll,
    ImportOpml,
    ExportOpml,
    AgentRun,
    BatchTagging,
    UsagePurge,
}

impl TaskKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            TaskKind::SyncFeed => "sync_feed",
            TaskKind::SyncAll => "sync_all",
            TaskKind::ImportOpml => "import_opml",
            TaskKind::ExportOpml => "export_opml",
            TaskKind::AgentRun => "agent_run",
            TaskKind::BatchTagging => "batch_tagging",
            TaskKind::UsagePurge => "usage_purge",
        }
    }
}

/// States a task can be in.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum TaskState {
    Pending,
    Running,
    Completed,
    Failed(String),
    Cancelled,
    TimedOut,
}

/// A record of a task in the queue.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskRecord {
    pub id: String,
    pub kind: TaskKind,
    pub state: TaskState,
    pub created_at: String,
    pub updated_at: String,
    pub progress: Option<f64>,
    pub status_text: Option<String>,
}
