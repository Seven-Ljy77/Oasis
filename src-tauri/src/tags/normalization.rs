/// Normalize a tag name for comparison and deduplication.
///
/// Steps: trim → lowercase → collapse whitespace and separator characters.
///
/// # Examples
/// - "  SwiftUI  " → "swiftui"
/// - "Machine Learning" → "machine learning"
/// - "AI/ML" → "ai ml"
pub fn normalize_tag(_name: &str) -> String {
    todo!()
}

/// Check whether two tag names normalize to the same value.
pub fn tags_are_equal(a: &str, b: &str) -> bool {
    normalize_tag(a) == normalize_tag(b)
}
