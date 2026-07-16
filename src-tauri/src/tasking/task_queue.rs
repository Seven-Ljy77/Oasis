use std::collections::HashMap;
use tokio::sync::{mpsc, RwLock};
use tokio_stream::wrappers::UnboundedReceiverStream;

use crate::error::AppError;
use super::{TaskKind, TaskRecord, TaskState};

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

/// Internal task wrapping a TaskRecord with its cancel channel.
struct QueuedTask {
    record: TaskRecord,
    cancel_tx: Option<tokio::sync::oneshot::Sender<()>>,
}

/// A priority-based task queue for async background jobs.
pub struct TaskQueue {
    concurrency_limits: HashMap<TaskKind, usize>,
    event_tx: mpsc::UnboundedSender<TaskQueueEvent>,
    event_rx: RwLock<Option<mpsc::UnboundedReceiver<TaskQueueEvent>>>,
    tasks: RwLock<HashMap<String, QueuedTask>>,
    active_by_kind: RwLock<HashMap<TaskKind, usize>>,
}

impl TaskQueue {
    pub fn new() -> Self {
        let (event_tx, event_rx) = mpsc::unbounded_channel();
        Self {
            concurrency_limits: Self::default_concurrency(),
            event_tx,
            event_rx: RwLock::new(Some(event_rx)),
            tasks: RwLock::new(HashMap::new()),
            active_by_kind: RwLock::new(HashMap::new()),
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

    fn emit(&self, event: TaskQueueEvent) {
        let _ = self.event_tx.send(event);
    }

    fn gen_task_id() -> String {
        uuid::Uuid::new_v4().to_string()
    }

    /// Enqueue a new task with the given kind and associated data.
    pub async fn enqueue(
        &self,
        kind: TaskKind,
        _payload: serde_json::Value,
    ) -> Result<String, AppError> {
        let task_id = Self::gen_task_id();
        let record = TaskRecord {
            id: task_id.clone(),
            kind: kind.clone(),
            state: TaskState::Pending,
            created_at: chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            updated_at: chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            progress: Some(0.0),
            status_text: Some(String::new()),
        };

        self.tasks.write().await.insert(
            task_id.clone(),
            QueuedTask {
                record,
                cancel_tx: None,
            },
        );

        self.emit(TaskQueueEvent::TaskEnqueued {
            task_id: task_id.clone(),
            kind,
        });

        Ok(task_id)
    }

    /// Cancel an existing task by ID.
    pub async fn cancel(&self, task_id: &str) -> Result<(), AppError> {
        let mut tasks = self.tasks.write().await;
        if let Some(task) = tasks.get_mut(task_id) {
            task.record.state = TaskState::Cancelled;
            task.record.updated_at =
                chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

            // Send cancellation signal if a channel was registered
            if let Some(tx) = task.cancel_tx.take() {
                let _ = tx.send(());
            }

            let kind = task.record.kind.clone();
            self.emit(TaskQueueEvent::TaskCancelled {
                task_id: task_id.to_string(),
            });

            // Decrement active count
            let mut active = self.active_by_kind.write().await;
            let count = active.entry(kind).or_insert(0);
            *count = count.saturating_sub(1);
        }
        Ok(())
    }

    /// Register a cancellation channel for a task (called when starting execution).
    pub async fn register_cancel(
        &self,
        task_id: &str,
        cancel_tx: tokio::sync::oneshot::Sender<()>,
    ) {
        if let Some(task) = self.tasks.write().await.get_mut(task_id) {
            task.cancel_tx = Some(cancel_tx);
        }
    }

    /// Mark a task as started.
    pub async fn mark_started(&self, task_id: &str) -> Result<(), AppError> {
        let mut tasks = self.tasks.write().await;
        if let Some(task) = tasks.get_mut(task_id) {
            task.record.state = TaskState::Running;
            task.record.updated_at =
                chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
            let kind = task.record.kind.clone();

            let mut active = self.active_by_kind.write().await;
            *active.entry(kind.clone()).or_insert(0) += 1;

            self.emit(TaskQueueEvent::TaskStarted {
                task_id: task_id.to_string(),
                kind,
            });
        }
        Ok(())
    }

    /// Update task progress.
    pub async fn update_progress(
        &self,
        task_id: &str,
        progress: f64,
        status_text: &str,
    ) {
        if let Some(task) = self.tasks.write().await.get_mut(task_id) {
            task.record.progress = Some(progress);
            task.record.status_text = Some(status_text.to_string());
        }
        self.emit(TaskQueueEvent::TaskProgress {
            task_id: task_id.to_string(),
            progress,
            status_text: status_text.to_string(),
        });
    }

    /// Mark a task as completed.
    pub async fn mark_completed(&self, task_id: &str) {
        let mut tasks = self.tasks.write().await;
        if let Some(task) = tasks.get_mut(task_id) {
            task.record.state = TaskState::Completed;
            task.record.progress = Some(1.0);
            let kind = task.record.kind.clone();

            let mut active = self.active_by_kind.write().await;
            let count = active.entry(kind.clone()).or_insert(0);
            *count = count.saturating_sub(1);

            self.emit(TaskQueueEvent::TaskCompleted {
                task_id: task_id.to_string(),
                kind,
            });
        }
    }

    /// Mark a task as failed.
    pub async fn mark_failed(&self, task_id: &str, error: &str) {
        let mut tasks = self.tasks.write().await;
        if let Some(task) = tasks.get_mut(task_id) {
            task.record.state = TaskState::Failed(error.to_string());
            let kind = task.record.kind.clone();

            let mut active = self.active_by_kind.write().await;
            let count = active.entry(kind.clone()).or_insert(0);
            *count = count.saturating_sub(1);

            self.emit(TaskQueueEvent::TaskFailed {
                task_id: task_id.to_string(),
                kind,
                error: error.to_string(),
            });
        }
    }

    /// Get the current state of a task.
    pub async fn get_task(&self, task_id: &str) -> Option<TaskRecord> {
        self.tasks
            .read()
            .await
            .get(task_id)
            .map(|t| t.record.clone())
    }

    /// Subscribe to task queue events.
    /// Note: there can only be one subscriber at a time with the current design.
    pub fn events(&self) -> UnboundedReceiverStream<TaskQueueEvent> {
        let opt_rx = self
            .event_rx
            .try_write()
            .ok()
            .and_then(|mut guard| guard.take());
        match opt_rx {
            Some(rx) => UnboundedReceiverStream::new(rx),
            None => {
                // Return a dummy stream — receiver was already taken
                let (_, dummy_rx) = mpsc::unbounded_channel();
                UnboundedReceiverStream::new(dummy_rx)
            }
        }
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
