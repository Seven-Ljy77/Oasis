use futures::StreamExt;
use serde::{Deserialize, Serialize};
use tokio_stream::Stream;

use crate::error::AppError;

/// A message in an LLM conversation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LLMMessage {
    pub role: String,
    pub content: String,
}

/// A request to send to an LLM provider.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LLMRequest {
    pub model: String,
    pub messages: Vec<LLMMessage>,
    pub temperature: Option<f64>,
    pub top_p: Option<f64>,
    pub max_tokens: Option<u32>,
    pub stream: bool,
}

/// A complete (non-streaming) response from an LLM provider.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LLMResponse {
    pub content: String,
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
    pub model: String,
}

/// A streaming chunk from an LLM provider.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LLMStreamChunk {
    pub content_delta: String,
    pub is_complete: bool,
    pub finish_reason: Option<String>,
}

// ---------------------------------------------------------------------------
// OpenAPI-compatible chat completion request / response shapes
// ---------------------------------------------------------------------------

#[derive(Serialize)]
struct ChatCompletionRequest<'a> {
    model: &'a str,
    messages: &'a [LLMMessage],
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    top_p: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_tokens: Option<u32>,
    stream: bool,
}

#[derive(Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<ChatChoice>,
    usage: Option<UsageInfo>,
    model: Option<String>,
}

#[derive(Deserialize)]
struct ChatChoice {
    message: Option<ChatMessage>,
    delta: Option<ChatDelta>,
    finish_reason: Option<String>,
    index: u32,
}

#[derive(Deserialize)]
struct ChatMessage {
    content: Option<String>,
}

#[derive(Deserialize)]
struct ChatDelta {
    content: Option<String>,
}

#[derive(Deserialize)]
struct UsageInfo {
    prompt_tokens: u32,
    completion_tokens: u32,
    total_tokens: u32,
}

// ---------------------------------------------------------------------------
// LLMProvider trait
// ---------------------------------------------------------------------------

/// Trait for LLM provider implementations.
#[async_trait::async_trait]
pub trait LLMProvider: Send + Sync {
    /// Send a completion request and wait for the full response.
    async fn complete(&self, _request: &LLMRequest) -> Result<LLMResponse, AppError>;

    /// Send a completion request and receive a stream of response chunks.
    async fn stream(
        &self,
        _request: &LLMRequest,
    ) -> Result<Box<dyn Stream<Item = Result<LLMStreamChunk, AppError>> + Unpin + Send>, AppError>;
}

// ---------------------------------------------------------------------------
// OpenAIProvider
// ---------------------------------------------------------------------------

/// OpenAI-compatible API provider implementation.
pub struct OpenAIProvider {
    pub name: String,
    pub base_url: String,
    pub api_key_ref: String,
    client: reqwest::Client,
}

impl OpenAIProvider {
    pub fn new(name: String, base_url: String, api_key_ref: String) -> Self {
        Self {
            name,
            base_url,
            api_key_ref,
            client: reqwest::Client::new(),
        }
    }

    /// Resolve the actual API key from secure storage.
    ///
    /// For local development (`api_key_ref == "local"`), the key "local" is
    /// returned directly — local LLM endpoints typically accept any value.
    /// For production use, keyring / Windows Credential Manager integration
    /// will be wired here (TODO).
    async fn resolve_api_key(&self) -> Result<String, AppError> {
        if self.api_key_ref == "local" {
            return Ok("local".to_string());
        }
        // TODO: use keyring crate for Windows Credential Manager lookup
        // let entry = keyring::Entry::new("Mercury", &self.api_key_ref)
        //     .map_err(|e| AppError::Agent(format!("keyring error: {e}")))?;
        // entry.get_password()
        //     .map_err(|e| AppError::Unauthorized(format!("cannot resolve API key: {e}")))
        Err(AppError::Unauthorized(format!(
            "API key not found in credential store: {}",
            self.api_key_ref
        )))
    }

    /// Build the full chat completions endpoint URL.
    fn completions_url(&self) -> String {
        let base = self.base_url.trim_end_matches('/');
        if base.ends_with("/v1") || base.ends_with("/v1/") {
            format!("{}/chat/completions", base.trim_end_matches('/'))
        } else {
            format!("{}/v1/chat/completions", base)
        }
    }
}

#[async_trait::async_trait]
impl LLMProvider for OpenAIProvider {
    async fn complete(&self, request: &LLMRequest) -> Result<LLMResponse, AppError> {
        let api_key = self.resolve_api_key().await?;
        let url = self.completions_url();

        let body = ChatCompletionRequest {
            model: &request.model,
            messages: &request.messages,
            temperature: request.temperature,
            top_p: request.top_p,
            max_tokens: request.max_tokens,
            stream: false,
        };

        let response = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| {
                if e.is_timeout() {
                    AppError::Timeout(format!("LLM request timed out: {e}"))
                } else if e.is_connect() {
                    AppError::Network(format!("Cannot connect to LLM: {e}"))
                } else {
                    AppError::Network(format!("LLM request failed: {e}"))
                }
            })?;

