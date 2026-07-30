-- Summary generation predates persistent agent task-run tracking.  Keep the
-- reference when a run exists, but allow cached summaries without one.
CREATE TABLE summary_result_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_run_id INTEGER REFERENCES agent_task_run(id) ON DELETE SET NULL,
    entry_id INTEGER NOT NULL REFERENCES entry(id) ON DELETE CASCADE,
    target_language TEXT NOT NULL,
    detail_level TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(entry_id, target_language, detail_level)
);

INSERT INTO summary_result_new
    (id, task_run_id, entry_id, target_language, detail_level, text, created_at)
SELECT id, NULLIF(task_run_id, 0), entry_id, target_language, detail_level, text, created_at
FROM summary_result;

DROP TABLE summary_result;
ALTER TABLE summary_result_new RENAME TO summary_result;
CREATE INDEX IF NOT EXISTS idx_summary_entry ON summary_result(entry_id);
