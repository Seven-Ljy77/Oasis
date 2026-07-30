use std::sync::Arc;

use serde::{Deserialize, Serialize};

use crate::db::agent_config_store::AgentConfigStore;
use crate::db::models::AgentModelProfile;
use crate::error::AppError;
use super::AgentTaskKind;

/// A candidate model route for an agent task.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouteCandidate {
    pub provider_name: String,
    pub provider_base_url: String,
    pub model_name: String,
    pub provider_profile_id: i64,
    pub model_profile_id: i64,
    pub priority: u32,
    pub is_fallback: bool,
    pub temperature: Option<f64>,
    pub top_p: Option<f64>,
    pub max_tokens: Option<i32>,
    pub is_streaming: bool,
}

/// Resolves model routing using the agent profile + model + provider config.
pub struct RouteResolver {
    config_store: Arc<dyn AgentConfigStore>,
}

impl RouteResolver {
    pub fn new(config_store: Arc<dyn AgentConfigStore>) -> Self {
        Self { config_store }
    }

    /// Resolve the ordered list of route candidates for a task kind.
    /// Returns primary candidates first, then fallback candidates.
    pub async fn resolve_route(
        &self,
        task_kind: &AgentTaskKind,
        primary_id: Option<i64>,
        fallback_id: Option<i64>,
    ) -> Result<Vec<RouteCandidate>, AppError> {
        let agent_type = task_kind.as_str();
        let capability_field: &str = match task_kind {
            AgentTaskKind::Summary => "supports_summary",
            AgentTaskKind::Translation => "supports_translation",
            AgentTaskKind::Tagging | AgentTaskKind::TaggingBatch => "supports_tagging",
        };

        let mut candidates = Vec::new();

        // Load the agent profile for this task kind
        let profiles = self.config_store.load_profiles().await?;
        let profile = profiles.iter().find(|p| p.agent_type == agent_type);

        // Resolve primary model id
        let primary_model_id = primary_id.or_else(|| {
            profile.and_then(|p| p.primary_model_profile_id)
        });

        let fallback_model_id = fallback_id.or_else(|| {
            profile.and_then(|p| p.fallback_model_profile_id)
        });

        // Fetch all models (we need to find the right provider for each)
        let providers = self.config_store.load_providers(false).await?;

        // Add primary candidate
        if let Some(mid) = primary_model_id {
            if let Some((provider_name, provider_base_url, provider_profile_id, model)) =
                find_model_info(&providers, &self.config_store, mid).await?
            {
                if model_supports(&model, capability_field) {
                    candidates.push(RouteCandidate {
                        provider_name,
                        provider_base_url,
                        model_name: model.model_name,
                        provider_profile_id,
                        model_profile_id: mid,
                        priority: 0,
                        is_fallback: false,
                        temperature: model.temperature,
                        top_p: model.top_p,
                        max_tokens: model.max_tokens,
                        is_streaming: model.is_streaming,
                    });
                }
            }
        }

        // Add fallback candidate
        if let Some(mid) = fallback_model_id {
            if mid != primary_model_id.unwrap_or(0) {
                if let Some((provider_name, provider_base_url, provider_profile_id, model)) =
                    find_model_info(&providers, &self.config_store, mid).await?
                {
                    if model_supports(&model, capability_field) {
                        candidates.push(RouteCandidate {
                            provider_name,
                            provider_base_url,
                            model_name: model.model_name,
                            provider_profile_id,
                            model_profile_id: mid,
                            priority: 1,
                            is_fallback: true,
                            temperature: model.temperature,
                            top_p: model.top_p,
                            max_tokens: model.max_tokens,
                            is_streaming: model.is_streaming,
                        });
                    }
                }
            }
        }

        // If no specific candidates, try defaults
        if candidates.is_empty() {
            candidates = self.resolve_default_route(task_kind).await?;
        }

        Ok(candidates)
    }

    /// Get the default route for a task kind — first enabled model supporting this kind.
    pub async fn resolve_default_route(
        &self,
        task_kind: &AgentTaskKind,
    ) -> Result<Vec<RouteCandidate>, AppError> {
        let capability_field: &str = match task_kind {
            AgentTaskKind::Summary => "supports_summary",
            AgentTaskKind::Translation => "supports_translation",
            AgentTaskKind::Tagging | AgentTaskKind::TaggingBatch => "supports_tagging",
        };

        let providers = self.config_store.load_providers(false).await?;
        let mut candidates = Vec::new();

        for provider in &providers {
            if !provider.is_enabled {
                continue;
            }
            let models = self
                .config_store
                .load_models(provider.id, false)
                .await?;

            for model in models {
                if !model.is_enabled {
                    continue;
                }
                let supports = match capability_field {
                    "supports_summary" => model.supports_summary,
                    "supports_translation" => model.supports_translation,
                    "supports_tagging" => model.supports_tagging,
                    _ => false,
                };
                if supports {
                    candidates.push(RouteCandidate {
                        provider_name: provider.name.clone(),
                        provider_base_url: provider.base_url.clone(),
                        model_name: model.model_name.clone(),
                        provider_profile_id: provider.id,
                        model_profile_id: model.id,
                        priority: if model.is_default { 0 } else { 1 },
                        is_fallback: !model.is_default,
                        temperature: model.temperature,
                        top_p: model.top_p,
                        max_tokens: model.max_tokens,
                        is_streaming: model.is_streaming,
                    });
                }
            }
        }

        // Sort: non-fallback first, then by priority
        candidates.sort_by_key(|c| (c.is_fallback, c.priority));

        if candidates.is_empty() {
            return Err(AppError::Config(format!(
                "No enabled model found for task kind {:?}",
                task_kind
            )));
        }

        Ok(candidates)
    }
}

/// Look up the provider name and model name for a given model id.
async fn find_model_info(
    providers: &[crate::db::models::AgentProviderProfile],
    store: &Arc<dyn AgentConfigStore>,
    model_id: i64,
) -> Result<Option<(String, String, i64, AgentModelProfile)>, AppError> {
    for provider in providers {
        if !provider.is_enabled {
            continue;
        }
        let models = store.load_models(provider.id, false).await?;
        for model in &models {
            if model.id == model_id && model.is_enabled {
                return Ok(Some((
                    provider.name.clone(),
                    provider.base_url.clone(),
                    provider.id,
                    model.clone(),
                )));
            }
        }
    }
    Ok(None)
}

/// Check whether a model supports a given capability.
fn model_supports(model: &AgentModelProfile, capability: &str) -> bool {
    match capability {
        "supports_summary" => model.supports_summary,
        "supports_translation" => model.supports_translation,
        "supports_tagging" => model.supports_tagging,
        _ => false,
    }
}
