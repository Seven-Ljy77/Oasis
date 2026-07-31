# Oasis -- Mercury for Windows

A local-first RSS reader with AI agent capabilities, built for Windows using **Tauri 2 + Rust + React/TypeScript + WebView2**.

Inspired by [Mercury for macOS](https://github.com/neolee/mercury) -- same database schema, same product philosophy, native Windows experience.

## Features

### Feed Management
- Subscribe to RSS 2.0, Atom, and JSON Feed sources
- OPML import/export with concurrent processing and real-time progress
- Multi-feed sync with configurable concurrency (2-10, default 6)
- Duplicate detection, URL normalization, HTTPS enforcement
- First-run bootstrap with bundled starter feeds

### Reading Experience
- Three-column layout (feeds | articles | reader) with draggable resizers
- Three reading modes: **Reader** (cleaned content), **Web** (original page), **Dual** (side-by-side)
- Mozilla Readability.js integration via QuickJS for content extraction
- Four-stage pipeline: Source HTML -> Readability -> Markdown -> Rendered HTML
- 5-level cache hierarchy with independent layer versioning
- Theme system: Classic / Paper presets, Light / Dark / Eye Care modes, Quick Style (Warm / Cool / Slate)
- Customizable fonts, size, line height, and content width
- Keyboard shortcuts: J/K navigation, M read toggle, S star, V open in browser, Ctrl+F search

### AI Agents
- **Summary**: streaming AI-generated article summaries in 12 languages, 3 detail levels (short/medium/detailed), auto-summary mode
- **Translation**: segment-based concurrent translation with bilingual display, content-hash caching, checkpoint recovery
- **Tagging**: AI-suggested tags with vocabulary injection, single-entry and batch modes
- Word/phrase translation on text selection
- Customizable prompt templates per agent with hot-reload support
- LLM provider management: OpenAI-compatible API, Windows Credential Manager for API key storage
- Usage tracking with charts (token consumption, success rate, provider/model breakdown)

### Search
- Modal search dialog with backdrop blur
- Categorized results: Articles, Tags, and Notes
- Keyboard navigation (arrows + Enter), 200ms debounce

### Notes & Digest
- Per-article Markdown notes with 5-second auto-save
- Single/multi-entry Digest export to Markdown files
- Four export templates: Default, Minimal, Academic, Newsletter
- Share via clipboard, open in external browser

### Tag System
- Flat tag model with normalization (trim -> lowercase -> collapse separators)
- 3-tier dedup: normalization -> strict match -> alias resolution
- Tag library management: rename, merge, alias, delete unused
- Sidebar tag filter with Any/All match modes
- AI-created tags start as provisional, auto-promoted at usage_count >= 2

### Multi-select & Batch Export
- Multi-select mode with checkbox selection
- Batch export: Export Digest (summaries + notes) and Export Articles (original Markdown)
- Escape to exit multi-select, click-anywhere on collapsed bars to expand

### UI & UX
- Bilingual interface: English and Simplified Chinese, runtime switching without restart
- Dark Mode for both app shell and reader content
- Persistent layout: panel widths and heights remembered across sessions via localStorage
- Collapsible sidebar and entry list with restored widths on expand
- Search button in entry list header

## Tech Stack

| Layer | Technology |
|------|------------|
| Desktop Framework | Tauri 2.x |
| Backend | Rust (Edition 2024) + tokio |
| Database | SQLite via rusqlite (bundled, WAL mode) |
| Frontend | React 19 + TypeScript |
| Styling | Tailwind CSS 3 |
| State Management | Zustand |
| Reader Rendering | WebView2 (Tauri webview) |
| Content Extraction | Mozilla Readability.js via QuickJS |
| Markdown -> HTML | comrak (GFM: tables, strikethrough, tasklists, autolinks) |
| HTML -> Markdown | Custom Rust converter (scraper crate) |
| Feed Parsing | feed-rs (RSS/Atom/JSON Feed) |
| LLM Client | reqwest + SSE streaming |
| Template Engine | Tera |
| Charts | Recharts |
| Credential Storage | Windows Credential Manager |
| Auto-update | Tauri updater |

## Getting Started

### Prerequisites

- [Rust](https://www.rust-lang.org/) (Edition 2024)
- [Node.js](https://nodejs.org/) 18+
- [Microsoft Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- [WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (pre-installed on Windows 11)

### Development

```bash
# Clone
git clone https://github.com/Seven-Ljy77/Oasis.git
cd Oasis
git checkout windows

# Install frontend dependencies
npm install

# Run in development mode (hot reload)
cd src-tauri
cargo tauri dev
```

### Build

```bash
cargo tauri build
# Output: src-tauri/target/release/bundle/
```

## Project Structure

```
oasis-windows/
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── main.rs               # Entry point
│   │   ├── lib.rs                # Module declarations, command registration
│   │   ├── state.rs              # AppState
│   │   ├── error.rs              # Unified AppError type
│   │   ├── db/                   # Database layer (16 stores + query builder)
│   │   ├── feed/                 # Feed sync, OPML, bootstrap, sidebar counts
│   │   ├── reader/               # Readability bridge, markdown converter/renderer, theme
│   │   ├── agent/                # LLM providers, route resolver, prompt templates
│   │   │   ├── summary/          # Summary executor + storage
│   │   │   ├── translation/      # Translation executor + segmenter + bilingual
│   │   │   └── tagging/          # Tagging executor + batch
│   │   ├── digest/               # Notes + digest export + templates
│   │   ├── tags/                 # Tag normalization + suggestion
│   │   ├── usage/                # Token tracking + reports
│   │   ├── tasking/              # Task queue + job runner
│   │   ├── resources/            # Embedded prompt/template loaders
│   │   └── commands/             # Tauri IPC handlers (9 command files)
│   ├── migrations/               # SQL migration scripts (001-018)
│   ├── icons/                    # Application icons (16 sizes)
│   └── capabilities/             # Tauri 2 permission manifests
├── src/                          # React frontend
│   ├── App.tsx                   # Root three-column layout
│   ├── components/ui/            # Base UI primitives (Button, Dialog, Sheet, etc.)
│   ├── features/                 # Feature modules
│   │   ├── sidebar/              # Feed list + tag filter
│   │   ├── entry-list/           # Article list + search modal + multi-select
│   │   ├── reader/               # Reader views + panels (summary/translation/tagging/note)
│   │   ├── settings/             # Settings (General/Reader/Agents/Digest/Logs)
│   │   ├── tags/                 # Tag library management
│   │   ├── digest/               # Share/export digest sheets
│   │   └── usage/                # Usage report charts
│   ├── stores/                   # 9 Zustand stores
│   ├── hooks/                    # Custom hooks (resizable, debounce, keyboard, etc.)
│   └── lib/                      # IPC wrappers, types, formatters, constants
├── resources/                    # YAML template files
│   ├── prompts/                  # AI agent prompt templates
│   └── templates/                # Digest export templates
└── docs/                         # Architecture plans + phase summaries
```

## Configuration

### LLM Provider Setup

1. Open Settings -> Agents -> Providers
2. Click "Add Provider" and fill in:
   - Name: any display name
   - Base URL: your OpenAI-compatible API endpoint (e.g., `http://localhost:11434/v1` for Ollama)
   - API Key: your provider's API key
3. Go to the Models tab and add at least one model
4. Go to the Agents tab and assign primary models for Summary / Translation / Tagging

### Local Development Defaults

The project is pre-configured for local LLM usage:

- `baseURL`: `http://localhost:5810/v1`
- `apiKey`: `local`
- `model`: `qwen3`

### Prompt Customization

Edit agent prompt templates by clicking "Customize Prompt" in Settings -> Agents. Files are stored in `%LOCALAPPDATA%/Oasis/prompts/`. Click "Reload Prompts" to apply changes without restarting.

## Database

The SQLite database mirrors the macOS Mercury schema for compatibility. See `docs/ARCHITECTURE.md` Section 3 for full DDL.

Database location: `%LOCALAPPDATA%/Oasis/oasis.db`

## Development Phases

| Phase | Status | Scope |
|------|--------|-------|
| 0-1 | Completed | Project scaffold, core reading MVP |
| 2-4 | Completed | AI agents, notes/digest, tag system |
| 5-7 | Completed | Polish: usage reports, themes, i18n, Dark Mode, Readability.js |
| 8 | Completed | Search, multi-select export, word translation, panel persistence, prompt customization |
| 9 | Completed | Icons, i18n completion, error messages, UI cleanup, documentation |

## License

MIT License -- see [macOS Mercury](https://github.com/neolee/mercury) for original project.

## Credits

- Original macOS Mercury by [Neo Lee](https://github.com/neolee)
- Windows port by [Seven-Ljy77](https://github.com/Seven-Ljy77)
