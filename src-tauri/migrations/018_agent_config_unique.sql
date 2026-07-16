-- Migration 018: Add UNIQUE constraints to agent config tables to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_provider_name ON agent_provider_profile(name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_model_provider_model ON agent_model_profile(provider_profile_id, model_name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_translation_result_slot ON translation_result(entry_id, target_language);
