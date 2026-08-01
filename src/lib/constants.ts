// =============================================================================
// Mercury — Application constants
// =============================================================================

import type { ThemePreset, ThemeTokens } from "./types";

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

/** Default number of entries to fetch per page. */
export const DEFAULT_PAGE_SIZE = 50;

/** Maximum entries that can be requested in a single page. */
export const MAX_PAGE_SIZE = 200;

// ---------------------------------------------------------------------------
// Debounce & throttle delays (milliseconds)
// ---------------------------------------------------------------------------

export const SEARCH_DEBOUNCE_MS = 300;
export const AUTO_SAVE_DEBOUNCE_MS = 800;
export const SYNC_THROTTLE_MS = 500;
export const RESIZE_DEBOUNCE_MS = 150;
export const THEME_CHANGE_DEBOUNCE_MS = 100;

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

export const DEFAULT_SYNC_CONCURRENCY = 4;
export const MAX_SYNC_CONCURRENCY = 16;
export const MIN_SYNC_CONCURRENCY = 1;

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export const AGENT_REQUEST_TIMEOUT_MS = 120_000;
export const AGENT_MAX_RETRIES = 2;
export const AGENT_WAITING_POLL_INTERVAL_MS = 1_000;

/** Task kinds that individual entries can request. */
export const AGENT_TASK_KINDS = [
  "summary",
  "translation",
  "tagging",
] as const;

/** Task kinds that reports availability in the UI. */
export const AGENT_USABLE_KINDS = [
  "summary",
  "translation",
  "tagging",
] as const;

// ---------------------------------------------------------------------------
// Reader theme defaults
// ---------------------------------------------------------------------------

export const THEME_PRESETS: ThemePreset[] = ["classic", "paper"];

export const DEFAULT_THEME_PRESET: ThemePreset = "classic";

export const DEFAULT_THEME_TOKENS: Record<ThemePreset, ThemeTokens> = {
  classic: {
    fontFamily: "'Merriweather', Georgia, serif",
    fontSize: 17,
    lineHeight: 1.75,
    contentMaxWidth: 680,
    backgroundColor: "#faf9f7",
    textPrimaryColor: "#1a1a1a",
    textSecondaryColor: "#6b6b6b",
    linkColor: "#2563eb",
    blockquoteBorderColor: "#2563eb",
    codeBackgroundColor: "#f3f4f6",
    paragraphSpacing: 1.25,
    headingScale: 1.25,
    codeBlockRadius: 8,
  },
  paper: {
    fontFamily: "'Merriweather', Georgia, serif",
    fontSize: 18,
    lineHeight: 1.8,
    contentMaxWidth: 720,
    backgroundColor: "#fffdf7",
    textPrimaryColor: "#1a1a1a",
    textSecondaryColor: "#5c5c5c",
    linkColor: "#b45309",
    blockquoteBorderColor: "#d97706",
    codeBackgroundColor: "#fef3c7",
    paragraphSpacing: 1.5,
    headingScale: 1.2,
    codeBlockRadius: 4,
  },
};

// ---------------------------------------------------------------------------
// Usage / retention
// ---------------------------------------------------------------------------

export const DEFAULT_USAGE_RETENTION_MONTHS = 12;
export const MAX_USAGE_RETENTION_MONTHS = 60;

// ---------------------------------------------------------------------------
// Display limits
// ---------------------------------------------------------------------------

export const MAX_TITLE_LENGTH = 200;
export const MAX_SUMMARY_LENGTH = 500;
export const MAX_BADGE_COUNT = 9999;

// ---------------------------------------------------------------------------
// App meta
// ---------------------------------------------------------------------------

export const APP_NAME = "Oasis";
export const APP_VERSION = "0.1.0";
