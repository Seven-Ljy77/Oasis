-- Migration 011: Create llm_usage_event table
CREATE TABLE llm_usage_event (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_run_id INTEGER REFERENCES agent_task_run(id),
    provider_name TEXT NOT NULL,
    provider_base_url TEXT NOT NULL,
    model_name TEXT NOT NULL,
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    request_phase TEXT NOT NULL,
    request_status TEXT NOT NULL,
    endpoint_url TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
