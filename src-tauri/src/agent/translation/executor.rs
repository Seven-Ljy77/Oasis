use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Semaphore;

use futures::StreamExt;
use serde::{Deserialize, Serialize};

use crate::agent::failure::{classify, is_retryable, retry_delay};
use crate::agent::prompt_template::PromptTemplateStore;
use crate::agent::provider::{LLMMessage, LLMProvider, LLMRequest};
use crate::agent::route::{RouteCandidate, RouteResolver};
use crate::agent::request_tracker::LatestRequestContext;
use crate::agent::translation::segment::{SegmentExtractor, TextSegment};
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
        order_index: usize,
        translated_text: String,
        total_segments: usize,
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
        request_context: Option<&LatestRequestContext>,
        route_override: Option<&RouteCandidate>,
        on_event: impl Fn(TranslationRunEvent) + Send + Sync + 'static,
    ) -> Result<(), AppError> {
        let on_event = Arc::new(on_event);

        // 1. Extract segments
        let mut segments = SegmentExtractor::extract(&request.content)?;

        prepend_title_segment(&mut segments, request.title.as_deref());

        let composite_hash = SegmentExtractor::composite_hash(&segments);

        // 2. Check cache
        let cached = self
            .translation_store
            .load(request.entry_id, &request.target_language)
            .await?;
        if let Some((ref result, _)) = cached
            && result.source_content_hash == composite_hash
            && result.run_status == "succeeded"
        {
            if let Some(context) = request_context {
                context.ensure_current().await?;
            }
            let total = cached.as_ref().map_or(0, |(_, segs)| segs.len());
            on_event(TranslationRunEvent::Completed {
                entry_id: request.entry_id,
                total_segments: total,
            });
            return Ok(());
        }

        on_event(TranslationRunEvent::Started {
            entry_id: request.entry_id,
        });

        // 3. Resolve route
        let resolved_routes;
        let route = if let Some(route) = route_override {
            route
        } else {
            resolved_routes = self
                .resolver
                .resolve_route(&AgentTaskKind::Translation, None, None)
                .await?;
            resolved_routes.first().ok_or_else(|| {
                AppError::Config("No model configured for translation".to_string())
            })?
        };

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
            let temperature = route.temperature.or(Some(0.3));
            let top_p = route.top_p.or(Some(0.95));
            let max_tokens = route
                .max_tokens
                .and_then(|value| u32::try_from(value).ok())
                .or(Some(2000));
            let is_streaming = route.is_streaming;
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
                    temperature,
                    top_p,
                    max_tokens,
                    stream: is_streaming,
                };

                // Call provider with retry
                let mut attempt = 0u32;
                loop {
                    match complete_translation_segment(provider.as_ref(), &llm_request).await {
                        Ok(translated_text) => {
                            on_event(TranslationRunEvent::SegmentCompleted {
                                entry_id,
                                segment_id: seg.segment_id.clone(),
                                order_index: seg.order_index,
                                translated_text: translated_text.clone(),
                                total_segments: total,
                            });
                            return Ok::<_, AppError>((
                                seg.segment_id.clone(),
                                translated_text,
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

        let failure = if results.is_empty() {
            Some(first_error.unwrap_or_else(|| "All translation segments failed".to_string()))
        } else {
            first_error
        };

        // 7. Save checkpoint
        let db_segments: Vec<crate::db::models::TranslationSegment> = results
            .iter()
            .filter_map(|(seg_id, text)| {
                let source = segments.iter().find(|segment| &segment.segment_id == seg_id)?;
                Some(crate::db::models::TranslationSegment {
                id: 0,
                translation_result_id: 0,
                segment_id: seg_id.clone(),
                source_text: source.source_text.clone(),
                translated_text: text.clone(),
                order_index: source.order_index as i32,
                status: "completed".to_string(),
                })
            })
            .collect();

        let result = crate::db::models::TranslationResult {
            id: 0,
            task_run_id: None,
            entry_id: request.entry_id,
            target_language: request.target_language.clone(),
            source_content_hash: composite_hash,
            segmenter_version: "1".to_string(),
            run_status: if failure.is_some() {
                "failed".to_string()
            } else {
                "succeeded".to_string()
            },
            created_at: String::new(),
        };

        if let Some(context) = request_context {
            context
                .run_if_current(|| {
                    self.translation_store
                        .save_checkpoint(&result, &db_segments)
                })
                .await?;
        } else {
            self.translation_store
                .save_checkpoint(&result, &db_segments)
                .await?;
        }

        if let Some(error) = failure {
            return Err(AppError::Agent(error));
        }

        on_event(TranslationRunEvent::Completed {
            entry_id: request.entry_id,
            total_segments: total,
        });

        Ok(())
    }
}

fn prepend_title_segment(segments: &mut Vec<TextSegment>, title: Option<&str>) {
    let Some(title) = title.filter(|title| !title.trim().is_empty()) else {
        return;
    };

    segments.insert(
        0,
        TextSegment {
            segment_id: "header".to_string(),
            source_text: title.to_string(),
            order_index: 0,
            element_path: "header".to_string(),
            content_hash: SegmentExtractor::content_hash(title),
        },
    );
    for (index, segment) in segments.iter_mut().enumerate() {
        segment.order_index = index;
    }
}

async fn complete_translation_segment(
    provider: &dyn LLMProvider,
    request: &LLMRequest,
) -> Result<String, AppError> {
    let text = if request.stream {
        let mut stream = provider.stream(request).await?;
        let mut text = String::new();
        let mut completed = false;
        while let Some(chunk) = stream.next().await {
            let chunk = chunk?;
            text.push_str(&chunk.content_delta);
            if chunk.is_complete {
                completed = true;
                break;
            }
        }
        if !completed {
            return Err(AppError::Network(
                "LLM stream ended before completing a translation segment".to_string(),
            ));
        }
        text
    } else {
        provider.complete(request).await?.content
    };

    if text.trim().is_empty() {
        return Err(AppError::Agent(
            "LLM returned an empty translation segment".to_string(),
        ));
    }
    Ok(text)
}

#[cfg(test)]
mod tests {
    use super::{prepend_title_segment, SegmentExtractor};

    #[test]
    fn blank_title_does_not_create_synthetic_segment() {
        let mut segments = SegmentExtractor::extract("<p>Article body</p>").unwrap();

        prepend_title_segment(&mut segments, Some(" \t\r\n "));

        assert_eq!(segments.len(), 1);
        assert_eq!(segments[0].source_text, "Article body");
        assert_eq!(segments[0].order_index, 0);
    }

    #[test]
    fn non_empty_title_is_prepended_and_segments_are_reindexed() {
        let mut segments = SegmentExtractor::extract("<p>Article body</p>").unwrap();

        prepend_title_segment(&mut segments, Some("Article title"));

        assert_eq!(segments.len(), 2);
        assert_eq!(segments[0].segment_id, "header");
        assert_eq!(segments[0].source_text, "Article title");
        assert_eq!(segments[1].order_index, 1);
    }
}
