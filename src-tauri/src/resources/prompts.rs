use crate::agent::prompt_template::PromptTemplate;
use crate::error::AppError;

/// Load a prompt template for a given task kind.
/// Looks up user-customized templates first, then falls back to built-in defaults.
pub fn load_prompt_template(_task_kind: &str) -> Result<PromptTemplate, AppError> {
    todo!()
}

/// Load the built-in (shipped-with-app) prompt template as a fallback.
pub fn load_builtin_prompt_template(_task_kind: &str) -> Result<PromptTemplate, AppError> {
    todo!()
}

/// Return the list of task kinds that have built-in prompt templates.
pub fn builtin_template_kinds() -> Vec<&'static str> {
    vec!["summary.default", "translation.default", "tagging.default"]
}
