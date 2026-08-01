use serde::{Deserialize, Serialize};

use crate::error::AppError;

/// A tag suggestion for autocomplete.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TagSuggestion {
    pub name: String,
    pub normalized_name: String,
    pub existing_tag_id: Option<i64>,
    pub usage_count: i32,
    pub match_type: TagMatchType,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum TagMatchType {
    Exact,
    Prefix,
    Contains,
    Fuzzy,
}

/// Suggest tags based on user input and existing tags.
pub fn suggest_tags(
    _input: &str,
    _existing_tags: &[TagSuggestion],
    _limit: usize,
) -> Vec<TagSuggestion> {
    todo!()
}

/// Load all existing tags for suggestion purposes.
pub fn load_existing_tags() -> Result<Vec<TagSuggestion>, AppError> {
    todo!()
}
