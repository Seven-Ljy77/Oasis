use std::collections::HashMap;
use std::sync::Arc;

use serde::{Deserialize, Serialize};

use crate::agent::prompt_template::PromptTemplateStore;
use crate::agent::provider::{LLMMessage, LLMProvider, LLMRequest};
use crate::agent::route::RouteResolver;
use crate::agent::AgentTaskKind;
use crate::db::tag_store::TagStore;
use crate::error::AppError;

/// A tag suggestion from the AI agent.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TagSuggestion {
    pub name: String,
    pub source: String,
    pub tag_id: Option<i64>,
}

/// Executor for single-entry tagging AI agent tasks.
pub struct TaggingExecutor {
    provider: Arc<dyn LLMProvider>,
    resolver: Arc<RouteResolver>,
    template_store: Arc<std::sync::Mutex<PromptTemplateStore>>,
    tag_store: Arc<dyn TagStore>,
}

impl TaggingExecutor {
    pub fn new(
        provider: Arc<dyn LLMProvider>,
        resolver: Arc<RouteResolver>,
        template_store: Arc<std::sync::Mutex<PromptTemplateStore>>,
        tag_store: Arc<dyn TagStore>,
    ) -> Self {
        Self {
            provider,
            resolver,
            template_store,
            tag_store,
        }
    }

    /// Run tagging for a single entry, returning a list of tag suggestions.
    /// Uses the first 800 characters of content + top 50 existing tags as vocabulary.
    pub async fn execute_for_entry(
        &self,
        _entry_id: i64,
        title: &str,
        content: &str,
    ) -> Result<Vec<TagSuggestion>, AppError> {
        // 1. Resolve route
        let candidates = self
            .resolver
            .resolve_route(&AgentTaskKind::Tagging, None, None)
            .await?;
        let route = candidates
            .first()
            .ok_or_else(|| AppError::Config("No model configured for tagging".to_string()))?;

        // 2. Load existing tag vocabulary (top 50 by usage)
        let all_tags = self.tag_store.load_all().await?;
        let mut tag_names: Vec<String> = all_tags
            .iter()
            .filter(|t| t.usage_count > 0)
            .map(|t| t.name.clone())
            .collect();
        tag_names.truncate(50);
        let vocabulary = tag_names.join(", ");

        // 3. Load and render prompt
        let template = {
            let mut store = self.template_store.lock().map_err(|e| {
                AppError::Agent(format!("Template store lock: {e}"))
            })?;
            store.load("tagging.default")?
        };

        // Ensure we always have enough content: use title if content is too short
        let excerpt: String = content.chars().take(800).collect();
        let effective_content = if excerpt.trim().len() < 20 {
            format!("Title: {}\n\n{}", title, excerpt)
        } else {
            excerpt
        };

        let mut vars = HashMap::new();
        vars.insert("title".to_string(), title.to_string());
        vars.insert("content".to_string(), effective_content);
        vars.insert("tag_vocabulary".to_string(), vocabulary);

        let system = template.render_system(&vars).unwrap_or_default();
        let user = template.render(&vars)?;

        // 4. Build LLM request
        let mut messages = Vec::new();
        if !system.is_empty() {
            messages.push(LLMMessage { role: "system".to_string(), content: system });
        }
        messages.push(LLMMessage { role: "user".to_string(), content: user });

        let llm_request = LLMRequest {
            model: route.model_name.clone(),
            messages,
            temperature: route.temperature.or(Some(0.7)),
            top_p: route.top_p.or(Some(0.95)),
            max_tokens: route
                .max_tokens
                .and_then(|value| u32::try_from(value).ok())
                .or(Some(300)),
            stream: false,
        };

        // 5. Call provider
        let response = self.provider.complete(&llm_request).await?;
        let json_text = response.content.trim();

        // 6. Parse tag names from JSON response
        let tag_names: Vec<String> = serde_json::from_str(json_text).unwrap_or_else(|_| {
            // Fallback: try to extract words from non-JSON response
            json_text
                .trim_matches(|c: char| !c.is_alphanumeric())
                .split(',')
                .map(|s| s.trim().trim_matches('"').trim().to_string())
                .filter(|s| !s.is_empty())
                .collect()
        });

        // 7. Match against existing tags
        let existing_tags = self.tag_store.load_all().await?;
        let mut suggestions = Vec::new();
        for name in &tag_names {
            let normalized = crate::tags::normalization::normalize_tag(name);
            let existing = existing_tags.iter().find(|t| t.normalized_name == normalized);
            suggestions.push(TagSuggestion {
                name: name.clone(),
                source: "ai".to_string(),
                tag_id: existing.map(|t| t.id),
            });
        }

        Ok(suggestions)
    }

    /// Apply user-selected tags to an entry.
    pub async fn apply_tags(
        &self,
        entry_id: i64,
        tag_names: &[String],
        source: &str,
    ) -> Result<(), AppError> {
        for name in tag_names {
            let normalized = crate::tags::normalization::normalize_tag(name);
            let all_tags = self.tag_store.load_all().await?;
            let existing = all_tags.iter().find(|t| t.normalized_name == normalized);
            let tag_id = if let Some(tag) = existing {
                tag.id
            } else {
                let new_tag = self.tag_store.create(name).await?;
                new_tag.id
            };
            self.tag_store.assign_to_entry(tag_id, entry_id, source).await?;
        }
        Ok(())
    }
}
