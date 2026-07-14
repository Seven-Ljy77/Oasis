-- Migration 017: Recover entries that were soft-deleted by "Delete All" bug.
-- Also permanently delete entries older than this fix (orphaned from deleted feeds).
UPDATE entry SET is_deleted = 0;
