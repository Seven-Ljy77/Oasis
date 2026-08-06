use futures::StreamExt;
use serde::{Deserialize, Serialize};
use tokio_stream::Stream;
use tokio_stream::wrappers::ReceiverStream;

use crate::error::AppError;

const SSE_CHANNEL_CAPACITY: usize = 64;
const MAX_SSE_FRAME_BYTES: usize = 1024 * 1024;

pub fn validate_provider_base_url(base_url: &str) -> Result<url::Url, AppError> {
    let parsed = url::Url::parse(base_url)
        .map_err(|error| AppError::InvalidInput(format!("Invalid provider URL: {error}")))?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err(AppError::InvalidInput(
            "Provider URL must use HTTP or HTTPS".to_string(),
        ));
    }
    if parsed.scheme() == "http" {
        let is_loopback = parsed.host().is_some_and(|host| match host {
            url::Host::Domain(domain) => domain.eq_ignore_ascii_case("localhost"),
            url::Host::Ipv4(address) => address.is_loopback(),
            url::Host::Ipv6(address) => address.is_loopback(),
        });
        if !is_loopback {
            return Err(AppError::InvalidInput(
                "HTTP provider URLs are only allowed for localhost".to_string(),
            ));
        }
    }
    Ok(parsed)
}

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
    #[serde(rename = "index")]
    _index: u32,
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
        let client = reqwest::Client::builder()
            .connect_timeout(std::time::Duration::from_secs(15))
            .read_timeout(std::time::Duration::from_secs(60))
            .pool_idle_timeout(std::time::Duration::from_secs(90))
            .build()
            .expect("valid LLM HTTP client configuration");
        Self {
            name,
            base_url,
            api_key_ref,
            client,
        }
    }

    /// Resolve the actual API key from secure storage.
    ///
    /// For local development (`api_key_ref == "local"`), the key "local" is
    /// returned directly — local LLM endpoints typically accept any value.
    /// For other keys, tries the system credential store via the keyring crate,
    /// falling back to the raw `api_key_ref` value itself (for inline keys).
    async fn resolve_api_key(&self) -> Result<String, AppError> {
        if self.api_key_ref == "local" {
            return Ok("local".to_string());
        }
        let is_managed = self.api_key_ref.starts_with("credential:");
        // Try the system credential store via keyring.
        match keyring::Entry::new("Oasis", &self.api_key_ref) {
            Ok(entry) => match entry.get_password() {
                Ok(key) => {
                    if !key.is_empty() {
                        return Ok(key);
                    }
                }
                Err(keyring::Error::NoEntry) if is_managed => {
                    return Err(AppError::Config(
                        "The saved API credential no longer exists. Re-enter the provider API key in Settings > Agents > Providers.".to_string(),
                    ));
                }
                Err(keyring::Error::NoEntry) => { /* legacy inline key */ }
                Err(error) if is_managed => {
                    return Err(AppError::Config(format!(
                        "Cannot read API credential: {error}"
                    )));
                }
                Err(_error) => { /* legacy inline key */ }
            },
            Err(error) if is_managed => {
                return Err(AppError::Config(format!(
                    "Credential store unavailable: {error}"
                )));
            }
            Err(_error) => { /* legacy inline key */ }
        }
        // Backward compatibility for profiles created before secure storage.
        Ok(self.api_key_ref.clone())
    }

    /// Build the full chat completions endpoint URL.
    fn completions_url(&self) -> Result<url::Url, AppError> {
        let mut url = validate_provider_base_url(&self.base_url)?;
        let base_path = url.path().trim_end_matches('/');
        let path = if base_path.ends_with("/v1") {
            format!("{base_path}/chat/completions")
        } else {
            format!("{base_path}/v1/chat/completions")
        };
        url.set_path(&path);
        url.set_query(None);
        url.set_fragment(None);
        Ok(url)
    }
}

