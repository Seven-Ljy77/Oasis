use std::collections::HashMap;
use tokio::sync::{broadcast, RwLock};

use crate::error::AppError;
use super::{AgentRunInput, AgentRunResult, AgentRunPhase, AgentTaskKind};

/// Event emitted by the runtime as agent runs progress.
#[derive(Debug, Clone)]
pub enum AgentRuntimeEvent {
    PhaseChanged {
        entry_id: Option<i64>,
        task_kind: String,
        phase: AgentRunPhase,
        status_text: String,
    },
    TokenStream {
        entry_id: Option<i64>,
        task_kind: String,
        token: String,
    },
    RunCompleted(AgentRunResult),
    RunFailed {
        entry_id: Option<i64>,
        task_kind: String,
        error: String,
    },
}

/// Policy controlling concurrency per task kind.
#[derive(Debug, Clone)]
pub struct AgentRuntimePolicy {
    pub max_active_per_kind: HashMap<AgentTaskKind, usize>,
    pub max_waiting_per_kind: HashMap<AgentTaskKind, usize>,
}

impl Default for AgentRuntimePolicy {
    fn default() -> Self {
        let mut max_active = HashMap::new();
        max_active.insert(AgentTaskKind::Summary, 1);
        max_active.insert(AgentTaskKind::Translation, 1);
        max_active.insert(AgentTaskKind::Tagging, 1);
        max_active.insert(AgentTaskKind::TaggingBatch, 1);

        let mut max_waiting = HashMap::new();
        max_waiting.insert(AgentTaskKind::Summary, 1);
        max_waiting.insert(AgentTaskKind::Translation, 1);
        max_waiting.insert(AgentTaskKind::Tagging, 0);
        max_waiting.insert(AgentTaskKind::TaggingBatch, 0);

        Self {
            max_active_per_kind: max_active,
            max_waiting_per_kind: max_waiting,
        }
    }
}

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

struct ActiveRun {
    input: AgentRunInput,
    phase: AgentRunPhase,
    status_text: String,
}

/// Build a compound key for the runs map.
fn run_key(entry_id: Option<i64>, task_kind: &AgentTaskKind) -> String {
    format!(
        "{}:{}",
        entry_id.map_or("batch".to_string(), |id| id.to_string()),
        task_kind.as_str()
    )
}

/// Simple event subscriber token (created from broadcast receiver).
pub struct RuntimeEventStream {
    rx: broadcast::Receiver<AgentRuntimeEvent>,
}

impl RuntimeEventStream {
    pub async fn recv(&mut self) -> Result<AgentRuntimeEvent, broadcast::error::RecvError> {
        self.rx.recv().await
    }
}

// ---------------------------------------------------------------------------
// Runtime engine
// ---------------------------------------------------------------------------

/// The central AI agent runtime engine that manages lifecycle and state machines.
pub struct AgentRuntimeEngine {
    policy: AgentRuntimePolicy,
    event_tx: broadcast::Sender<AgentRuntimeEvent>,
    runs: RwLock<HashMap<String, ActiveRun>>,
    active_by_kind: RwLock<HashMap<AgentTaskKind, usize>>,
}

impl AgentRuntimeEngine {
    pub fn new() -> Self {
        let (event_tx, _) = broadcast::channel(256);
        Self {
            policy: AgentRuntimePolicy::default(),
            event_tx,
            runs: RwLock::new(HashMap::new()),
            active_by_kind: RwLock::new(HashMap::new()),
        }
    }

    /// Emit an event over the broadcast channel.
    fn emit(&self, event: AgentRuntimeEvent) {
        let _ = self.event_tx.send(event);
    }

