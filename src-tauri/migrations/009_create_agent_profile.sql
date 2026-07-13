-- Migration 009: Create agent_profile table
CREATE TABLE agent_profile (
    agent_type TEXT NOT NULL UNIQUE,
    primary_model_profile_id INTEGER REFERENCES agent_model_profile(id),
    fallback_model_profile_id INTEGER REFERENCES agent_model_profile(id)
);
