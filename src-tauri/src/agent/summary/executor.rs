use std::collections::HashMap;
use std::sync::Arc;

use futures::StreamExt;
use serde::{Deserialize, Serialize};

use crate::agent::provider::{LLMMessage, LLMProvider, LLMRequest};
use crate::agent::prompt_template::PromptTemplateStore;
use crate::agent::route::RouteResolver;
use crate::agent::AgentTaskKind;
use crate::db::summary_store::SummaryStore;
use crate::error::AppError;

/// Request to run a summary task.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SummaryRunRequest {
    pub entry_id: i64,
    pub target_language: String,
    pub detail_level: String,
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
        on_event: impl Fn(SummaryRunEvent) + Send + 'static,
    ) -> Result<(), AppError> {
        // 1. Check cache
        let cached = self
            .summary_store
            .load_by_slot(request.entry_id, &request.target_language, &request.detail_level)
            .await?;
        if let Some(cached) = cached {
            on_event(SummaryRunEvent::Terminal {
                entry_id: request.entry_id,
                full_text: cached.text,
                target_language: request.target_language.clone(),
                detail_level: request.detail_level.clone(),
            });
            return Ok(());
        }

        on_event(SummaryRunEvent::Started {
            entry_id: request.entry_id,
        });

        // 2. Resolve route
        let candidates = self
            .resolver
            .resolve_route(&AgentTaskKind::Summary, None, None)
            .await?;
        let route = candidates
            .first()
            .ok_or_else(|| AppError::Config("No model configured for summary".to_string()))?;

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
            temperature: Some(0.5),
            top_p: Some(0.9),
            max_tokens: Some(2000),
            stream: true,
        };

        // 5. Stream tokens
        let mut stream = self.provider.stream(&llm_request).await?;
        let mut full_text = String::new();

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
                        break;
                    }
                }
                Err(e) => {
                    return Err(e);
                }
            }
        }

        // 6. Save to DB
        let summary = crate::db::models::SummaryResult {
            id: 0,
            task_run_id: 0,
            entry_id: request.entry_id,
            target_language: request.target_language.clone(),
            detail_level: request.detail_level.clone(),
            text: full_text.clone(),
            created_at: String::new(),
        };
        self.summary_store.save(&summary).await?;

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
