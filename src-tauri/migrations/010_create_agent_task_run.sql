-- Migration 010: Create agent_task_run table
CREATE TABLE agent_task_run (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id INTEGER REFERENCES entry(id),
    task_type TEXT NOT NULL,
    status TEXT NOT NULL,
    request_source TEXT,
    duration_ms INTEGER,
    prompt_version TEXT,
    template_id TEXT,
    route_model_name TEXT,
    route_provider_name TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
