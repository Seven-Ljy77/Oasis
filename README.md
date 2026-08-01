[English](#oasis----mercury-for-linux) | [中文](#oasis----mercury-linux-版)

---

<a id="oasis----mercury-for-linux"></a>

# Oasis -- Mercury for Linux

Oasis is a local-first RSS reader with AI agent capabilities, built for Linux using **Tauri 2 + Rust + React/TypeScript + WebKitGTK**.

This branch contains the Linux version of Oasis. It is based on the completed Windows implementation and keeps the same product model: local SQLite storage, three-column reading, Reader/Web/Dual modes, notes, tags, digest export, and AI-powered summary, translation, and tagging.

The project is inspired by [Mercury for macOS](https://github.com/neolee/mercury), sharing the same product philosophy and database-oriented design.

## Repository Branches

| Branch | Purpose |
|------|---------|
| `main` | Repository overview and branch index |
| `windows` | Windows version, built with Tauri 2 + Rust + React/TypeScript + WebView2 |
| `linux` | Linux version, built with Tauri 2 + Rust + React/TypeScript + WebKitGTK |
| `mac` | macOS reference / version branch |

## Features

### Feed Management

- Subscribe to RSS 2.0, Atom, and JSON Feed sources
- OPML import/export with concurrent processing and real-time progress
- Multi-feed sync with configurable concurrency
- Duplicate detection, URL normalization, and HTTPS enforcement
- First-run bootstrap with bundled starter feeds

### Reading Experience

- Three-column layout: feeds, articles, and reader
- Three reading modes: **Reader**, **Web**, and **Dual**
- Mozilla Readability.js integration for article extraction
- Four-stage reader pipeline: source HTML -> Readability -> Markdown -> rendered HTML
- Versioned cache layers for cleaned content, normalized Markdown, and rendered reader HTML
- Theme system with Classic / Paper presets, light / dark variants, and quick style overrides
- Customizable fonts, font size, line height, and content width
- Keyboard shortcuts for navigation, read state, starring, browser opening, and search

### AI Agents

- **Summary**: streaming AI-generated article summaries in multiple languages and detail levels
- **Translation**: segment-based concurrent translation with bilingual display and content-hash caching
- **Tagging**: AI-assisted tag suggestions with local vocabulary injection
- Word or phrase translation from selected reader text
- Prompt templates with hot-reload support
- OpenAI-compatible LLM provider configuration
- API key storage through the Linux Secret Service stack (`libsecret`, GNOME Keyring, or KWallet) via the Rust `keyring` crate
- Token usage tracking with charts and provider/model breakdowns

### Search, Notes, and Digest

- Modal search across articles, tags, and notes
- Per-article Markdown notes with auto-save
- Single-entry and multi-entry digest export
- Template-based digest generation
- Clipboard sharing and external browser opening

### Tag System

- Flat tag model with normalization and alias resolution
- Tag library management: rename, merge, alias, and delete unused tags
- Sidebar tag filters with Any/All match modes
- Batch tagging pipeline with review-before-apply workflow

### UI and UX

- English and Simplified Chinese interface
- Runtime language switching without restart
- Dark mode support for both app shell and reader content
- Persistent panel widths/heights through local storage
- Collapsible sidebar and entry list

## Tech Stack

| Layer | Technology |
|------|------------|
| Desktop Framework | Tauri 2.x |
| Backend | Rust Edition 2024 + tokio |
| Database | SQLite via rusqlite, bundled, WAL mode |
| Frontend | React 19 + TypeScript |
| Styling | Tailwind CSS |
| State Management | Zustand |
| Linux Webview | WebKitGTK |
| Content Extraction | Mozilla Readability.js via QuickJS |
| Markdown -> HTML | comrak with GFM support and custom enhancements |
| HTML -> Markdown | Custom Rust converter using scraper |
| Feed Parsing | feed-rs |
| LLM Client | reqwest + SSE streaming |
| Template Engine | Tera |
| Charts | Recharts |
| Credential Storage | Secret Service / libsecret via `keyring` |
| Auto-update | Tauri updater |

## Getting Started

### 1. Install Linux System Dependencies

Debian / Ubuntu:

```bash
sudo apt update
sudo apt install -y build-essential curl wget pkg-config \
  libwebkit2gtk-4.1-dev libgtk-3-dev librsvg2-dev \
  libayatana-appindicator3-dev libsecret-1-dev
```

Fedora:

```bash
sudo dnf install -y gcc gcc-c++ make curl wget pkg-config \
  webkit2gtk4.1-devel gtk3-devel librsvg2-devel \
  libappindicator-gtk3-devel libsecret-devel
```

Arch Linux:

```bash
sudo pacman -S --needed base-devel curl wget pkgconf \
  webkit2gtk-4.1 gtk3 librsvg libappindicator-gtk3 libsecret
```

### 2. Install Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
rustc --version
cargo --version
```

### 3. Install Node.js and npm

Use Node.js 18 or newer. On Ubuntu:

```bash
sudo apt install -y nodejs npm
node --version
npm --version
```

If you are using WSL, make sure `node` and `npm` point to Linux paths:

```bash
which node
which npm
```

Expected examples:

```text
/usr/bin/node
/usr/bin/npm
```

If `npm` points to `/mnt/c/...` or invokes `C:\Windows\system32\cmd.exe`, Windows Node/npm is leaking into WSL. Install the Linux packages and ensure `/usr/bin/npm` is used before running `npm install`.

### 4. Clone the Repository

```bash
mkdir -p ~/programming
cd ~/programming
git clone https://github.com/Seven-Ljy77/Oasis.git
cd Oasis
git checkout linux
```

For WSL development, keep the repository under the Linux filesystem, such as `~/programming/Oasis`, not under `/mnt/c/...`. This avoids severe file I/O slowdowns with `node_modules` and Cargo builds.

### 5. Install Project Dependencies

```bash
cd ~/programming/Oasis
npm install
```

### 6. Verify Frontend Build

```bash
npm run build
```

### 7. Verify Rust Backend

```bash
cd ~/programming/Oasis/src-tauri
cargo check
```

The first Rust build can take a long time because WebKitGTK/Tauri dependencies are compiled and cached.

## Development

Install the Rust Tauri CLI:

```bash
cargo install tauri-cli --version "^2.0.0"
```

Run the app:

```bash
cd ~/programming/Oasis
cargo tauri dev
```

The Tauri configuration starts the Vite dev server automatically through `beforeDevCommand`.

### WSLg Rendering Workaround

On WSL2 with WSLg, WebKitGTK may show a blank white window or EGL/Mesa warnings such as:

```text
libEGL warning: failed to get driver name for fd -1
MESA: error: ZINK: failed to choose pdev
```

If that happens, start the app with software rendering:

```bash
cd ~/programming/Oasis

WEBKIT_DISABLE_DMABUF_RENDERER=1 \
WEBKIT_DISABLE_COMPOSITING_MODE=1 \
LIBGL_ALWAYS_SOFTWARE=1 \
GSK_RENDERER=cairo \
cargo tauri dev
```

This workaround is mainly for WSLg. On a native Linux desktop, `cargo tauri dev` is usually enough.

## Production Build

```bash
cd ~/programming/Oasis
cargo tauri build
```

Build artifacts are generated under:

```text
src-tauri/target/release/bundle/
```

Depending on the target system and Tauri configuration, Linux bundles may include AppImage, deb, or rpm artifacts.

## Project Structure

```text
oasis-linux/
|-- src-tauri/                    # Rust backend
|   |-- src/
|   |   |-- main.rs               # Tauri entry point
|   |   |-- lib.rs                # Module declarations and command registration
|   |   |-- state.rs              # AppState
|   |   |-- error.rs              # Unified AppError type
|   |   |-- db/                   # Database layer
|   |   |-- feed/                 # Feed sync, OPML, bootstrap, sidebar counts
|   |   |-- reader/               # Readability, markdown, renderer, theme
|   |   |-- agent/                # LLM providers, runtime, summary, translation, tagging
|   |   |-- digest/               # Notes and digest export
|   |   |-- tags/                 # Tag normalization and suggestion
|   |   |-- usage/                # Token usage tracking and reports
|   |   |-- tasking/              # Task queue and job runner
|   |   |-- resources/            # Embedded prompt/template loaders
|   |   `-- commands/             # Tauri IPC command handlers
|   |-- migrations/               # SQL migration scripts
|   |-- icons/                    # Application icons
|   `-- capabilities/             # Tauri 2 permission manifests
|-- src/                          # React frontend
|   |-- App.tsx                   # Root three-column layout
|   |-- components/ui/            # Base UI primitives
|   |-- features/                 # Feature modules
|   |-- stores/                   # Zustand stores
|   |-- hooks/                    # Custom hooks
|   `-- lib/                      # IPC wrappers, types, formatters
|-- resources/                    # YAML prompt and digest templates
`-- docs/                         # Architecture plans and phase summaries
```

## Configuration

### LLM Provider Setup

1. Open Settings -> Agents -> Providers.
2. Add an OpenAI-compatible provider.
3. Add at least one model in the Models tab.
4. Assign models for Summary, Translation, and Tagging in the Agents tab.

The default local development profile is:

```text
baseURL: http://localhost:5810/v1
apiKey: local
model: qwen3
thinkingModel: qwen3-thinking
```

### Credential Storage

API keys are stored through the OS credential store via the Rust `keyring` crate.

On Linux, this usually means Secret Service through GNOME Keyring, KWallet, or another compatible provider. In minimal desktop environments or WSL, you may need to install and start a Secret Service provider before managed API key storage works.

### Prompt Customization

Built-in prompt templates are copied to the user data directory before editing. On Linux, user-customized prompts are stored under:

```text
~/.local/share/Oasis/prompts/
```

Use Settings -> Agents -> Reload Prompts to apply template changes without restarting.

## Database

Oasis uses a local SQLite database. On Linux, the default database location is:

```text
~/.local/share/Oasis/oasis.db
```

The schema follows the Mercury macOS database model. See `docs/ARCHITECTURE.md` for details.

## Notes for Linux Development

- Use `cargo tauri dev` from the repository root for local development.
- Use `npm run build` to verify the React/Vite frontend.
- Use `cargo check` inside `src-tauri/` to verify the Rust backend.
- Keep generated files out of git: `node_modules/`, `dist/`, and `src-tauri/target/` are ignored.
- When developing in WSL, store the repository under `/home/<user>/...`, not `/mnt/c/...`.

## License

MIT License. See [Mercury for macOS](https://github.com/neolee/mercury) for the original project inspiration.

## Credits

- Original macOS Mercury by [Neo Lee](https://github.com/neolee)
- Windows port by [Seven-Ljy77](https://github.com/Seven-Ljy77), [Yuanyyy11](https://github.com/Yuanyyy11), [RicardoMin](https://github.com/RicardoMin)
- Linux port based on the Windows implementation, adapted for WebKitGTK and Secret Service

---

<a id="oasis----mercury-linux-版"></a>

# Oasis -- Mercury Linux 版

Oasis 是一个本地优先的 RSS 阅读器，支持 AI 智能体能力。Linux 版本基于 **Tauri 2 + Rust + React/TypeScript + WebKitGTK** 构建。

当前分支是 Oasis 的 Linux 版本。它以已经完成的 Windows 版本为基础，保留相同的产品模型：本地 SQLite 存储、三栏阅读、Reader/Web/双栏模式、笔记、标签、文摘导出，以及 AI 摘要、翻译和打标签。

项目灵感来自 [Mercury for macOS](https://github.com/neolee/mercury)，延续其本地优先、轻量、数据库驱动的产品理念。

## 仓库分支

| 分支 | 说明 |
|------|------|
| `main` | 仓库概览与分支说明 |
| `windows` | Windows 版本，基于 Tauri 2 + Rust + React/TypeScript + WebView2 |
| `linux` | Linux 版本，基于 Tauri 2 + Rust + React/TypeScript + WebKitGTK |
| `mac` | macOS 参考版本 / 版本分支 |

## 功能特性

### 订阅源管理

- 支持 RSS 2.0、Atom 和 JSON Feed
- 支持 OPML 导入/导出，并带有并发处理和实时进度
- 支持多订阅源同步和可配置并发数
- 支持重复检测、URL 标准化和 HTTPS 校验
- 首次启动时可导入内置示例订阅源

### 阅读体验

- 三栏布局：订阅源、文章列表、阅读器
- 三种阅读模式：**Reader**、**Web**、**Dual**
- 使用 Mozilla Readability.js 提取正文内容
- 四阶段阅读管线：源 HTML -> Readability -> Markdown -> 渲染 HTML
- 清洗内容、Markdown、渲染结果分层缓存
- 支持 Classic / Paper 主题预设、浅色/深色变体和快速色彩风格
- 支持自定义字体、字号、行高和内容宽度
- 支持键盘快捷键进行导航、标记已读、收藏、搜索和外部浏览器打开

### AI 智能体

- **摘要**：流式生成多语言、多详细度文章摘要
- **翻译**：按段并发翻译，支持双语显示和内容哈希缓存
- **标签**：AI 辅助标签建议，并注入本地标签词库
- 支持选中文本的词句翻译
- 支持 Prompt 模板自定义和热重载
- 支持 OpenAI 兼容 LLM Provider 配置
- API Key 通过 Linux Secret Service 体系保存，例如 `libsecret`、GNOME Keyring 或 KWallet
- 支持 Token 用量统计、图表和 Provider/Model 维度分析

### 搜索、笔记与文摘

- 支持文章、标签、笔记的模态搜索
- 支持每篇文章的 Markdown 笔记和自动保存
- 支持单篇/多篇文摘导出
- 支持基于模板的文摘生成
- 支持复制到剪贴板和外部浏览器打开

### 标签系统

- 扁平标签模型，支持标准化与别名解析
- 支持标签库管理：重命名、合并、别名、删除未使用标签
- 侧栏支持标签过滤和 Any/All 匹配模式
- 支持带审查流程的批量 AI 打标签

### UI 与交互

- 支持英文和简体中文界面
- 支持运行时切换语言，无需重启
- 应用外壳和阅读内容均支持深色模式
- 面板宽度/高度持久化保存
- 支持折叠侧栏和文章列表

## 技术栈

| 层面 | 技术 |
|------|------|
| 桌面框架 | Tauri 2.x |
| 后端 | Rust Edition 2024 + tokio |
| 数据库 | SQLite via rusqlite，内置 SQLite，WAL 模式 |
| 前端 | React 19 + TypeScript |
| 样式 | Tailwind CSS |
| 状态管理 | Zustand |
| Linux Webview | WebKitGTK |
| 内容提取 | Mozilla Readability.js via QuickJS |
| Markdown -> HTML | comrak，支持 GFM 和自定义增强 |
| HTML -> Markdown | 基于 scraper 的自研 Rust 转换器 |
| Feed 解析 | feed-rs |
| LLM 客户端 | reqwest + SSE 流式解析 |
| 模板引擎 | Tera |
| 图表 | Recharts |
| 凭据存储 | Secret Service / libsecret via `keyring` |
| 自动更新 | Tauri updater |

## 快速开始

### 1. 安装 Linux 系统依赖

Debian / Ubuntu:

```bash
sudo apt update
sudo apt install -y build-essential curl wget pkg-config \
  libwebkit2gtk-4.1-dev libgtk-3-dev librsvg2-dev \
  libayatana-appindicator3-dev libsecret-1-dev
```

Fedora:

```bash
sudo dnf install -y gcc gcc-c++ make curl wget pkg-config \
  webkit2gtk4.1-devel gtk3-devel librsvg2-devel \
  libappindicator-gtk3-devel libsecret-devel
```

Arch Linux:

```bash
sudo pacman -S --needed base-devel curl wget pkgconf \
  webkit2gtk-4.1 gtk3 librsvg libappindicator-gtk3 libsecret
```

### 2. 安装 Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
rustc --version
cargo --version
```

### 3. 安装 Node.js 和 npm

需要 Node.js 18 或更新版本。Ubuntu 下可使用：

```bash
sudo apt install -y nodejs npm
node --version
npm --version
```

如果在 WSL 中开发，请确认 `node` 和 `npm` 指向 Linux 路径：

```bash
which node
which npm
```

期望结果示例：

```text
/usr/bin/node
/usr/bin/npm
```

如果 `npm` 指向 `/mnt/c/...`，或者执行时调用了 `C:\Windows\system32\cmd.exe`，说明 Windows 版 Node/npm 混入了 WSL。请安装 Linux 版 Node/npm，并确保使用 `/usr/bin/npm` 后再执行 `npm install`。

### 4. 克隆仓库

```bash
mkdir -p ~/programming
cd ~/programming
git clone https://github.com/Seven-Ljy77/Oasis.git
cd Oasis
git checkout linux
```

如果使用 WSL 开发，建议把仓库放在 Linux 原生文件系统，例如 `~/programming/Oasis`，不要放在 `/mnt/c/...` 下。这样可以避免 `node_modules` 和 Cargo 编译时出现明显的文件 I/O 性能问题。

### 5. 安装项目依赖

```bash
cd ~/programming/Oasis
npm install
```

### 6. 验证前端构建

```bash
npm run build
```

### 7. 验证 Rust 后端

```bash
cd ~/programming/Oasis/src-tauri
cargo check
```

第一次 Rust 编译可能会比较久，因为 WebKitGTK/Tauri 相关依赖需要下载、编译并缓存。

## 开发运行

安装 Rust 版 Tauri CLI：

```bash
cargo install tauri-cli --version "^2.0.0"
```

启动应用：

```bash
cd ~/programming/Oasis
cargo tauri dev
```

Tauri 配置会通过 `beforeDevCommand` 自动启动 Vite 开发服务器。

### WSLg 渲染兼容处理

在 WSL2 + WSLg 环境中，WebKitGTK 有时会出现白屏窗口或 EGL/Mesa 警告，例如：

```text
libEGL warning: failed to get driver name for fd -1
MESA: error: ZINK: failed to choose pdev
```

如果遇到这种情况，可以使用软件渲染方式启动：

```bash
cd ~/programming/Oasis

WEBKIT_DISABLE_DMABUF_RENDERER=1 \
WEBKIT_DISABLE_COMPOSITING_MODE=1 \
LIBGL_ALWAYS_SOFTWARE=1 \
GSK_RENDERER=cairo \
cargo tauri dev
```

这个处理主要针对 WSLg。原生 Linux 桌面环境下通常直接运行 `cargo tauri dev` 即可。

## 生产构建

```bash
cd ~/programming/Oasis
cargo tauri build
```

构建产物位于：

```text
src-tauri/target/release/bundle/
```

根据目标系统和 Tauri 配置，Linux 构建可能产出 AppImage、deb 或 rpm 包。

## 项目结构

```text
oasis-linux/
|-- src-tauri/                    # Rust backend
|   |-- src/
|   |   |-- main.rs               # Tauri entry point
|   |   |-- lib.rs                # Module declarations and command registration
|   |   |-- state.rs              # AppState
|   |   |-- error.rs              # Unified AppError type
|   |   |-- db/                   # Database layer
|   |   |-- feed/                 # Feed sync, OPML, bootstrap, sidebar counts
|   |   |-- reader/               # Readability, markdown, renderer, theme
|   |   |-- agent/                # LLM providers, runtime, summary, translation, tagging
|   |   |-- digest/               # Notes and digest export
|   |   |-- tags/                 # Tag normalization and suggestion
|   |   |-- usage/                # Token usage tracking and reports
|   |   |-- tasking/              # Task queue and job runner
|   |   |-- resources/            # Embedded prompt/template loaders
|   |   `-- commands/             # Tauri IPC command handlers
|   |-- migrations/               # SQL migration scripts
|   |-- icons/                    # Application icons
|   `-- capabilities/             # Tauri 2 permission manifests
|-- src/                          # React frontend
|   |-- App.tsx                   # Root three-column layout
|   |-- components/ui/            # Base UI primitives
|   |-- features/                 # Feature modules
|   |-- stores/                   # Zustand stores
|   |-- hooks/                    # Custom hooks
|   `-- lib/                      # IPC wrappers, types, formatters
|-- resources/                    # YAML prompt and digest templates
`-- docs/                         # Architecture plans and phase summaries
```

## 配置

### LLM Provider 设置

1. 打开 Settings -> Agents -> Providers。
2. 添加一个 OpenAI 兼容 Provider。
3. 在 Models 页面添加至少一个模型。
4. 在 Agents 页面为 Summary、Translation 和 Tagging 分配模型。

默认本地开发配置为：

```text
baseURL: http://localhost:5810/v1
apiKey: local
model: qwen3
thinkingModel: qwen3-thinking
```

### 凭据存储

API Key 通过 Rust `keyring` crate 写入操作系统凭据存储。

在 Linux 上，这通常意味着通过 Secret Service 使用 GNOME Keyring、KWallet 或其他兼容实现。在极简桌面环境或 WSL 中，可能需要额外安装并启动 Secret Service Provider，托管式 API Key 存储才能正常工作。

### Prompt 自定义

内置 Prompt 模板会在编辑前复制到用户数据目录。Linux 下用户自定义 Prompt 存储位置为：

```text
~/.local/share/Oasis/prompts/
```

可在 Settings -> Agents -> Reload Prompts 中热重载模板，无需重启应用。

## 数据库

Oasis 使用本地 SQLite 数据库。Linux 下默认数据库位置为：

```text
~/.local/share/Oasis/oasis.db
```

数据库结构遵循 Mercury macOS 的数据模型。详见 `docs/ARCHITECTURE.md`。

## Linux 开发注意事项

- 使用 `cargo tauri dev` 从仓库根目录启动开发模式。
- 使用 `npm run build` 验证 React/Vite 前端。
- 在 `src-tauri/` 目录下使用 `cargo check` 验证 Rust 后端。
- 生成文件不要提交到 git：`node_modules/`、`dist/`、`src-tauri/target/` 均已忽略。
- 在 WSL 中开发时，仓库应放在 `/home/<user>/...` 下，而不是 `/mnt/c/...` 下。

## 许可证

MIT License。原项目灵感来源见 [Mercury for macOS](https://github.com/neolee/mercury)。

## 致谢

- 原版 macOS Mercury 作者：[Neo Lee](https://github.com/neolee)
- Windows 移植：[Seven-Ljy77](https://github.com/Seven-Ljy77)、[Yuanyyy11](https://github.com/Yuanyyy11)、[RicardoMin](https://github.com/RicardoMin)
- Linux 移植基于 Windows 版本，适配 WebKitGTK 与 Secret Service
