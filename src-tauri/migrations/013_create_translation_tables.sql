-- Migration 013: Create translation_result and translation_segment tables
CREATE TABLE translation_result (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_run_id INTEGER REFERENCES agent_task_run(id),
    entry_id INTEGER NOT NULL REFERENCES entry(id) ON DELETE CASCADE,
    target_language TEXT NOT NULL,
    source_content_hash TEXT NOT NULL,
    segmenter_version TEXT NOT NULL,
    run_status TEXT NOT NULL DEFAULT 'succeeded',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE translation_segment (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    translation_result_id INTEGER NOT NULL REFERENCES translation_result(id) ON DELETE CASCADE,
    segment_id TEXT NOT NULL,
    source_text TEXT NOT NULL,
    translated_text TEXT NOT NULL,
    order_index INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'completed'
);
