-- Migration 020: distinguish models archived by a provider cascade from
-- models the user archived independently.
ALTER TABLE agent_model_profile
    ADD COLUMN archived_by_provider INTEGER NOT NULL DEFAULT 0
    CHECK (archived_by_provider IN (0, 1));

-- Older versions archived every model together with its provider but did not
-- retain the cascade source. Those rows must be restorable after upgrading.
UPDATE agent_model_profile
SET archived_by_provider = 1
WHERE is_archived = 1
  AND provider_profile_id IN (
      SELECT id
      FROM agent_provider_profile
      WHERE is_archived = 1
  );
