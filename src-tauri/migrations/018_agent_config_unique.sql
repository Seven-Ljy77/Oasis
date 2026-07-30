-- Migration 018: make agent configuration slots unique without discarding
-- the currently active configuration or breaking agent_profile routes.

-- Runtime writes trim names and reject empty values. Bring legacy rows into
-- the same shape before comparing names so the partial unique indexes can be
-- created even when old data differs only by surrounding whitespace.
UPDATE agent_provider_profile
SET name = CASE
    WHEN TRIM(name) = '' THEN 'Unnamed Provider ' || id
    ELSE TRIM(name)
END;

UPDATE agent_model_profile
SET model_name = CASE
    WHEN TRIM(model_name) = '' THEN 'Unnamed Model ' || id
    ELSE TRIM(model_name)
END;

CREATE TEMP TABLE _oasis_provider_merge (
    old_id INTEGER PRIMARY KEY,
    keep_id INTEGER NOT NULL
);

INSERT INTO _oasis_provider_merge (old_id, keep_id)
SELECT provider.id,
       (
           SELECT candidate.id
           FROM agent_provider_profile AS candidate
           WHERE candidate.name = provider.name COLLATE NOCASE
           ORDER BY candidate.is_archived ASC,
                    candidate.is_enabled DESC,
                    candidate.is_default DESC,
                    candidate.id DESC
           LIMIT 1
       )
FROM agent_provider_profile AS provider;

-- A model below an already archived provider was not active before this
-- migration and must not become active merely because providers are merged.
UPDATE agent_model_profile
SET is_archived = 1,
    is_default = 0,
    archived_at = COALESCE(archived_at, datetime('now'))
WHERE provider_profile_id IN (
    SELECT id FROM agent_provider_profile WHERE is_archived = 1
);

-- Move models to the retained provider before resolving duplicate model names.
UPDATE agent_model_profile
SET provider_profile_id = (
    SELECT keep_id
    FROM _oasis_provider_merge
    WHERE old_id = agent_model_profile.provider_profile_id
)
WHERE EXISTS (
    SELECT 1
    FROM _oasis_provider_merge
    WHERE old_id = agent_model_profile.provider_profile_id
);

UPDATE agent_provider_profile
SET is_archived = 1,
    is_default = 0,
    archived_at = COALESCE(archived_at, datetime('now'))
WHERE id IN (
    SELECT old_id
    FROM _oasis_provider_merge
    WHERE old_id <> keep_id
);

CREATE TEMP TABLE _oasis_model_merge (
    old_id INTEGER PRIMARY KEY,
    keep_id INTEGER NOT NULL
);

INSERT INTO _oasis_model_merge (old_id, keep_id)
SELECT model.id,
       (
           SELECT candidate.id
           FROM agent_model_profile AS candidate
           WHERE candidate.provider_profile_id = model.provider_profile_id
             AND candidate.model_name = model.model_name COLLATE NOCASE
           ORDER BY candidate.is_archived ASC,
                    candidate.is_enabled DESC,
                    candidate.is_default DESC,
                    candidate.id DESC
           LIMIT 1
       )
FROM agent_model_profile AS model;

UPDATE agent_profile
SET primary_model_profile_id = (
    SELECT keep_id
    FROM _oasis_model_merge
    WHERE old_id = agent_profile.primary_model_profile_id
)
WHERE primary_model_profile_id IN (
    SELECT old_id FROM _oasis_model_merge WHERE old_id <> keep_id
);

UPDATE agent_profile
SET fallback_model_profile_id = (
    SELECT keep_id
    FROM _oasis_model_merge
    WHERE old_id = agent_profile.fallback_model_profile_id
)
WHERE fallback_model_profile_id IN (
    SELECT old_id FROM _oasis_model_merge WHERE old_id <> keep_id
);

UPDATE agent_model_profile
SET is_archived = 1,
    is_default = 0,
    archived_at = COALESCE(archived_at, datetime('now'))
WHERE id IN (
    SELECT old_id
    FROM _oasis_model_merge
    WHERE old_id <> keep_id
);

-- Keep at most one active default provider and one active default model per
-- provider. Runtime writes preserve the same invariant.
CREATE TEMP TABLE _oasis_provider_default (keep_id INTEGER PRIMARY KEY);
INSERT INTO _oasis_provider_default (keep_id)
SELECT id
FROM agent_provider_profile
WHERE is_default = 1 AND is_archived = 0
ORDER BY is_enabled DESC, id DESC
LIMIT 1;

UPDATE agent_provider_profile
SET is_default = 0
WHERE is_default = 1
  AND (
      is_archived = 1
      OR id NOT IN (SELECT keep_id FROM _oasis_provider_default)
  );

CREATE TEMP TABLE _oasis_model_default (
    provider_profile_id INTEGER PRIMARY KEY,
    keep_id INTEGER NOT NULL
);
INSERT INTO _oasis_model_default (provider_profile_id, keep_id)
SELECT model.provider_profile_id,
       (
           SELECT candidate.id
           FROM agent_model_profile AS candidate
           WHERE candidate.provider_profile_id = model.provider_profile_id
             AND candidate.is_default = 1
             AND candidate.is_archived = 0
           ORDER BY candidate.is_enabled DESC,
                    candidate.id DESC
           LIMIT 1
       )
FROM agent_model_profile AS model
WHERE model.is_default = 1 AND model.is_archived = 0
GROUP BY model.provider_profile_id;

UPDATE agent_model_profile
SET is_default = 0
WHERE is_default = 1
  AND (
      is_archived = 1
      OR id NOT IN (SELECT keep_id FROM _oasis_model_default)
  );

-- Prefer a successful translation over a newer failed checkpoint.
DELETE FROM translation_result
WHERE id NOT IN (
    SELECT result.id
    FROM translation_result AS result
    WHERE result.id = (
        SELECT candidate.id
        FROM translation_result AS candidate
        WHERE candidate.entry_id = result.entry_id
          AND candidate.target_language = result.target_language
        ORDER BY CASE WHEN candidate.run_status = 'succeeded' THEN 0 ELSE 1 END,
                 candidate.id DESC
        LIMIT 1
    )
);

DROP TABLE _oasis_model_default;
DROP TABLE _oasis_provider_default;
DROP TABLE _oasis_model_merge;
DROP TABLE _oasis_provider_merge;

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_provider_name
    ON agent_provider_profile(name COLLATE NOCASE) WHERE is_archived = 0;
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_model_provider_model
    ON agent_model_profile(provider_profile_id, model_name COLLATE NOCASE) WHERE is_archived = 0;
CREATE UNIQUE INDEX IF NOT EXISTS idx_translation_result_slot
    ON translation_result(entry_id, target_language);
