use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Semaphore;

use serde::{Deserialize, Serialize};

use crate::agent::failure::{classify, is_retryable, retry_delay};
use crate::agent::prompt_template::PromptTemplateStore;
use crate::agent::provider::{LLMMessage, LLMProvider, LLMRequest};
use crate::agent::route::RouteResolver;
use crate::agent::translation::segment::SegmentExtractor;
use crate::agent::AgentTaskKind;
use crate::db::translation_store::TranslationStore;
use crate::error::AppError;

/// Request to run a translation task.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranslationRunRequest {
    pub entry_id: i64,
    pub target_language: String,
    /// The cleaned HTML or markdown content to translate.
    pub content: String,
    /// Optional title for the synthetic header segment.
    pub title: Option<String>,
    /// Maximum concurrent segment translations (1-5).
    pub concurrency: u32,
}

/// Events emitted during a translation run.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TranslationRunEvent {
    Started { entry_id: i64 },
    SegmentCompleted {
        entry_id: i64,
        segment_id: String,
        translated_text: String,
    },
    Completed { entry_id: i64, total_segments: usize },
    Failed { entry_id: i64, error: String },
}

/// Executor for translation AI agent tasks.
pub struct TranslationExecutor {
    provider: Arc<dyn LLMProvider>,
    resolver: Arc<RouteResolver>,
    template_store: Arc<std::sync::Mutex<PromptTemplateStore>>,
    translation_store: Arc<dyn TranslationStore>,
}

impl TranslationExecutor {
    pub fn new(
        provider: Arc<dyn LLMProvider>,
        resolver: Arc<RouteResolver>,
        template_store: Arc<std::sync::Mutex<PromptTemplateStore>>,
        translation_store: Arc<dyn TranslationStore>,
    ) -> Self {
        Self {
            provider,
            resolver,
            template_store,
            translation_store,
        }
    }

