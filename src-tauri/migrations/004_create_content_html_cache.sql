-- Migration 004: Create content_html_cache table
CREATE TABLE content_html_cache (
    entry_id INTEGER NOT NULL REFERENCES entry(id) ON DELETE CASCADE,
    theme_id TEXT NOT NULL,
    html TEXT NOT NULL,
    reader_render_version INTEGER,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (entry_id, theme_id)
);
