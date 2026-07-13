use std::collections::HashMap;
use tokio::sync::mpsc;
use tokio_stream::wrappers::UnboundedReceiverStream;

use crate::error::AppError;
use super::{TaskKind, TaskRecord};

/// Event emitted by the task queue.
#[derive(Debug, Clone)]
pub enum TaskQueueEvent {
    TaskEnqueued { task_id: String, kind: TaskKind },
    TaskStarted { task_id: String, kind: TaskKind },
    TaskProgress { task_id: String, progress: f64, status_text: String },
    TaskCompleted { task_id: String, kind: TaskKind },
    TaskFailed { task_id: String, kind: TaskKind, error: String },
    TaskCancelled { task_id: String },
}

/// A priority-based task queue for async background jobs.
pub struct TaskQueue {
    concurrency_limits: HashMap<TaskKind, usize>,
    event_tx: mpsc::UnboundedSender<TaskQueueEvent>,
    _private: (),
}

impl TaskQueue {
    pub fn new() -> Self {
        let (event_tx, _) = mpsc::unbounded_channel();
        Self {
            concurrency_limits: Self::default_concurrency(),
            event_tx,
            _private: (),
        }
    }

    fn default_concurrency() -> HashMap<TaskKind, usize> {
        let mut m = HashMap::new();
        m.insert(TaskKind::SyncFeed, 6);
        m.insert(TaskKind::SyncAll, 1);
        m.insert(TaskKind::ImportOpml, 1);
        m.insert(TaskKind::ExportOpml, 1);
        m.insert(TaskKind::AgentRun, 3);
        m.insert(TaskKind::BatchTagging, 1);
        m.insert(TaskKind::UsagePurge, 1);
        m
    }

    /// Enqueue a new task with the given kind and associated data.
    pub async fn enqueue(&self, _kind: TaskKind, _payload: serde_json::Value) -> Result<String, AppError> {
        todo!()
    }

    /// Cancel an existing task by ID.
    pub async fn cancel(&self, _task_id: &str) -> Result<(), AppError> {
        todo!()
    }

    /// Get the current state of a task.
    pub fn get_task(&self, _task_id: &str) -> Option<TaskRecord> {
        todo!()
    }

    /// Subscribe to task queue events.
    pub fn events(&self) -> UnboundedReceiverStream<TaskQueueEvent> {
        todo!()
    }

    /// Set the concurrency limit for a task kind.
    pub fn set_concurrency(&mut self, kind: TaskKind, limit: usize) {
        self.concurrency_limits.insert(kind, limit);
    }
}

impl Default for TaskQueue {
    fn default() -> Self {
        Self::new()
    }
}
