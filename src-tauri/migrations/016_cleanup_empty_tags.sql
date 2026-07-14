-- Migration 016: Clean up tags with empty names from previous buggy sessions
DELETE FROM tag WHERE TRIM(name) = '' OR TRIM(normalized_name) = '';
