-- Migration 005: Create tag, tag_alias, and entry_tag tables
CREATE TABLE tag (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    normalized_name TEXT NOT NULL UNIQUE,
    is_provisional INTEGER NOT NULL DEFAULT 1,
    usage_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE tag_alias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tag_id INTEGER NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
    alias TEXT NOT NULL,
    normalized_alias TEXT NOT NULL UNIQUE
);

CREATE TABLE entry_tag (
    entry_id INTEGER NOT NULL REFERENCES entry(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
    source TEXT NOT NULL,
    confidence REAL,
    PRIMARY KEY (entry_id, tag_id)
);
