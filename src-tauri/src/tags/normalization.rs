/// Normalize a tag name for comparison and deduplication.
///
/// Steps: trim → lowercase → collapse whitespace and separator characters.
///
/// # Examples
/// - "  SwiftUI  " → "swiftui"
/// - "Machine Learning" → "machine learning"
/// - "AI/ML" → "ai ml"
pub fn normalize_tag(name: &str) -> String {
    let normalized = name
        .trim()
        .to_lowercase()
        .chars()
        .map(|c| if c == '-' || c == '_' || c == '/' || c == '\\' { ' ' } else { c })
        .collect::<String>();

    // Collapse multiple whitespace into single space
    let words: Vec<&str> = normalized.split_whitespace().collect();
    words.join(" ")
}
