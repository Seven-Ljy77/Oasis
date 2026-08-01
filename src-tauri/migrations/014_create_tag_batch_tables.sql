-- Migration 014: Create tag_batch_run, tag_batch_entry,
-- tag_batch_assignment_staging, and tag_batch_new_tag_review tables

CREATE TABLE tag_batch_run (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status TEXT NOT NULL,
    scope_label TEXT,
    concurrency INTEGER NOT NULL DEFAULT 3,
    skip_already_applied INTEGER NOT NULL DEFAULT 1,
    skip_already_tagged INTEGER NOT NULL DEFAULT 0,
    total_entries INTEGER NOT NULL DEFAULT 0,
    processed_count INTEGER NOT NULL DEFAULT 0,
    succeeded_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    kept_count INTEGER NOT NULL DEFAULT 0,
    discarded_count INTEGER NOT NULL DEFAULT 0,
    inserted_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE tag_batch_entry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL REFERENCES tag_batch_run(id) ON DELETE CASCADE,
    entry_id INTEGER NOT NULL REFERENCES entry(id),
    lifecycle_state TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE tag_batch_assignment_staging (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL REFERENCES tag_batch_run(id) ON DELETE CASCADE,
    entry_id INTEGER NOT NULL REFERENCES entry(id),
    normalized_name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    resolved_tag_id INTEGER REFERENCES tag(id),
    assignment_kind TEXT NOT NULL
);

CREATE TABLE tag_batch_new_tag_review (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL REFERENCES tag_batch_run(id) ON DELETE CASCADE,
    normalized_name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    hit_count INTEGER NOT NULL DEFAULT 0,
    sample_entry_count INTEGER NOT NULL DEFAULT 0,
    decision TEXT NOT NULL DEFAULT 'pending'
);
