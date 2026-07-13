use async_trait::async_trait;

use crate::db::models::{AgentModelProfile, AgentProfile, AgentProviderProfile};
use crate::error::AppError;

/// Persistence operations for AI agent configuration: providers, models, and
/// agent-type-to-model routing profiles.
#[async_trait]
pub trait AgentConfigStore: Send + Sync {
    // --- Providers ---

    /// Load all provider profiles (optionally excluding archived ones).
    async fn load_providers(
        &self,
        include_archived: bool,
    ) -> Result<Vec<AgentProviderProfile>, AppError>;

    /// Insert or update a provider profile.
    async fn upsert_provider(
        &self,
        provider: &AgentProviderProfile,
    ) -> Result<AgentProviderProfile, AppError>;

    /// Archive (soft-delete) a provider.
    async fn archive_provider(&self, id: i64) -> Result<(), AppError>;

    // --- Models ---

    /// Load all model profiles for a given provider.
    async fn load_models(
        &self,
        provider_profile_id: i64,
        include_archived: bool,
    ) -> Result<Vec<AgentModelProfile>, AppError>;

    /// Insert or update a model profile.
    async fn upsert_model(
        &self,
        model: &AgentModelProfile,
    ) -> Result<AgentModelProfile, AppError>;

    /// Archive (soft-delete) a model profile.
    async fn archive_model(&self, id: i64) -> Result<(), AppError>;

    // --- Agent Profiles (routing) ---

    /// Load all agent routing profiles.
    async fn load_profiles(&self) -> Result<Vec<AgentProfile>, AppError>;

    /// Insert or update an agent routing profile.
    async fn upsert_profile(
        &self,
        profile: &AgentProfile,
    ) -> Result<AgentProfile, AppError>;

    /// Set the specified provider/model as the default for its scope.
    async fn set_default(&self, id: i64) -> Result<(), AppError>;
}
