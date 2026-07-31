use std::collections::HashMap;
use std::sync::Arc;

use futures::StreamExt;
use serde::{Deserialize, Serialize};

use crate::agent::provider::{LLMMessage, LLMProvider, LLMRequest};
use crate::agent::prompt_template::PromptTemplateStore;
use crate::agent::request_tracker::LatestRequestContext;
use crate::agent::route::{RouteCandidate, RouteResolver};
use crate::agent::AgentTaskKind;
use crate::db::summary_store::SummaryStore;
use crate::error::AppError;

/// Request to run a summary task.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SummaryRunRequest {
    pub entry_id: i64,
    pub target_language: String,
    pub detail_level: String,
    /// Skip an existing cached summary and generate a fresh result.
    pub force: bool,
    /// The article title and content to summarize (provided by caller).
    pub title: String,
    pub content: String,
}

/// Events emitted during a summary run.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SummaryRunEvent {
    /// The summary generation has started.
    Started { entry_id: i64 },
    /// A token of streaming output.
    Token { entry_id: i64, token: String },
    /// The run has completed (final text and metadata).
    Terminal {
        entry_id: i64,
        full_text: String,
        target_language: String,
        detail_level: String,
    },
}

/// Executor for summary AI agent tasks.
pub struct SummaryExecutor {
    provider: Arc<dyn LLMProvider>,
    resolver: Arc<RouteResolver>,
    template_store: Arc<std::sync::Mutex<PromptTemplateStore>>,
    summary_store: Arc<dyn SummaryStore>,
}

impl SummaryExecutor {
    pub fn new(
        provider: Arc<dyn LLMProvider>,
        resolver: Arc<RouteResolver>,
        template_store: Arc<std::sync::Mutex<PromptTemplateStore>>,
        summary_store: Arc<dyn SummaryStore>,
    ) -> Self {
        Self {
            provider,
            resolver,
            template_store,
            summary_store,
        }
    }

    /// Execute a summary run, streaming tokens via the provided callback.
    pub async fn execute(
        &self,
        request: &SummaryRunRequest,
        request_context: Option<&LatestRequestContext>,
        route_override: Option<&RouteCandidate>,
        on_event: impl Fn(SummaryRunEvent) + Send + 'static,
    ) -> Result<(), AppError> {
        // 1. Check cache
        if !request.force {
            let cached = self
                .summary_store
                .load_by_slot(request.entry_id, &request.target_language, &request.detail_level)
                .await?;
            if let Some(cached) = cached {
                if let Some(context) = request_context {
                    context.ensure_current().await?;
                }
                on_event(SummaryRunEvent::Terminal {
                    entry_id: request.entry_id,
                    full_text: cached.text,
                    target_language: request.target_language.clone(),
                    detail_level: request.detail_level.clone(),
                });
                return Ok(());
            }
        }

        on_event(SummaryRunEvent::Started {
            entry_id: request.entry_id,
        });

        // 2. Resolve route
        let resolved_routes;
        let route = if let Some(route) = route_override {
            route
        } else {
            resolved_routes = self
                .resolver
                .resolve_route(&AgentTaskKind::Summary, None, None)
                .await?;
            resolved_routes.first().ok_or_else(|| {
                AppError::Config("No model configured. Go to Settings \u{2192} Agents to set up a model.".to_string())
            })?
        };

        // 3. Load and render prompt template
        let template = {
            let mut store = self.template_store.lock().map_err(|e| {
                AppError::Agent(format!("Template store lock: {e}"))
            })?;
            store.load("summary.default")?
        };

        let mut vars = HashMap::new();
        vars.insert("target_language".to_string(), request.target_language.clone());
        vars.insert("detail_level".to_string(), request.detail_level.clone());
        vars.insert("title".to_string(), request.title.clone());
        vars.insert("content".to_string(), request.content.clone());

        let system_prompt = template.render_system(&vars)?;
        let user_prompt = template.render(&vars)?;

        // 4. Build LLM request
        let mut messages = Vec::new();
        if !system_prompt.is_empty() {
            messages.push(LLMMessage {
                role: "system".to_string(),
                content: system_prompt,
            });
        }
        messages.push(LLMMessage {
            role: "user".to_string(),
            content: user_prompt,
        });

        let llm_request = LLMRequest {
            model: route.model_name.clone(),
            messages,
            temperature: route.temperature.or(Some(0.5)),
            top_p: route.top_p.or(Some(0.9)),
            max_tokens: route
                .max_tokens
                .and_then(|value| u32::try_from(value).ok())
                .or(Some(2000)),
            stream: route.is_streaming,
        };

        let mut full_text = String::new();
        if route.is_streaming {
            // 5. Stream tokens
            let mut stream = self.provider.stream(&llm_request).await?;
            let mut completed = false;
            while let Some(chunk_result) = stream.next().await {
                match chunk_result {
                    Ok(chunk) => {
                        if !chunk.content_delta.is_empty() {
                            on_event(SummaryRunEvent::Token {
                                entry_id: request.entry_id,
                                token: chunk.content_delta.clone(),
                            });
                            full_text.push_str(&chunk.content_delta);
                        }
                        if chunk.is_complete {
                            completed = true;
                            break;
                        }
                    }
                    Err(e) => return Err(e),
                }
            }
            if !completed {
                return Err(AppError::Network(
                    "LLM stream ended before completion".to_string(),
                ));
            }
        } else {
            let response = self.provider.complete(&llm_request).await?;
            full_text = response.content;
            on_event(SummaryRunEvent::Token {
                entry_id: request.entry_id,
                token: full_text.clone(),
            });
        }
        if full_text.trim().is_empty() {
            return Err(AppError::Agent(
                "LLM returned an empty summary".to_string(),
            ));
        }

        // 6. Save to DB
        let summary = crate::db::models::SummaryResult {
            id: 0,
            task_run_id: None,
            entry_id: request.entry_id,
            target_language: request.target_language.clone(),
            detail_level: request.detail_level.clone(),
            text: full_text.clone(),
            created_at: String::new(),
        };
        if let Some(context) = request_context {
            context
                .run_if_current(|| self.summary_store.save(&summary))
                .await?;
        } else {
            self.summary_store.save(&summary).await?;
        }

        // 7. Emit terminal
        on_event(SummaryRunEvent::Terminal {
            entry_id: request.entry_id,
            full_text,
            target_language: request.target_language.clone(),
            detail_level: request.detail_level.clone(),
        });

        Ok(())
    }
}
