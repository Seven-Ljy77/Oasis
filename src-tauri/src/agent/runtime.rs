use std::collections::HashMap;
use tokio::sync::mpsc;
use tokio_stream::wrappers::UnboundedReceiverStream;

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

/// The central AI agent runtime engine that manages lifecycle and state machines.
pub struct AgentRuntimeEngine {
    policy: AgentRuntimePolicy,
    event_tx: mpsc::UnboundedSender<AgentRuntimeEvent>,
    // Internal state will be implemented later
    _private: (),
}

impl AgentRuntimeEngine {
    pub fn new() -> Self {
        let (event_tx, _) = mpsc::unbounded_channel();
        Self {
            policy: AgentRuntimePolicy::default(),
            event_tx,
            _private: (),
        }
    }

    /// Submit a new agent run specification.
    pub async fn submit(&self, _input: AgentRunInput) -> Result<(), AppError> {
        todo!()
    }

    /// Update the phase of an in-progress run.
    pub async fn update_phase(
        &self,
        _entry_id: Option<i64>,
        _task_kind: AgentTaskKind,
        _phase: AgentRunPhase,
        _status_text: &str,
    ) -> Result<(), AppError> {
        todo!()
    }

    /// Mark a run as finished with a result.
    pub async fn finish(&self, _result: AgentRunResult) -> Result<(), AppError> {
        todo!()
    }

    /// Cancel an active or waiting run.
    pub async fn cancel(
        &self,
        _entry_id: Option<i64>,
        _task_kind: AgentTaskKind,
    ) -> Result<(), AppError> {
        todo!()
    }

    /// Subscribe to runtime events.
    pub fn events(&self) -> UnboundedReceiverStream<AgentRuntimeEvent> {
        todo!()
    }

    /// Get the current phase for a given entry and task kind.
    pub fn current_phase(
        &self,
        _entry_id: Option<i64>,
        _task_kind: AgentTaskKind,
    ) -> Option<AgentRunPhase> {
        todo!()
    }
}

impl Default for AgentRuntimeEngine {
    fn default() -> Self {
        Self::new()
    }
}