        let status = response.status();
        if !status.is_success() {
            let status_text = response.text().await.unwrap_or_default();
            return Err(match status.as_u16() {
                401 | 403 => AppError::Unauthorized(format!("LLM auth failed (HTTP {status}): {status_text}")),
                429 => AppError::Agent(format!("Rate limited (HTTP {status})")),
                404 => AppError::Agent(format!("Model not found (HTTP {status}): {status_text}")),
                400 => AppError::InvalidInput(format!("Invalid request (HTTP {status}): {status_text}")),
                _ => AppError::Network(format!("LLM returned HTTP {status}: {status_text}")),
            });
        }

        let resp: ChatCompletionResponse = response.json().await.map_err(|e| {
            AppError::Agent(format!("Failed to parse LLM response: {e}"))
        })?;

        let choice = resp.choices.into_iter().next().ok_or_else(|| {
            AppError::Agent("LLM returned empty choices array".to_string())
        })?;

        let content = choice
            .message
            .and_then(|m| m.content)
            .unwrap_or_default();

        let usage = resp.usage.unwrap_or(UsageInfo {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0,
        });

        Ok(LLMResponse {
            content,
            prompt_tokens: usage.prompt_tokens,
            completion_tokens: usage.completion_tokens,
            total_tokens: usage.total_tokens,
            model: resp.model.unwrap_or_else(|| request.model.clone()),
        })
    }

    async fn stream(
        &self,
        request: &LLMRequest,
    ) -> Result<Box<dyn Stream<Item = Result<LLMStreamChunk, AppError>> + Unpin + Send>, AppError> {
        let api_key = self.resolve_api_key().await?;
        let url = self.completions_url();

        let body = ChatCompletionRequest {
            model: &request.model,
            messages: &request.messages,
            temperature: request.temperature,
            top_p: request.top_p,
            max_tokens: request.max_tokens,
            stream: true,
        };

        let response = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| {
                if e.is_timeout() {
                    AppError::Timeout(format!("LLM stream timed out: {e}"))
                } else if e.is_connect() {
                    AppError::Network(format!("Cannot connect to LLM: {e}"))
                } else {
                    AppError::Network(format!("LLM stream failed: {e}"))
                }
            })?;

        let status = response.status();
        if !status.is_success() {
            let status_text = response.text().await.unwrap_or_default();
            return Err(match status.as_u16() {
                401 | 403 => AppError::Unauthorized(format!("LLM auth failed (HTTP {status})")),
                _ => AppError::Network(format!("LLM returned HTTP {status}: {status_text}")),
            });
        }

        let stream = response.bytes_stream();
        let sse_stream = stream
            .map(|chunk_result| {
                let chunk = chunk_result.map_err(|e| {
                    AppError::Network(format!("Stream read error: {e}"))
                })?;
                parse_sse_chunk(&chunk)
            })
            .filter_map(|result| {
                // Filter out empty/parse-error items, but preserve real errors
                match result {
                    Ok(None) => futures::future::ready(None),
                    Ok(Some(chunk)) => futures::future::ready(Some(Ok(chunk))),
                    Err(e) => futures::future::ready(Some(Err(e))),
                }
            });

        Ok(Box::new(sse_stream))
    }
}

/// Parse a raw SSE frame into zero or one LLMStreamChunk.
///
/// SSE format:
/// ```text
/// data: {"choices":[{"delta":{"content":"Hello"},"index":0,"finish_reason":null}]}
///
/// data: [DONE]
/// ```
fn parse_sse_chunk(bytes: &[u8]) -> Result<Option<LLMStreamChunk>, AppError> {
    let text = std::str::from_utf8(bytes)
        .map_err(|e| AppError::Agent(format!("Invalid SSE encoding: {e}")))?;

    for line in text.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        // Only process lines that start with "data: "
        let payload = match line.strip_prefix("data: ") {
            Some(p) => p,
            _ => continue,
        };

        // Check for stream termination
        if payload.trim() == "[DONE]" {
            return Ok(Some(LLMStreamChunk {
                content_delta: String::new(),
                is_complete: true,
                finish_reason: Some("stop".to_string()),
            }));
        }

        // Parse JSON chunk
        match serde_json::from_str::<ChatCompletionResponse>(payload) {
            Ok(resp) => {
                if let Some(choice) = resp.choices.into_iter().next() {
                    let content_delta = choice
                        .delta
                        .and_then(|d| d.content)
                        .unwrap_or_default();
                    let finish_reason = choice.finish_reason;
                    let is_complete = finish_reason.is_some();

                    return Ok(Some(LLMStreamChunk {
                        content_delta,
                        is_complete,
                        finish_reason,
                    }));
                }
            }
            Err(_) => {
                // Some providers send non-standard SSE — ignore unparseable lines
            }
        }
    }

    Ok(None)
}
