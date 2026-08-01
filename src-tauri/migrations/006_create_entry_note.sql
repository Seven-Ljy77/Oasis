-- Migration 006: Create entry_note table
CREATE TABLE entry_note (
    entry_id INTEGER PRIMARY KEY REFERENCES entry(id) ON DELETE CASCADE,
    markdown_text TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
