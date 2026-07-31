# Mercury Windows — CLAUDE.md

Reference for AI coding agents working on the Windows port of Mercury. Keep this file concise, prescriptive, and focused on repository-wide rules.

---

## 1. Project Overview

This is the **Windows port** of [Mercury](https://github.com/neolee/mercury), a local-first RSS reader with AI agent features (summary, translation, tagging). The macOS version is a native SwiftUI app; the Windows version is a ground-up rewrite using **Tauri 2 + Rust + React/TypeScript + WebView2**.

The macOS reference codebase lives on the `mac` branch. The `windows` branch is an independent codebase that shares only the database schema and product concepts — no Swift code is reused directly.

**Key documents in this branch:**

| File | Content |
|------|---------|
| `docs/ARCHITECTURE.md` | Full architecture plan (tech stack, directory layout, DB schema, IPC API, phases) |
| `docs/MERCURY_FEATURES.md` | Complete feature inventory of the macOS version (~162 features) |
| `docs/phases/PHASE*.md` | Phase completion summaries (PHASE0 through PHASE9) |

---

## 2. Communication and Documentation

- Communicate with the user in Chinese.
- Write code comments and repository documentation in English.
- Do not use emojis in code comments or documentation.
- Use backticks for code references in Markdown.

---

## 3. Tech Stack

| Layer | Technology |
|------|------------|
| Desktop framework | Tauri 2.x |
| Backend language | Rust (Edition 2024) |
| Async runtime | tokio |
| Database | SQLite via rusqlite (bundled, WAL mode) |
| Frontend UI | React 19 + TypeScript |
| Styling | Tailwind CSS 4 |
| State management | Zustand |
| Reader rendering | WebView2 (Tauri's webview) |
| Article extraction | Mozilla Readability.js (executed in WebView) |
| Markdown → HTML | comrak (GFM-aware) + custom enhancements |
| HTML → Markdown | Custom Rust converter using scraper crate |
| Feed parsing | feed-rs crate (RSS/Atom/JSON Feed) |
| LLM client | reqwest + manual SSE stream parsing |
| Template engine | Tera (Mustache-compatible) |
| Charts | Recharts |
| Credential storage | Windows Credential Manager |
| Auto-update | Tauri updater |
| Testing | Rust: cargo test / TS: Vitest |

---

## 4. Project Structure

```
oasis-windows/
├── src-tauri/                    # Rust backend
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/             # Tauri 2 permissions
│   ├── migrations/               # SQL migration scripts (001_create_feed.sql ...)
│   └── src/
│       ├── main.rs               # Tauri entry point, register commands
│       ├── lib.rs                # Module declarations
│       ├── state.rs              # AppState (global managed state)
│       ├── error.rs              # Unified error type
│       ├── db/                   # Database layer (models, stores, query builder)
│       ├── feed/                 # Feed management (sync, OPML, bootstrap)
│       ├── reader/               # Reader pipeline (readability bridge, markdown, theme)
│       ├── agent/                # AI agents (runtime, provider, summary/translation/tagging)
│       ├── digest/               # Notes & digest export
│       ├── tags/                 # Tag normalization, suggestion, local NLP
│       ├── usage/                # Token usage tracking & reports
│       ├── tasking/              # Task queue, job runner, failure policy
│       ├── resources/            # Embedded prompt & digest templates
│       └── commands/             # Tauri IPC command handlers
├── src/                          # React frontend
│   ├── main.tsx
│   ├── App.tsx                   # Root component (three-column layout)
│   ├── styles/                   # Tailwind + reader theme CSS
│   ├── components/ui/            # Base UI primitives (Button, Dialog, Sheet, etc.)
│   ├── features/                 # Feature modules
│   │   ├── sidebar/              # Feed list, tag filter
│   │   ├── entry-list/           # Article list with pagination
│   │   ├── reader/               # Reader view, WebView, panels
│   │   ├── settings/             # Settings window (General, Reader, Agents, Digest)
│   │   ├── tags/                 # Tag library, rename, batch tagging
│   │   ├── digest/               # Share/export digest sheets
│   │   └── usage/                # Usage report charts
│   ├── stores/                   # Zustand stores (useAppStore, useReaderStore, etc.)
│   ├── hooks/                    # Custom hooks (useTauriCommand, useDebounce, etc.)
│   └── lib/                      # IPC type wrappers, formatters, constants
└── resources/                    # YAML templates (prompts, digest)
```

---

## 5. Coding Conventions

### 5.1 Rust

- Follow standard Rust naming: `snake_case` for functions/variables, `CamelCase` for types, `SCREAMING_SNAKE_CASE` for constants.
- Use `thiserror` for error types; prefer structured errors over string messages.
- All Tauri commands return `Result<T, AppError>` where `AppError` implements `Serialize`.
- Database operations should be synchronous (rusqlite) wrapped in `tokio::task::spawn_blocking` when called from async context.
- Use `Arc<RwLock<T>>` for shared mutable state in `AppState`; prefer `RwLock` over `Mutex` for read-heavy state.
- Prefer structured concurrency; avoid `tokio::spawn` without explicit lifecycle management.
- Module visibility: keep modules `pub(crate)` unless the symbol is a Tauri command.
- Document public APIs with `///` doc comments.

### 5.2 TypeScript / React

- Use functional components and hooks exclusively; no class components.
- One component per file. Component files use `PascalCase.tsx`; hooks use `camelCase.ts`.
- Props types defined as interfaces in the same file or in a sibling `types.ts`.
- Use Zustand stores for global state; avoid prop drilling beyond 2 levels.
- Tauri `invoke()` calls must be wrapped in `lib/ipc.ts` with proper type signatures; never call `invoke()` directly from components.
- Event listeners from Tauri must be set up in `useEffect` with proper cleanup.
- CSS: Tailwind utility classes first; custom CSS only for reader theme tokens and WebView-specific styles.

### 5.3 Naming

- Rust stores: `feed_store.rs`, `entry_store.rs` — one store per entity.
- Tauri commands: `feed_commands.rs`, `agent_commands.rs` — grouped by domain.
- React components: `SidebarView.tsx`, `ReaderDetailView.tsx` — `*View.tsx` suffix for major views.
- React feature subdirectories use kebab-case: `entry-list/`, `reader/`.

---

## 6. Build, Test, and Quality

```shell
# Rust
cargo build                    # Build backend
cargo test                     # Run Rust tests
cargo clippy                   # Lint (must pass with no warnings)
cargo fmt -- --check           # Format check

# Frontend
npm run dev                    # Vite dev server
npm run build                  # Production build
npx vitest                     # Run TS tests

# Full Tauri app
cargo tauri dev                # Development mode with hot reload
cargo tauri build              # Production build → .msi/.exe
```

- Keep build and test runs free of compiler errors and warnings.
- Run `cargo clippy` before committing Rust changes.
- Database migration tests must verify both upgrade and downgrade paths where applicable.

---

## 7. Database Conventions

- All tables use `INTEGER PRIMARY KEY AUTOINCREMENT` for IDs.
- Timestamps stored as ISO 8601 text (`DATETIME`). Use `chrono` for Rust-side date handling.
- Boolean values stored as `INTEGER` (0/1), not SQLite boolean literals.
- Foreign keys enforced (`PRIMARY KEY ... REFERENCES ... ON DELETE CASCADE`).
- Unique constraints preferred over application-level dedup where the database can enforce them.
- Migration files are numbered sequentially: `001_create_feed.sql`, `002_create_entry.sql`, etc.
- Never modify an existing migration; always add a new one.
- Entry visibility queries must always filter `is_deleted = 0`.

### Schema parity with macOS

The database schema intentionally mirrors the macOS version. See `docs/ARCHITECTURE.md` Section 3 for the full DDL. Key tables:

| Table | Purpose |
|------|---------|
| `feed` | RSS/Atom/JSON Feed subscriptions |
| `entry` | Articles (with soft-delete via `is_deleted`) |
| `content` | Reader pipeline data (source HTML, cleaned HTML, markdown) |
| `content_html_cache` | Theme-specific rendered HTML cache |
| `entry_note` | User Markdown notes per article |
| `tag` / `tag_alias` / `entry_tag` | Flat tag system with alias resolution |
| `agent_provider_profile` / `agent_model_profile` / `agent_profile` | LLM configuration |
| `agent_task_run` / `llm_usage_event` | Agent execution records + token tracking |
| `summary_result` / `translation_result` / `translation_segment` | AI output cache |
| `tag_batch_*` | Batch tagging pipeline staging |

---

## 8. IPC Architecture

Frontend communicates with the Rust backend exclusively through Tauri commands (`invoke()`) and events (`listen()`).

### Commands (Frontend → Backend)

All commands are async and return `Result<T, AppError>`. See `docs/ARCHITECTURE.md` Section 4.3 for the full API.

```typescript
// Example: lib/ipc.ts
import { invoke } from '@tauri-apps/api/core';
import type { Feed, EntryPage, EntryListQuery } from './types';

export const addFeed = (url: string, title?: string) =>
  invoke<Feed>('add_feed', { url, title });

export const loadEntries = (query: EntryListQuery) =>
  invoke<EntryPage>('load_entries', { query });
```

### Events (Backend → Frontend)

For streaming/background progress, the backend emits events that the frontend listens to:

| Event | Payload | When |
|------|---------|------|
| `summary-token` | `{ entry_id, token, is_complete }` | Streaming LLM response |
| `translation-segment` | `{ entry_id, segment_id, text }` | Per-segment completion |
| `translation-progress` | `{ entry_id, request_id, status, segment_id, ... }` | Translation lifecycle (started/segment_completed/completed/failed) |
| `sync-progress` | `{ feed_id, progress, status }` | Feed sync progress |
| `import-opml-progress` | `{ feed_title, feed_url, status, completed, total }` | OPML import per-feed progress |
| `agent-state-change` | `{ entry_id, phase, status_text }` | Agent lifecycle changes |

---

## 9. Architecture Patterns

### 9.1 DB-First Writes

All mutations write to SQLite first, then update in-memory state. On failure, in-memory state is unchanged (no optimistic rollback needed).

### 9.2 Soft Delete for Entries

Entries use `is_deleted = 1` rather than physical deletion. All visible-entry queries must filter `is_deleted = 0`. Associated data (content, cache, notes, tags) is hard-deleted on entry soft-delete.

### 9.3 Cursor-Based Pagination

Entry lists use keyset pagination on `(published_at, created_at, id)`. No offset-based pagination.

### 9.4 Reader Pipeline (4-Stage)

```
Source HTML → Readability.js → Cleaned HTML → Markdown → Rendered Reader HTML
```

Each stage is independently versioned and cached. Only stale layers are rebuilt.

### 9.5 Agent Runtime State Machine

```
Idle → Waiting → Requesting → Generating → Persisting → Completed/Failed/TimedOut/Cancelled
```

Concurrency limits (per task kind):
- Summary: active 1 + waiting 1 (latest-only replacement)
- Translation: active 1 + waiting 1
- Tagging: active 1 + waiting 0
- TaggingBatch: active 1 + waiting 0

### 9.6 Prompt/Template Ownership

- Built-in prompts live in `resources/prompts/*.default.yaml`.
- User customizations are stored in `%LOCALAPPDATA%/Oasis/prompts/` (sandbox copies).
- `PromptTemplateStore` loads user templates first, falls back to built-in.
- `reload_prompt_templates` command allows hot-reloading without restart.
- Prompt files use `systemTemplate` (or `system_prompt`) and `template` (or `user_prompt_template`) YAML keys.
- Executor code must never hard-code prompt text — templates are the sole source.

### 9.7 Tag System

Flat tag model with 3-tier dedup: normalization → strict match → alias resolution.
AI-created tags start as `is_provisional = 1`; promoted at `usage_count >= 2`.

---

## 10. Key Behavioral Contracts (from macOS)

These product behaviors must be preserved in the Windows port:

- Batch read-state actions are query-scoped (feed scope + unread filter + search filter), not page-scoped.
- Search targets `Entry.title` and `Entry.summary` only.
- In unread-only mode, the pinned entry (`unreadPinnedEntryId`) preserves the current reading position; feed switch or unread-filter toggle clears it; non-empty search disables it.
- Translation segments are `p`, `ul`, `ol` only, plus one synthetic header segment for title/author.
- Auto-summary: confirm-on-enable, 1-second debounce, serialized, no auto-retry.
- Summary slot key: `(entry_id, target_language, detail_level)`.
- Translation slot key: `(entry_id, target_language, source_content_hash, segmenter_version)`.
- Export filenames: `yyyy-mm-dd-{slug}.md`, CJK-preserving slug, collision-safe with numeric suffixes.

---

## 11. Message Surface Rules

| Surface | Usage |
|---------|-------|
| Modal dialog | Destructive confirmations (delete feed/entry/tag) |
| Status bar | Global sync state, task progress, stats summary |
| Reader banner | Entry-bound agent notifications (summary/translation/tagging status) |
| Batch sheet footer | Batch tagging notices, failures, and actions |
| Toast/notification | Transient success confirmations (export complete, etc.) |

Do not show Reader-banner messages for batch-tagging events or global sync failures.

---

## 12. Development Phases

| Phase | Scope | Status |
|------|-------|--------|
| **Phase 0** | Project scaffold | ✅ |
| **Phase 1** | Core reading MVP | ✅ |
| **Phase 2** | AI agents (LLM config, summary, translation, tagging) | ✅ |
| **Phase 3** | Notes & digest (editor, share, export, templates) | ✅ |
| **Phase 4** | Tag system (panel, library, batch, NLP) | ✅ |
| **Phase 5–7** | Polish (usage reports, theme system, i18n, Dark Mode, Readability.js, OPML, sidebar counts, batch ops) | ✅ |
| **Phase 8** | Interaction refinement (search modal, multi-select export, word translation, panel persistence, prompt customization) | ✅ |
| **Phase 9** | Ship preparation (icons, i18n completion, error messages, UI cleanup, documentation) | ✅ |

---

## 13. Local Development Defaults

Local AI integration profile (matching macOS defaults):

- `baseURL`: `http://localhost:5810/v1`
- `apiKey`: `local`
- `model`: `qwen3`
- `thinkingModel`: `qwen3-thinking`
