use serde::{Deserialize, Serialize};

use crate::error::AppError;

/// Projection of sidebar counts (unread, starred, total per feed).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SidebarProjection {
    pub total_unread: usize,
    pub total_starred: usize,
    pub per_feed: Vec<FeedCount>,
}

/// Per-feed count projection.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeedCount {
    pub feed_id: i64,
    pub title: Option<String>,
    pub unread: usize,
    pub total: usize,
    pub has_error: bool,
}

/// Compute the sidebar projection from the database.
pub fn compute_projection() -> Result<SidebarProjection, AppError> {
    todo!()
}
