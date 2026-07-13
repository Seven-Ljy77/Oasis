pub mod html_patcher;
pub mod markdown_converter;
pub mod markdown_renderer;
pub mod navigation_policy;
pub mod pipeline;
pub mod readability;
pub mod theme;

use serde::{Deserialize, Serialize};

/// Which pipeline variant processes the content.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ReaderPipelineType {
    /// Standard Mercury reader pipeline.
    #[serde(rename = "default")]
    Default,
    /// Obsidian-compatible markdown pipeline.
    #[serde(rename = "obsidian")]
    Obsidian,
}

impl Default for ReaderPipelineType {
    fn default() -> Self {
        Self::Default
    }
}