#[async_trait::async_trait]
impl LLMProvider for OpenAIProvider {
    async fn complete(&self, request: &LLMRequest) -> Result<LLMResponse, AppError> {
        let url = self.completions_url()?;
        let api_key = self.resolve_api_key().await?;

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
            .post(url.as_str())
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
            .ok_or_else(|| AppError::Agent("LLM response did not contain text".to_string()))?;
        if content.trim().is_empty() {
            return Err(AppError::Agent(
                "LLM response contained empty text".to_string(),
            ));
        }

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
        let url = self.completions_url()?;
        let api_key = self.resolve_api_key().await?;

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
            .post(url.as_str())
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

        let mut byte_stream = response.bytes_stream();
        let (tx, rx) = tokio::sync::mpsc::channel(SSE_CHANNEL_CAPACITY);
        tokio::spawn(async move {
            let mut decoder = SseDecoder::default();
            while let Some(result) = byte_stream.next().await {
                match result {
                    Ok(bytes) => match decoder.push(&bytes) {
                        Ok(chunks) => {
                            for chunk in chunks {
                                if tx.send(Ok(chunk)).await.is_err() {
                                    return;
                                }
                            }
                        }
                        Err(error) => {
                            let _ = tx.send(Err(error)).await;
                            return;
                        }
                    },
                    Err(error) => {
                        let _ = tx.send(Err(AppError::Network(format!(
                            "Stream read error: {error}"
                        )))).await;
                        return;
                    }
                }
            }

            match decoder.finish() {
                Ok(chunks) => {
                    for chunk in chunks {
                        if tx.send(Ok(chunk)).await.is_err() {
                            return;
                        }
                    }
                }
                Err(error) => {
                    let _ = tx.send(Err(error)).await;
                }
            }
        });

        Ok(Box::new(ReceiverStream::new(rx)))
    }
}

#[derive(Default)]
struct SseDecoder {
    buffer: Vec<u8>,
    saw_terminal: bool,
}

impl SseDecoder {
    fn push(&mut self, bytes: &[u8]) -> Result<Vec<LLMStreamChunk>, AppError> {
        self.buffer.extend_from_slice(bytes);
        let chunks = self.drain_complete_frames()?;
        if self.buffer.len() > MAX_SSE_FRAME_BYTES {
            return Err(AppError::Network(format!(
                "LLM SSE frame exceeds the {} byte limit",
                MAX_SSE_FRAME_BYTES
            )));
        }
        Ok(chunks)
    }

    fn finish(&mut self) -> Result<Vec<LLMStreamChunk>, AppError> {
        let mut chunks = self.drain_complete_frames()?;
        if !self.buffer.is_empty() {
            let remaining = std::mem::take(&mut self.buffer);
            if let Some(chunk) = parse_sse_frame(&remaining)? {
                self.saw_terminal |= chunk.is_complete;
                chunks.push(chunk);
            }
        }
        if self.saw_terminal {
            Ok(chunks)
        } else {
            Err(AppError::Network(
                "LLM stream ended before a terminal event".to_string(),
            ))
        }
    }

    fn drain_complete_frames(&mut self) -> Result<Vec<LLMStreamChunk>, AppError> {
        let mut chunks = Vec::new();
        while let Some((frame_end, separator_len)) = find_sse_separator(&self.buffer) {
            if frame_end > MAX_SSE_FRAME_BYTES {
                return Err(AppError::Network(format!(
                    "LLM SSE frame exceeds the {} byte limit",
                    MAX_SSE_FRAME_BYTES
                )));
            }
            let frame = self.buffer[..frame_end].to_vec();
            self.buffer.drain(..frame_end + separator_len);
            if let Some(chunk) = parse_sse_frame(&frame)? {
                self.saw_terminal |= chunk.is_complete;
                chunks.push(chunk);
            }
        }
        Ok(chunks)
    }
}

fn find_sse_separator(bytes: &[u8]) -> Option<(usize, usize)> {
    let crlf = bytes
        .windows(4)
        .position(|window| window == b"\r\n\r\n")
        .map(|index| (index, 4));
    let lf = bytes
        .windows(2)
        .position(|window| window == b"\n\n")
        .map(|index| (index, 2));
    match (crlf, lf) {
        (Some(a), Some(b)) => Some(if a.0 <= b.0 { a } else { b }),
        (Some(separator), None) | (None, Some(separator)) => Some(separator),
        (None, None) => None,
    }
}

