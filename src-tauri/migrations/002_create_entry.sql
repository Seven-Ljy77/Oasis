-- Migration 002: Create entry table
CREATE TABLE entry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    feed_id INTEGER NOT NULL REFERENCES feed(id) ON DELETE CASCADE,
    guid TEXT,
    url TEXT,
    title TEXT,
    author TEXT,
    published_at TEXT,
    summary TEXT,
    is_read INTEGER NOT NULL DEFAULT 0,
    is_starred INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_entry_feed_guid ON entry(feed_id, guid);
CREATE UNIQUE INDEX IF NOT EXISTS idx_entry_feed_url ON entry(feed_id, url);
