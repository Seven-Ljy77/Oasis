use crate::error::AppError;

/// A digest export template.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DigestTemplate {
    pub id: String,
    pub name: String,
    pub description: String,
    pub file_extension: String,
    pub template_body: String,
}

impl DigestTemplate {
    /// Render the template with the provided data.
    pub fn render(&self, _context: &tera::Context) -> Result<String, AppError> {
        todo!()
    }
}

/// Store that loads digest templates from YAML files.
pub struct DigestTemplateStore {
    // Internal cache
    _private: (),
}

impl DigestTemplateStore {
    pub fn new() -> Self {
        Self { _private: () }
    }

    /// Load a template by ID.
    pub fn load(&self, _template_id: &str) -> Result<DigestTemplate, AppError> {
        todo!()
    }

    /// Return the list of available template IDs.
    pub fn available_templates(&self) -> Vec<String> {
        todo!()
    }
}

impl Default for DigestTemplateStore {
    fn default() -> Self {
        Self::new()
    }
}
