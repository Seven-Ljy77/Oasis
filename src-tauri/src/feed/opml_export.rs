use crate::db::models::Feed;
use crate::error::AppError;

/// Generates OPML 2.0 XML from a list of feeds and writes it to disk.
pub struct OpmlExporter;

impl OpmlExporter {
    /// Generate an OPML 2.0 XML string from a list of feeds.
    pub fn to_xml(feeds: &[Feed]) -> Result<String, AppError> {
        let mut xml = String::from(
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n\
             <opml version=\"2.0\">\n\
             \x20 <head><title>Oasis Subscriptions</title></head>\n\
             \x20 <body>\n",
        );

        for feed in feeds {
            let title = feed.title.as_str();
            let site = feed.site_url.as_deref().unwrap_or(&feed.feed_url);

            xml.push_str("    <outline text=\"");
            xml.push_str(&escape_xml(title));
            xml.push_str("\" title=\"");
            xml.push_str(&escape_xml(title));
            xml.push_str("\" type=\"rss\" xmlUrl=\"");
            xml.push_str(&escape_xml(&feed.feed_url));
            xml.push_str("\" htmlUrl=\"");
            xml.push_str(&escape_xml(site));
            xml.push_str("\"/>\n");
        }

        xml.push_str("  </body>\n</opml>\n");
        Ok(xml)
    }

    /// Export feeds to an OPML file at the given path.
    pub fn export(feeds: &[Feed], path: &str) -> Result<(), AppError> {
        let xml = Self::to_xml(feeds)?;
        std::fs::write(path, xml)
            .map_err(|e| AppError::Unknown(format!("Failed to write OPML file: {}", e)))?;
        Ok(())
    }
}

/// Escape special XML characters in a string.
fn escape_xml(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}
