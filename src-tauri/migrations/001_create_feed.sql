-- Migration 001: Create feed table
CREATE TABLE feed (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    feed_url TEXT NOT NULL UNIQUE,
    site_url TEXT,
    feed_parser_version INTEGER,
    last_fetched_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
