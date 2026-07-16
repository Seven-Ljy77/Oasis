use crate::agent::prompt_template::{PromptTemplate, PromptTemplateStore};
use crate::error::AppError;

/// Load a prompt template for a given task kind. Checks user-custom templates
/// first, then falls back to built-in defaults.
pub fn load_prompt_template(
    store: &mut PromptTemplateStore,
    task_kind: &str,
) -> Result<PromptTemplate, AppError> {
    let template_id = resolve_template_id(task_kind);
    store.load(template_id)
}

/// Load the built-in (shipped-with-app) prompt template, bypassing any user
/// customizations.
pub fn load_builtin_prompt_template(
    _task_kind: &str,
) -> Result<PromptTemplate, AppError> {
    // The store's load_builtin is private — for now, use load_prompt_template
    // with a store that has no user_dir (clean store)
    let mut store = PromptTemplateStore::default();
    let template_id = resolve_template_id(_task_kind);
    store.load(template_id)
}

/// Map a task kind abbreviation to its default template ID.
fn resolve_template_id(task_kind: &str) -> &str {
    match task_kind {
        "summary" | "Summary" => "summary.default",
        "translation" | "Translation" => "translation.default",
        "translation-hy-mt" | "translation_hy_mt" => "translation.hy-mt",
        "tagging" | "Tagging" => "tagging.default",
        // Allow direct template IDs to pass through
        other => other,
    }
}

/// Return the list of task kinds that have built-in prompt templates.
pub fn builtin_template_kinds() -> Vec<&'static str> {
    vec!["summary.default", "translation.default", "translation.hy-mt", "tagging.default"]
}
