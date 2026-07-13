use serde::{Deserialize, Serialize};

use crate::error::AppError;
use super::AgentTaskKind;

/// A candidate model route for an agent task.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouteCandidate {
    pub provider_name: String,
    pub model_name: String,
    pub provider_profile_id: i64,
    pub model_profile_id: i64,
    pub priority: u32,
    pub is_fallback: bool,
}

/// Resolve the ordered list of route candidates for a task kind.
/// Returns primary candidates first, then fallback candidates.
pub fn resolve_route(
    _task_kind: &AgentTaskKind,
    _primary_id: Option<i64>,
    _fallback_id: Option<i64>,
) -> Result<Vec<RouteCandidate>, AppError> {
    todo!()
}

/// Get the default route for a task kind (no specific profile override).
pub fn resolve_default_route(_task_kind: &AgentTaskKind) -> Result<Vec<RouteCandidate>, AppError> {
    todo!()
}
