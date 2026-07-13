use crate::digest::template::DigestTemplate;
use crate::error::AppError;

/// Load a digest export template by ID.
/// Looks up user-customized templates first, then falls back to built-in defaults.
pub fn load_digest_template(_template_id: &str) -> Result<DigestTemplate, AppError> {
    todo!()
}

/// Return the list of built-in digest template IDs.
pub fn builtin_digest_template_ids() -> Vec<&'static str> {
    vec!["single-text", "single-markdown", "multiple-markdown"]
}
