use std::collections::HashMap;
use std::sync::Mutex;

use crate::error::AppError;

/// A digest export template.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DigestTemplate {
    pub id: String,
    pub version: String,
    pub template_body: String,
}

/// Raw YAML structure for deserialisation.
#[derive(Debug, serde::Deserialize)]
struct YamlTemplate {
    id: String,
    version: String,
    template: String,
}

impl DigestTemplate {
    /// Render the template using Tera with the provided context.
    pub fn render(&self, context: &tera::Context) -> Result<String, AppError> {
        // Convert Mustache-style sections to Tera syntax.
        let tera_tpl = self.convert_to_tera(&self.template_body);
        let mut engine = tera::Tera::default();
        engine
            .add_raw_template(&self.id, &tera_tpl)
            .map_err(|e| AppError::Digest(format!("Template parse error: {}", e)))?;
        engine
            .render(&self.id, context)
            .map_err(|e| AppError::Digest(format!("Template render error: {}", e)))
    }

    /// Convert Mustache `{{#section}}...{{/section}}` to Tera `{% if section %}...{% endif %}`.
    fn convert_to_tera(&self, body: &str) -> String {
        let mut s = body.to_string();
        let mut pos = 0usize;

        // Scan through the string, processing Mustache tags left to right.
        while pos < s.len() {
            let rest = &s[pos..];

            // Skip to next `{{` marker.
            let Some(rel) = rest.find("{{") else { break };
            let abs = pos + rel;

            // Find the matching `}}`.
            let Some(end_rel) = s[abs..].find("}}") else { break };
            let end = abs + end_rel + 2; // include the closing `}}`

            let inner = &s[abs + 2..end - 2].trim(); // content between {{ and }}

            let replacement: Option<String> = if let Some(name) = inner.strip_prefix('#') {
                // Section open: {{#name}} → {% if name %}
                Some("{% if ".to_string() + name.trim() + " %}")
            } else if let Some(name) = inner.strip_prefix('^') {
                // Inverted section: {{^name}} → {% if not name %}
                Some("{% if not ".to_string() + name.trim() + " %}")
            } else if inner.starts_with('/') {
                // Section close: {{/name}} → {% endif %}
                Some("{% endif %}".to_string())
            } else if !inner.is_empty() {
                // Variable: {{name}} → {{ name }}
                Some("{{ ".to_string() + inner + " }}")
            } else {
                None
            };

            if let Some(repl) = replacement {
                s.replace_range(abs..end, &repl);
                pos = abs + repl.len(); // advance past the replacement
            } else {
                pos = end; // skip unrecognised tag
            }
        }

        // Escape standalone `{%` and `{{` that might have ended up as literal text
        // (e.g. code blocks containing template-like syntax).
        s
    }
}

/// Store that loads digest templates from YAML files.
///
/// Lookup order: user directory first, then built-in fallback.
pub struct DigestTemplateStore {
    user_dir: Option<String>,
    cache: Mutex<HashMap<String, DigestTemplate>>,
}

impl DigestTemplateStore {
    pub fn new(user_dir: Option<String>) -> Self {
        Self {
            user_dir,
            cache: Mutex::new(HashMap::new()),
        }
    }

    /// Load a template by ID. Checks user dir first, falls back to built-in.
    pub fn load(&self, template_id: &str) -> Result<DigestTemplate, AppError> {
        // Check cache first.
        {
            let cache = self.cache.lock().map_err(|e| {
                AppError::Digest(format!("Template cache lock poisoned: {}", e))
            })?;
            if let Some(tpl) = cache.get(template_id) {
                return Ok(tpl.clone());
            }
        }

        // Every template exposed by the settings UI can be customised. The
        // "customize" option is the user-facing alias for single-markdown.
        if let Some(file_name) = template_file_name(template_id) {
            if let Some(ref dir) = self.user_dir {
                let user_path = std::path::Path::new(dir).join(file_name);
                if user_path.exists() {
                    let yaml_str = std::fs::read_to_string(&user_path)
                        .map_err(|e| AppError::Digest(format!("Cannot read user template: {}", e)))?;
                    let parsed: YamlTemplate = serde_yaml::from_str(&yaml_str)
                        .map_err(|e| AppError::Digest(format!("Invalid user template YAML: {}", e)))?;
                    let tpl = DigestTemplate {
                        id: parsed.id,
                        version: parsed.version,
                        template_body: parsed.template,
                    };
                    let mut cache = self.cache.lock().map_err(|e| {
                        AppError::Digest(format!("Template cache lock poisoned: {}", e))
                    })?;
                    cache.insert(template_id.to_string(), tpl.clone());
                    return Ok(tpl);
                }
            }
        }

        // Fall back to built-in template.
        let builtin_yaml = match template_id {
            "customize" => {
                include_str!("../../resources/templates/default.yaml")
            }
            "default" | "single-markdown" => {
                include_str!("../../resources/templates/default.yaml")
            }
            "minimal" => {
                include_str!("../../resources/templates/minimal.yaml")
            }
            "academic" => {
                include_str!("../../resources/templates/academic.yaml")
            }
            "newsletter" => {
                include_str!("../../resources/templates/newsletter.yaml")
            }
            _ => {
                return Err(AppError::Digest(format!(
                    "Unknown template ID: {}",
                    template_id
                )))
            }
        };

        let parsed: YamlTemplate = serde_yaml::from_str(builtin_yaml)
            .map_err(|e| AppError::Digest(format!("Invalid built-in template YAML: {}", e)))?;
        let tpl = DigestTemplate {
            id: parsed.id,
            version: parsed.version,
            template_body: parsed.template,
        };

        let mut cache = self.cache.lock().map_err(|e| {
            AppError::Digest(format!("Template cache lock poisoned: {}", e))
        })?;
        cache.insert(template_id.to_string(), tpl.clone());
        Ok(tpl)
    }

    /// Return the list of available template IDs.
    pub fn available_templates(&self) -> Vec<String> {
        vec![
            "customize".into(),
            "minimal".into(),
            "academic".into(),
            "newsletter".into(),
        ]
    }
}

fn template_file_name(template_id: &str) -> Option<&'static str> {
    match template_id {
        "customize" | "default" | "single-markdown" => Some("single-markdown.yaml"),
        "minimal" => Some("minimal.yaml"),
        "academic" => Some("academic.yaml"),
        "newsletter" => Some("newsletter.yaml"),
        _ => None,
    }
}

impl Default for DigestTemplateStore {
    fn default() -> Self {
        Self::new(None)
    }
}
