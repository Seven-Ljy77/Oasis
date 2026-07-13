use crate::error::AppError;

/// Represents a single outline entry in an OPML file.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct OpmlOutline {
    pub title: Option<String>,
    pub xml_url: Option<String>,
    pub html_url: Option<String>,
    pub children: Vec<OpmlOutline>,
}

/// Imports feeds from an OPML file.
pub struct OpmlImporter;

impl OpmlImporter {
    /// Parse an OPML file and return the list of feed outlines.
    pub fn import(_path: &str) -> Result<Vec<OpmlOutline>, AppError> {
        todo!()
    }

    /// Import outlines into the database.
    pub fn import_into_db(
        _outlines: &[OpmlOutline],
        _replace: bool,
        _force_site_name: bool,
    ) -> Result<ImportResult, AppError> {
        todo!()
    }
}

/// Result of an OPML import operation.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ImportResult {
    pub added: usize,
    pub skipped: usize,
    pub errors: Vec<String>,
}
