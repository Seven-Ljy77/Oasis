-- Migration 012: Create summary_result table
CREATE TABLE summary_result (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_run_id INTEGER NOT NULL REFERENCES agent_task_run(id) ON DELETE CASCADE,
    entry_id INTEGER NOT NULL REFERENCES entry(id) ON DELETE CASCADE,
    target_language TEXT NOT NULL,
    detail_level TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(entry_id, target_language, detail_level)
);
