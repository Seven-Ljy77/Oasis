use std::collections::HashMap;
use std::path::PathBuf;

use crate::error::AppError;

/// A renderable prompt template with system and user messages.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PromptTemplate {
    pub id: String,
    pub version: String,
    #[serde(rename = "systemTemplate")]
    pub system_prompt: String,
    #[serde(rename = "template")]
    pub user_prompt_template: String,
}

impl PromptTemplate {
    /// Render the user prompt by substituting variables via Tera.
    pub fn render(&self, variables: &HashMap<String, String>) -> Result<String, AppError> {
        let mut context = tera::Context::new();
        for (key, value) in variables {
            context.insert(key, &value);
        }
        tera::Tera::one_off(&self.user_prompt_template, &context, false)
            .map_err(|e| AppError::Agent(format!("Prompt render failed: {e}")))
    }

    /// Render the system prompt with variable substitution.
    pub fn render_system(&self, variables: &HashMap<String, String>) -> Result<String, AppError> {
        if self.system_prompt.is_empty() {
            return Ok(String::new());
        }
        let mut context = tera::Context::new();
        for (key, value) in variables {
            context.insert(key, &value);
        }
        tera::Tera::one_off(&self.system_prompt, &context, false)
            .map_err(|e| AppError::Agent(format!("System prompt render failed: {e}")))
    }
}

// ---------------------------------------------------------------------------
// PromptTemplateStore
// ---------------------------------------------------------------------------

/// Store that loads and caches prompt templates from YAML files.
///
/// Lookup order: user data directory first, then built-in resources.
pub struct PromptTemplateStore {
    cache: HashMap<String, PromptTemplate>,
    user_dir: Option<PathBuf>,
}

impl PromptTemplateStore {
    /// Create a new store. If `user_dir` is provided, custom templates from that
    /// directory take precedence over built-in defaults.
    pub fn new(user_dir: Option<PathBuf>) -> Self {
        Self {
            cache: HashMap::new(),
            user_dir,
        }
    }

    /// Load a template by ID. User-custom templates take precedence over built-in.
    pub fn load(&mut self, template_id: &str) -> Result<PromptTemplate, AppError> {
        // Check cache
        if let Some(cached) = self.cache.get(template_id) {
            return Ok(cached.clone());
        }

        // 1. Try user directory
        if let Some(ref dir) = self.user_dir {
            let path = dir.join(format!("{template_id}.yaml"));
            if path.exists() {
                let yaml = std::fs::read_to_string(&path).map_err(|e| {
                    AppError::Config(format!("Cannot read template {template_id}: {e}"))
                })?;
                let tmpl: PromptTemplate = serde_yaml::from_str(&yaml).map_err(|e| {
                    AppError::Config(format!("Invalid template YAML {template_id}: {e}"))
                })?;
                self.cache.insert(template_id.to_string(), tmpl.clone());
                return Ok(tmpl);
            }
        }

        // 2. Try built-in resource
        self.load_builtin(template_id)
    }

    /// Load a built-in template (embedded at compile time).
    fn load_builtin(&mut self, template_id: &str) -> Result<PromptTemplate, AppError> {
        let yaml = match template_id {
            "summary.default" => include_str!("../../resources/prompts/summary.default.yaml"),
            "translation.default" => include_str!("../../resources/prompts/translation.default.yaml"),
            "translation.hy-mt" => include_str!("../../resources/prompts/translation.hy-mt.yaml"),
            "tagging.default" => include_str!("../../resources/prompts/tagging.default.yaml"),
            other => return Err(AppError::NotFound(format!("Template not found: {other}"))),
        };
        let tmpl: PromptTemplate = serde_yaml::from_str(yaml).map_err(|e| {
            AppError::Config(format!("Invalid built-in template {template_id}: {e}"))
        })?;
        self.cache.insert(template_id.to_string(), tmpl.clone());
        Ok(tmpl)
    }

    /// Reload all cached templates from disk (clears cache, next load re-reads).
    pub fn reload(&mut self) {
        self.cache.clear();
    }

    /// Return the list of available template IDs (built-in + user-custom).
    pub fn available_templates(&self) -> Vec<String> {
        let mut ids: Vec<String> = vec![
            "summary.default".into(),
            "translation.default".into(),
            "translation.hy-mt".into(),
            "tagging.default".into(),
        ];
        // Scan user directory for additional templates
        if let Some(ref dir) = self.user_dir {
            if let Ok(entries) = std::fs::read_dir(dir) {
                for entry in entries.flatten() {
                    if let Some(name) = entry.file_name().to_str() {
                        if let Some(stem) = name.strip_suffix(".yaml") {
                            ids.push(stem.to_string());
                        }
                    }
                }
            }
        }
        ids.sort();
        ids.dedup();
        ids
    }
}

impl Default for PromptTemplateStore {
    fn default() -> Self {
        Self::new(None)
    }
}
