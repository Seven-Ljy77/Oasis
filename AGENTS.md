# Oasis Linux — AGENTS.md

Reference for AI coding agents working on the Linux port of Oasis / Mercury. Keep this file concise, prescriptive, and focused on repository-wide rules.

---

## 1. Project Overview

This is the **Linux port** of Oasis, a local-first RSS reader with AI agent features for summary, translation, and tagging.

The Linux version is built from the completed Windows implementation and adapted for the Linux desktop stack:

- **Tauri 2 + Rust + React/TypeScript**
- **WebKitGTK** for the Linux webview
- **SQLite** for local-first storage
- **Secret Service / libsecret** for API key storage through the Rust `keyring` crate

The macOS reference project is [Mercury](https://github.com/neolee/mercury). The Linux branch preserves the same product philosophy and database-oriented design.

Key documents:

| File | Content |
|------|---------|
| `README.md` | Linux-specific setup, development, WSLg notes, and feature overview |
| `docs/ARCHITECTURE.md` | Architecture plan, tech stack, directory layout, database schema, IPC API, phases |
| `docs/MERCURY_FEATURES.md` | Complete feature inventory of the macOS version |
| `docs/phases/PHASE*.md` | Phase completion summaries |

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
| Backend language | Rust Edition 2024 |
| Async runtime | tokio |
| Database | SQLite via rusqlite, bundled, WAL mode |
| Frontend UI | React 19 + TypeScript |
| Styling | Tailwind CSS |
| State management | Zustand |
| Linux webview | WebKitGTK |
| Article extraction | Mozilla Readability.js via QuickJS |
| Markdown to HTML | comrak with GFM support and custom enhancements |
| HTML to Markdown | Custom Rust converter using scraper |
| Feed parsing | feed-rs |
| LLM client | reqwest + manual SSE stream parsing |
| Template engine | Tera |
| Charts | Recharts |
| Credential storage | Secret Service / libsecret via `keyring` |
| Auto-update | Tauri updater |
| Testing | Rust: cargo test / TypeScript: Vitest |

---

## 4. Project Structure

```text
oasis-linux/
|-- src-tauri/                    # Rust backend
|   |-- Cargo.toml
|   |-- tauri.conf.json
|   |-- capabilities/             # Tauri 2 permissions
|   |-- migrations/               # SQL migration scripts
|   `-- src/
|       |-- main.rs               # Tauri entry point
|       |-- lib.rs                # Module declarations and command registration
|       |-- state.rs              # AppState
|       |-- error.rs              # Unified AppError type
|       |-- db/                   # Database layer
|       |-- feed/                 # Feed management
|       |-- reader/               # Reader pipeline
|       |-- agent/                # AI agents
|       |-- digest/               # Notes and digest export
|       |-- tags/                 # Tag normalization and suggestion
|       |-- usage/                # Token usage tracking and reports
|       |-- tasking/              # Task queue and job runner
|       |-- resources/            # Embedded prompt/template loaders
|       `-- commands/             # Tauri IPC command handlers
|-- src/                          # React frontend
|   |-- App.tsx
|   |-- components/ui/
|   |-- features/
|   |-- stores/
|   |-- hooks/
|   `-- lib/
|-- resources/                    # YAML templates
`-- docs/                         # Architecture plans and phase summaries
```

---

## 5. Coding Conventions

### 5.1 Rust

- Follow standard Rust naming: `snake_case` for functions and variables, `CamelCase` for types, `SCREAMING_SNAKE_CASE` for constants.
- Use `thiserror` for error types; prefer structured errors over string messages.
- All Tauri commands return `Result<T, AppError>` where `AppError` implements `Serialize`.
- Database operations are synchronous through rusqlite and should be wrapped in `tokio::task::spawn_blocking` when called from async context.
- Use `Arc<RwLock<T>>` for shared mutable state in `AppState`; prefer `RwLock` over `Mutex` for read-heavy state.
- Prefer structured concurrency; avoid `tokio::spawn` without explicit lifecycle management.
- Keep modules `pub(crate)` unless the symbol must be externally visible or is a Tauri command.
- Document public APIs with `///` doc comments.

### 5.2 TypeScript / React

- Use functional components and hooks exclusively; no class components.
- One component per file. Component files use `PascalCase.tsx`; hooks use `camelCase.ts`.
- Define props as interfaces in the same file or in a sibling `types.ts`.
- Use Zustand stores for global state; avoid prop drilling beyond 2 levels.
- Tauri `invoke()` calls must be wrapped in `src/lib/ipc.ts` with proper type signatures; do not call `invoke()` directly from components.
- Tauri event listeners must be set up in `useEffect` with proper cleanup.
- Prefer Tailwind utility classes. Use custom CSS only for reader theme tokens and WebView-specific styles.

### 5.3 Naming

- Rust stores: `feed_store.rs`, `entry_store.rs`; one store per entity.
- Tauri commands: `feed_commands.rs`, `agent_commands.rs`; grouped by domain.
- React major views use the `*View.tsx` suffix, for example `SidebarView.tsx` and `ReaderDetailView.tsx`.
- React feature subdirectories use kebab-case, for example `entry-list/`.

---

## 6. Build, Test, and Quality

```shell
# Rust backend
cd src-tauri
cargo check
cargo build
cargo test
cargo clippy
cargo fmt -- --check

# Frontend
npm run dev
npm run build
npx vitest

# Full Tauri app
cargo tauri dev
cargo tauri build
```

- Keep build and test runs free of compiler errors.
- Run `npm run build` and `cargo check` for routine validation.
- Run `cargo clippy` before committing non-trivial Rust changes.
- Database migration tests must verify upgrade paths where applicable.

### WSLg

When testing under WSL2 + WSLg, WebKitGTK may need software rendering:

```shell
WEBKIT_DISABLE_DMABUF_RENDERER=1 \
WEBKIT_DISABLE_COMPOSITING_MODE=1 \
LIBGL_ALWAYS_SOFTWARE=1 \
GSK_RENDERER=cairo \
cargo tauri dev
```

This workaround is for WSLg rendering issues only. Native Linux desktops should try plain `cargo tauri dev` first.

---

## 7. Database Conventions

- All tables use `INTEGER PRIMARY KEY AUTOINCREMENT` for IDs.
- Timestamps are stored as ISO 8601 text.
- Boolean values are stored as `INTEGER` values, `0` or `1`.
- Foreign keys should use `ON DELETE CASCADE` where ownership is clear.
- Prefer database-level unique constraints where the database can enforce deduplication.
- Migration files are numbered sequentially: `001_create_feed.sql`, `002_create_entry.sql`, etc.
- Never modify an existing migration after it has been committed; add a new migration instead.
- Entry visibility queries must filter `is_deleted = 0`.

---

## 8. IPC Architecture

Frontend communicates with Rust exclusively through Tauri commands and events.

- Command wrappers live in `src/lib/ipc.ts`.
- Command handlers live in `src-tauri/src/commands/`.
- Components should use typed IPC wrappers instead of importing `invoke()` directly.
- Streaming/background progress is sent through Tauri events.

Common event surfaces:

| Event | Purpose |
|------|---------|
| `summary-token` | Streaming summary response |
| `translation-segment` | Per-segment translation completion |
| `translation-progress` | Translation lifecycle |
| `sync-progress` | Feed sync progress |
| `import-opml-progress` | OPML import progress |
| `agent-state-change` | Agent runtime state changes |

---

## 9. Architecture Patterns

### 9.1 DB-First Writes

All mutations write to SQLite first, then update in-memory state. On failure, in-memory state should remain unchanged.

### 9.2 Soft Delete for Entries

Entries use `is_deleted = 1` rather than physical deletion. All visible-entry queries must filter `is_deleted = 0`.

### 9.3 Cursor-Based Pagination

Entry lists use keyset pagination on `(published_at, created_at, id)`. Avoid offset-based pagination.

### 9.4 Reader Pipeline

```text
Source HTML -> Readability.js -> Cleaned HTML -> Markdown -> Rendered Reader HTML
```

Each layer is versioned and cached independently.

### 9.5 Agent Runtime State Machine

```text
Idle -> Waiting -> Requesting -> Generating -> Persisting -> Completed/Failed/TimedOut/Cancelled
```

Concurrency limits:

- Summary: active 1 + waiting 1
- Translation: active 1 + waiting 1
- Tagging: active 1 + waiting 0
- TaggingBatch: active 1 + waiting 0

### 9.6 Prompt and Template Ownership

- Built-in prompts live in `resources/prompts/*.default.yaml`.
- User customizations are stored under `~/.local/share/Oasis/prompts/` on Linux.
- `PromptTemplateStore` loads user templates first, then falls back to built-ins.
- `reload_prompt_templates` allows hot reload without restarting.
- Executor code must not hard-code prompt text.

### 9.7 Tag System

Flat tag model with three-tier deduplication:

```text
normalization -> strict match -> alias resolution
```

AI-created tags start as `is_provisional = 1` and are promoted when usage reaches the configured threshold.

---

## 10. Key Behavioral Contracts

Preserve these behaviors across platform branches:

- Batch read-state actions are query-scoped, not page-scoped.
- Search targets `Entry.title` and `Entry.summary` only.
- In unread-only mode, the pinned entry preserves the current reading position.
- Translation segments are `p`, `ul`, and `ol`, plus one synthetic header segment for title/author.
- Auto-summary is confirm-on-enable, debounced, serialized, and has no automatic retry.
- Summary slot key: `(entry_id, target_language, detail_level)`.
- Translation slot key: `(entry_id, target_language, source_content_hash, segmenter_version)`.
- Export filenames use `yyyy-mm-dd-{slug}.md`, preserve CJK slugs, and avoid collisions with numeric suffixes.

---

## 11. Message Surface Rules

| Surface | Usage |
|---------|-------|
| Modal dialog | Destructive confirmations |
| Status bar | Global sync state, task progress, stats summary |
| Reader banner | Entry-bound agent notifications |
| Batch sheet footer | Batch tagging notices, failures, and actions |
| Toast/notification | Transient success confirmations |

Do not show Reader-banner messages for batch-tagging events or global sync failures.

---

## 12. Local Development Defaults

Local AI integration profile:

- `baseURL`: `http://localhost:5810/v1`
- `apiKey`: `local`
- `model`: `qwen3`
- `thinkingModel`: `qwen3-thinking`
