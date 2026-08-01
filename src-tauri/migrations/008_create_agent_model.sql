-- Migration 008: Create agent_model_profile table
CREATE TABLE agent_model_profile (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_profile_id INTEGER NOT NULL REFERENCES agent_provider_profile(id),
    model_name TEXT NOT NULL,
    temperature REAL,
    top_p REAL,
    max_tokens INTEGER,
    is_streaming INTEGER NOT NULL DEFAULT 1,
    supports_summary INTEGER NOT NULL DEFAULT 1,
    supports_translation INTEGER NOT NULL DEFAULT 1,
    supports_tagging INTEGER NOT NULL DEFAULT 1,
    is_default INTEGER NOT NULL DEFAULT 0,
    is_enabled INTEGER NOT NULL DEFAULT 1,
    is_archived INTEGER NOT NULL DEFAULT 0,
    archived_at TEXT,
    last_tested_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
