-- Migration 003: Create content table
CREATE TABLE content (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id INTEGER NOT NULL UNIQUE REFERENCES entry(id) ON DELETE CASCADE,
    html TEXT,
    cleaned_html TEXT,
    readability_title TEXT,
    readability_byline TEXT,
    readability_version INTEGER,
    markdown TEXT,
    markdown_version INTEGER,
    display_mode TEXT NOT NULL DEFAULT 'cleaned',
    document_base_url TEXT,
    pipeline_type TEXT NOT NULL DEFAULT 'default',
    resolved_intermediate_content TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