/// Parse one complete SSE frame into zero or one LLMStreamChunk.
///
/// SSE format:
/// ```text
/// data: {"choices":[{"delta":{"content":"Hello"},"index":0,"finish_reason":null}]}
///
/// data: [DONE]
/// ```
fn parse_sse_frame(bytes: &[u8]) -> Result<Option<LLMStreamChunk>, AppError> {
    let text = std::str::from_utf8(bytes)
        .map_err(|e| AppError::Agent(format!("Invalid SSE encoding: {e}")))?;

    let payload = text
        .lines()
        .filter_map(|line| line.trim().strip_prefix("data:").map(str::trim_start))
        .collect::<Vec<_>>()
        .join("\n");
    if payload.is_empty() {
        return Ok(None);
    }

    if payload.trim() == "[DONE]" {
        return Ok(Some(LLMStreamChunk {
            content_delta: String::new(),
            is_complete: true,
            finish_reason: Some("stop".to_string()),
        }));
    }

    let resp = serde_json::from_str::<ChatCompletionResponse>(&payload)
        .map_err(|error| AppError::Agent(format!("Invalid LLM stream frame: {error}")))?;
    let Some(choice) = resp.choices.into_iter().next() else {
        return Ok(None);
    };
    let content_delta = choice
        .delta
        .and_then(|delta| delta.content)
        .unwrap_or_default();
    let finish_reason = choice.finish_reason;
    let is_complete = finish_reason.is_some();

    Ok(Some(LLMStreamChunk {
        content_delta,
        is_complete,
        finish_reason,
    }))
}

#[cfg(test)]
mod tests {
    use super::{SseDecoder, MAX_SSE_FRAME_BYTES};

    #[test]
    fn decodes_frame_split_across_network_chunks() {
        let mut decoder = SseDecoder::default();
        let first = b"data: {\"choices\":[{\"delta\":{\"cont";
        assert!(decoder.push(first).unwrap().is_empty());

        let second = b"ent\":\"Hello\"},\"finish_reason\":null,\"index\":0}]}\n\n";
        let chunks = decoder.push(second).unwrap();
        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0].content_delta, "Hello");
        assert!(!chunks[0].is_complete);
    }

    #[test]
    fn decodes_multiple_frames_in_one_network_chunk() {
        let mut decoder = SseDecoder::default();
        let input = concat!(
            "data: {\"choices\":[{\"delta\":{\"content\":\"A\"},\"finish_reason\":null,\"index\":0}]}\r\n\r\n",
            "data: [DONE]\r\n\r\n"
        );
        let chunks = decoder.push(input.as_bytes()).unwrap();

        assert_eq!(chunks.len(), 2);
        assert_eq!(chunks[0].content_delta, "A");
        assert!(chunks[1].is_complete);
    }

    #[test]
    fn rejects_an_unbounded_incomplete_frame() {
        let mut decoder = SseDecoder::default();
        let input = vec![b'x'; MAX_SSE_FRAME_BYTES + 1];

        let error = decoder.push(&input).unwrap_err();

        assert!(error.to_string().contains("SSE frame exceeds"));
    }

    #[test]
    fn uses_the_earliest_separator_when_line_endings_are_mixed() {
        let mut decoder = SseDecoder::default();
        let input = concat!(
            "data: {\"choices\":[{\"delta\":{\"content\":\"A\"},\"finish_reason\":null,\"index\":0}]}\n\n",
            "data: {\"choices\":[{\"delta\":{\"content\":\"B\"},\"finish_reason\":null,\"index\":0}]}\r\n\r\n",
            "data: [DONE]\n\n"
        );
        let chunks = decoder.push(input.as_bytes()).unwrap();

        assert_eq!(chunks.len(), 3);
        assert_eq!(chunks[0].content_delta, "A");
        assert_eq!(chunks[1].content_delta, "B");
        assert!(chunks[2].is_complete);
    }

    #[test]
    fn rejects_a_stream_that_ends_without_a_terminal_event() {
        let mut decoder = SseDecoder::default();
        let input =
            b"data: {\"choices\":[{\"delta\":{\"content\":\"partial\"},\"finish_reason\":null,\"index\":0}]}\n\n";
        let chunks = decoder.push(input).unwrap();
        assert_eq!(chunks[0].content_delta, "partial");

        assert!(decoder.finish().is_err());
    }

    #[test]
    fn rejects_malformed_data_instead_of_accepting_a_truncated_stream() {
        let mut decoder = SseDecoder::default();
        let input = b"data: {\"error\":{\"message\":\"provider failed\"}}\n\n";

        assert!(decoder.push(input).is_err());
    }
}
