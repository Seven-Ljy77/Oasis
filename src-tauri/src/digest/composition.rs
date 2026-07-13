use crate::error::AppError;

/// Compose share-ready plain text from entry data.
pub fn compose_share_text(
    _title: &str,
    _author: Option<&str>,
    _url: Option<&str>,
    _summary: Option<&str>,
) -> Result<String, AppError> {
    todo!()
}

/// Compose a Markdown export from entry data and optional note.
pub fn compose_export_markdown(
    _title: &str,
    _author: Option<&str>,
    _url: Option<&str>,
    _content_html: Option<&str>,
    _note_markdown: Option<&str>,
    _template_id: Option<&str>,
) -> Result<String, AppError> {
    todo!()
}
