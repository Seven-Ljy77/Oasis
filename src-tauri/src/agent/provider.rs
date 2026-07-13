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
    async fn resolve_api_key(&self) -> Result<String, AppError> {
        todo!()
    }
}

#[async_trait::async_trait]
impl LLMProvider for OpenAIProvider {
    async fn complete(&self, _request: &LLMRequest) -> Result<LLMResponse, AppError> {
        todo!()
    }

    async fn stream(
        &self,
        _request: &LLMRequest,
    ) -> Result<Box<dyn Stream<Item = Result<LLMStreamChunk, AppError>> + Unpin + Send>, AppError> {
        todo!()
    }
}
