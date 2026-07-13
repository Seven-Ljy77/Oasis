use serde::{Deserialize, Serialize};

use crate::db::models::EntryListItem;

/// Cursor for keyset pagination over the entry list.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageCursor {
    pub published_at: Option<String>,
    pub created_at: String,
    pub id: i64,
}

/// A page of entry list items with an optional cursor for the next page.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntryPage {
    pub entries: Vec<EntryListItem>,
    pub next_cursor: Option<PageCursor>,
}

/// Specifies how multiple selected tags should be matched.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TagMatchMode {
    /// An entry must have at least one of the selected tags.
    Any,
    /// An entry must have all of the selected tags.
    All,
}

/// Builder-style query for listing entries.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntryListQuery {
    /// If set, only return entries belonging to this feed.
    pub feed_id: Option<i64>,

    /// If true, only return unread entries.
    pub unread_only: bool,

    /// If true, only return starred entries.
    pub starred_only: bool,

    /// Filter by these tag IDs.
    pub tag_ids: Vec<i64>,

    /// How to match multiple tag IDs.
    pub tag_match_mode: TagMatchMode,

    /// Full-text search term.
    pub search_text: Option<String>,

    /// Keyset pagination cursor (fetch entries after this point).
    pub cursor: Option<PageCursor>,

    /// Maximum number of entries to return.
    pub limit: u32,
}

impl Default for EntryListQuery {
    fn default() -> Self {
        Self {
            feed_id: None,
            unread_only: false,
            starred_only: false,
            tag_ids: Vec::new(),
            tag_match_mode: TagMatchMode::Any,
            search_text: None,
            cursor: None,
            limit: 200,
        }
    }
}

impl EntryListQuery {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_feed(mut self, feed_id: i64) -> Self {
        self.feed_id = Some(feed_id);
        self
    }

    pub fn unread_only(mut self) -> Self {
        self.unread_only = true;
        self
    }

    pub fn starred_only(mut self) -> Self {
        self.starred_only = true;
        self
    }

    pub fn with_tags(mut self, tag_ids: Vec<i64>, mode: TagMatchMode) -> Self {
        self.tag_ids = tag_ids;
        self.tag_match_mode = mode;
        self
    }

    pub fn with_search(mut self, text: String) -> Self {
        self.search_text = Some(text);
        self
    }

    pub fn with_cursor(mut self, cursor: PageCursor) -> Self {
        self.cursor = Some(cursor);
        self
    }

    pub fn with_limit(mut self, limit: u32) -> Self {
        self.limit = limit;
        self
    }
}