    /// Submit a new agent run specification.
    pub async fn submit(&self, input: AgentRunInput) -> Result<(), AppError> {
        let task_kind = input.task_kind.clone();
        let key = run_key(input.entry_id, &task_kind);

        let max_active = self
            .policy
            .max_active_per_kind
            .get(&task_kind)
            .copied()
            .unwrap_or(1);

        let active = self
            .active_by_kind
            .read()
            .await
            .get(&task_kind)
            .copied()
            .unwrap_or(0);

        if active >= max_active {
            // Queue as waiting if within limit, else reject
            let max_waiting = self
                .policy
                .max_waiting_per_kind
                .get(&task_kind)
                .copied()
                .unwrap_or(0);

            // Count waiting runs for this task kind
            let waiting_count = {
                let runs = self.runs.read().await;
                runs.values()
                    .filter(|r| r.input.task_kind == task_kind && r.phase == AgentRunPhase::Waiting)
                    .count()
            };

            if waiting_count >= max_waiting {
                return Err(AppError::Agent(format!(
                    "Task kind {:?} is at capacity (active={}, waiting={})",
                    task_kind, active, waiting_count
                )));
            }

            // Enqueue as waiting
            let run = ActiveRun {
                input,
                phase: AgentRunPhase::Waiting,
                status_text: "Queued".to_string(),
            };
            self.runs.write().await.insert(key.clone(), run);

            self.emit(AgentRuntimeEvent::PhaseChanged {
                entry_id: None,
                task_kind: task_kind.as_str().to_string(),
                phase: AgentRunPhase::Waiting,
                status_text: "Waiting for available slot".to_string(),
            });
        } else {
            // Start immediately
            *self.active_by_kind.write().await.entry(task_kind.clone()).or_insert(0) += 1;

            let run = ActiveRun {
                input,
                phase: AgentRunPhase::Requesting,
                status_text: "Starting".to_string(),
            };
            self.runs.write().await.insert(key.clone(), run);

            self.emit(AgentRuntimeEvent::PhaseChanged {
                entry_id: None,
                task_kind: task_kind.as_str().to_string(),
                phase: AgentRunPhase::Requesting,
                status_text: "Requesting LLM".to_string(),
            });
        }

        Ok(())
    }

    /// Update the phase of an in-progress run.
    pub async fn update_phase(
        &self,
        entry_id: Option<i64>,
        task_kind: AgentTaskKind,
        phase: AgentRunPhase,
        status_text: &str,
    ) -> Result<(), AppError> {
        let key = run_key(entry_id, &task_kind);
        let mut runs = self.runs.write().await;
        if let Some(run) = runs.get_mut(&key) {
            run.phase = phase.clone();
            run.status_text = status_text.to_string();
        }

        self.emit(AgentRuntimeEvent::PhaseChanged {
            entry_id,
            task_kind: task_kind.as_str().to_string(),
            phase: phase.clone(),
            status_text: status_text.to_string(),
        });
        Ok(())
    }

    /// Mark a run as finished with a result.
    pub async fn finish(&self, result: AgentRunResult) -> Result<(), AppError> {
        let task_kind = result.task_kind.clone();
        let key = run_key(result.entry_id, &task_kind);

        // Remove from active tracking
        let mut runs = self.runs.write().await;
        runs.remove(&key);
        drop(runs);

        // Decrement active count
        let mut active = self.active_by_kind.write().await;
        let count = active.entry(task_kind).or_insert(0);
        *count = count.saturating_sub(1);

        self.emit(AgentRuntimeEvent::RunCompleted(result));
        Ok(())
    }

    /// Cancel an active or waiting run.
    pub async fn cancel(
        &self,
        entry_id: Option<i64>,
        task_kind: AgentTaskKind,
    ) -> Result<(), AppError> {
        let key = run_key(entry_id, &task_kind);
        let mut runs = self.runs.write().await;

        if runs.remove(&key).is_some() {
            // Decrement active if it was active
            let mut active = self.active_by_kind.write().await;
            let count = active.entry(task_kind.clone()).or_insert(0);
            *count = count.saturating_sub(1);

            self.emit(AgentRuntimeEvent::PhaseChanged {
                entry_id,
                task_kind: task_kind.as_str().to_string(),
                phase: AgentRunPhase::Cancelled,
                status_text: "Cancelled".to_string(),
            });
        }

        Ok(())
    }

    /// Subscribe to runtime events.
    pub fn events(&self) -> RuntimeEventStream {
        RuntimeEventStream {
            rx: self.event_tx.subscribe(),
        }
    }

    /// Emit a streaming token event.
    pub fn emit_token(&self, entry_id: Option<i64>, task_kind: &AgentTaskKind, token: &str) {
        self.emit(AgentRuntimeEvent::TokenStream {
            entry_id,
            task_kind: task_kind.as_str().to_string(),
            token: token.to_string(),
        });
    }

    /// Get the current phase for a given entry and task kind.
    pub fn current_phase(
        &self,
        entry_id: Option<i64>,
        task_kind: AgentTaskKind,
    ) -> Option<AgentRunPhase> {
        let key = run_key(entry_id, &task_kind);
        // Use try_read for sync access from non-async contexts
        self.runs
            .try_read()
            .ok()
            .and_then(|runs| runs.get(&key).map(|r| r.phase.clone()))
    }
}

impl Default for AgentRuntimeEngine {
    fn default() -> Self {
        Self::new()
    }
}
