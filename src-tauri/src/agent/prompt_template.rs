use std::collections::HashMap;

use crate::error::AppError;

/// A renderable prompt template with system and user messages.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PromptTemplate {
    pub id: String,
    pub version: String,
    pub system_prompt: String,
    pub user_prompt_template: String,
}

impl PromptTemplate {
    /// Render the user prompt by substituting variables into the template.
    pub fn render(&self, _variables: &HashMap<String, String>) -> Result<String, AppError> {
        todo!()
    }

    /// Return the rendered system prompt.
    pub fn render_system(&self, _variables: &HashMap<String, String>) -> Result<String, AppError> {
        todo!()
    }
}

/// Store that loads and caches prompt templates from YAML files.
pub struct PromptTemplateStore {
    // Internal cache of loaded templates
    _private: (),
}

impl PromptTemplateStore {
    pub fn new() -> Self {
        Self { _private: () }
    }

    /// Load a template by ID, looking first in user data dir, then falling back to built-in resources.
    pub fn load(&self, _template_id: &str) -> Result<PromptTemplate, AppError> {
        todo!()
    }

    /// Reload all cached templates from disk.
    pub fn reload(&mut self) -> Result<(), AppError> {
        todo!()
    }

    /// Return the list of available template IDs.
    pub fn available_templates(&self) -> Vec<String> {
        todo!()
    }
}

impl Default for PromptTemplateStore {
    fn default() -> Self {
        Self::new()
    }
}