    /// Execute a translation run for an entry.
    pub async fn execute(
        &self,
        request: &TranslationRunRequest,
        on_event: impl Fn(TranslationRunEvent) + Send + Sync + 'static,
    ) -> Result<(), AppError> {
        let on_event = Arc::new(on_event);

        // 1. Extract segments
        let mut segments = SegmentExtractor::extract(&request.content)?;

        // Add synthetic header segment for title
        if let Some(ref title) = request.title {
            let hash = SegmentExtractor::content_hash(title);
            segments.insert(0, crate::agent::translation::segment::TextSegment {
                segment_id: "header".to_string(),
                source_text: title.clone(),
                order_index: 0,
                element_path: "header".to_string(),
                content_hash: hash,
            });
            // Re-index remaining segments
            for (i, seg) in segments.iter_mut().enumerate() {
                seg.order_index = i;
            }
        }

        let composite_hash = SegmentExtractor::composite_hash(&segments);

        // 2. Check cache
        let cached = self
            .translation_store
            .load(request.entry_id, &request.target_language)
            .await?;
        if let Some((ref result, _)) = cached {
            if result.source_content_hash == composite_hash
                && result.run_status == "succeeded"
            {
                // Return cached segments
                let total = cached.as_ref().map_or(0, |(_, segs)| segs.len());
                on_event(TranslationRunEvent::Completed {
                    entry_id: request.entry_id,
                    total_segments: total,
                });
                return Ok(());
            }
        }

        on_event(TranslationRunEvent::Started {
            entry_id: request.entry_id,
        });

        // 3. Resolve route
        let candidates = self
            .resolver
            .resolve_route(&AgentTaskKind::Translation, None, None)
            .await?;
        let route = candidates
            .first()
            .ok_or_else(|| AppError::Config("No model configured for translation".to_string()))?;

        // 4. Load prompt template
        let template = {
            let mut store = self.template_store.lock().map_err(|e| {
                AppError::Agent(format!("Template store lock: {e}"))
            })?;
            store.load("translation.default")?
        };

        // 5. Concurrent translation with semaphore
        let concurrency = request.concurrency.clamp(1, 5) as usize;
        let semaphore = Arc::new(Semaphore::new(concurrency));
        let total = segments.len();

        let entry_id = request.entry_id;
        let target_language = request.target_language.clone();

        let mut handles = Vec::new();
        for (i, segment) in segments.iter().enumerate() {
            let provider = self.provider.clone();
            let template = template.clone();
            let sem = semaphore.clone();
            let seg = segment.clone();
            let target_lang = target_language.clone();
            let on_event = Arc::clone(&on_event);
            let model = route.model_name.clone();
            let prev_text = if i > 0 {
                segments[i - 1].source_text.clone()
            } else {
                String::new()
            };

            let handle = tokio::spawn(async move {
                let _permit = sem.acquire().await.map_err(|_e| {
                    AppError::Agent("Semaphore closed".to_string())
                })?;

                // Build prompt with optional context
                let mut vars = HashMap::new();
                vars.insert("target_language".to_string(), target_lang.clone());
                vars.insert("source_text".to_string(), seg.source_text.clone());
                if !prev_text.is_empty() {
                    vars.insert("context".to_string(), prev_text);
                }

                let system = template.render_system(&vars).unwrap_or_default();
                let user = template.render(&vars)?;

                let mut messages = Vec::new();
                if !system.is_empty() {
                    messages.push(LLMMessage { role: "system".to_string(), content: system });
                }
                messages.push(LLMMessage { role: "user".to_string(), content: user });

                let llm_request = LLMRequest {
                    model,
                    messages,
                    temperature: Some(0.3),
                    top_p: Some(0.95),
                    max_tokens: Some(2000),
                    stream: false,
                };

                // Call provider with retry
                let mut attempt = 0u32;
                loop {
                    match provider.complete(&llm_request).await {
                        Ok(response) => {
                            on_event(TranslationRunEvent::SegmentCompleted {
                                entry_id,
                                segment_id: seg.segment_id.clone(),
                                translated_text: response.content.clone(),
                            });
                            return Ok::<_, AppError>((
                                seg.segment_id.clone(),
                                response.content,
                            ));
                        }
                        Err(e) => {
                            let reason = classify(&e);
                            if !is_retryable(&reason) || attempt >= 2 {
                                return Err(e);
                            }
                            attempt += 1;
                            tokio::time::sleep(retry_delay(attempt, &reason)).await;
                        }
                    }
                }
            });
            handles.push(handle);
        }

        // 6. Collect results
        let mut results: Vec<(String, String)> = Vec::new();
        let mut first_error: Option<String> = None;
        for handle in handles {
            match handle.await {
                Ok(Ok((seg_id, translated_text))) => {
                    results.push((seg_id, translated_text));
                }
                Ok(Err(e)) => {
                    if first_error.is_none() {
                        first_error = Some(format!("Segment failed: {e}"));
                    }
                }
                Err(e) => {
                    if first_error.is_none() {
                        first_error = Some(format!("Task panicked: {e}"));
                    }
                }
            }
        }

        if results.is_empty() {
            if let Some(err) = first_error {
                return Err(AppError::Agent(err));
            }
            return Err(AppError::Agent("All translation segments failed".to_string()));
        }

        // 7. Save checkpoint
        let db_segments: Vec<crate::db::models::TranslationSegment> = results
            .iter()
            .enumerate()
            .map(|(i, (seg_id, text))| crate::db::models::TranslationSegment {
                id: 0,
                translation_result_id: 0,
                segment_id: seg_id.clone(),
                source_text: segments
                    .iter()
                    .find(|s| &s.segment_id == seg_id)
                    .map_or(String::new(), |s| s.source_text.clone()),
                translated_text: text.clone(),
                order_index: i as i32,
                status: "completed".to_string(),
            })
            .collect();

        let result = crate::db::models::TranslationResult {
            id: 0,
            task_run_id: None,
            entry_id: request.entry_id,
            target_language: request.target_language.clone(),
            source_content_hash: composite_hash,
            segmenter_version: "1".to_string(),
            run_status: "succeeded".to_string(),
            created_at: String::new(),
        };

        self.translation_store
            .save_checkpoint(&result, &db_segments)
            .await?;

        on_event(TranslationRunEvent::Completed {
            entry_id: request.entry_id,
            total_segments: total,
        });

        Ok(())
    }
}
