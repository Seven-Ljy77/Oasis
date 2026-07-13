use crate::db::models::Feed;
use crate::error::AppError;

/// Exports feeds to an OPML file.
pub struct OpmlExporter;

impl OpmlExporter {
    /// Generate OPML XML string from a list of feeds.
    pub fn to_xml(_feeds: &[Feed]) -> Result<String, AppError> {
        todo!()
    }

    /// Export feeds to an OPML file at the given path.
    pub fn export(_feeds: &[Feed], _path: &str) -> Result<(), AppError> {
        todo!()
    }
}
