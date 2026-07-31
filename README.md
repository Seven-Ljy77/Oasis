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

---

# Oasis -- Mercury Windows 版

一款本地优先的 RSS 阅读器，集成 AI 智能体能力，基于 **Tauri 2 + Rust + React/TypeScript + WebView2** 构建。

灵感来源于 [macOS 版 Mercury](https://github.com/neolee/mercury)——相同数据库结构，相同产品理念，原生 Windows 体验。

---

## 功能特性

### 订阅源管理
- 支持 RSS 2.0、Atom、JSON Feed 三种格式
- OPML 导入/导出，并发处理，实时进度显示
- 多源同步，可配置并发数（2-10，默认 6）
- 重复检测、URL 标准化、HTTPS 强制
- 首次启动自动导入内置示例订阅源

### 阅读体验
- 三栏布局（订阅源 | 文章列表 | 阅读区），可拖拽调整宽度
- 三种阅读模式：**Reader**（清洗后内容）、**Web**（原始网页）、**Dual**（左右对照）
- Mozilla Readability.js 集成（QuickJS 嵌入）进行内容提取
- 四阶段管线：源 HTML → Readability 清洗 → Markdown 转换 → 渲染 HTML
- 5 级缓存体系，各层独立版本化
- 主题系统：Classic / Paper 预设，Light / Dark / Eye Care 模式，Quick Style（Warm / Cool / Slate）
- 可自定义字体、字号、行高、内容宽度
- 键盘快捷键：J/K 导航、M 已读切换、S 收藏、V 浏览器打开、Ctrl+F 搜索

### AI 智能体
- **摘要**：流式 AI 生成文章摘要，12 种语言，3 级详细程度（简短/中等/详细），自动摘要模式
- **翻译**：分段并发翻译，双语对照显示，content-hash 缓存，断点续传
- **标签**：AI 标签推荐，词汇注入，单篇及批量模式
- 划词翻译：选中文字即可翻译
- 每智能体可自定义提示词模板，支持热刷新
- LLM 提供商管理：兼容 OpenAI API，Windows Credential Manager 存储 API Key
- 用量统计图表（Token 消耗、成功率、提供商/模型明细）

### 搜索
- 模态搜索窗口，背景虚化
- 三分类结果：文章内容、标签、笔记
- 键盘导航（方向键 + Enter），200ms 防抖

### 笔记与文摘
- 每篇文章可写 Markdown 笔记，5 秒自动保存
- 单篇/多篇文摘导出为 Markdown 文件
- 四种导出模板：Default、Minimal、Academic、Newsletter
- 剪贴板分享、浏览器打开原文

### 标签系统
- 扁平标签模型，标准化规则（去空格 → 小写 → 压缩分隔符）
- 三级去重：标准化 → 精确匹配 → 别名解析
- 标签库管理：重命名、合并、别名、删除未使用
- 侧栏标签筛选，Any/All 匹配模式
- AI 创建的标签初始为临时标签，usage_count >= 2 自动提升

### 多选与批量导出
- 多选模式，checkbox 勾选
- 批量导出：导出文摘（摘要+笔记）和导出原文（原始 Markdown）
- Esc 退出多选，折叠栏任意位置点击展开

### UI 与交互
- 双语界面：英文 / 简体中文，运行时切换无需重启
- Dark Mode（应用外壳 + 阅读器内容）
- 布局持久化：列宽和面板高度通过 localStorage 记忆，跨会话保持
- 侧栏和文章列表可折叠，展开时恢复上次宽度
- 文章列表内置搜索按钮

---

## 技术栈

| 层面 | 技术 |
|------|------|
| 桌面框架 | Tauri 2.x |
| 后端 | Rust (Edition 2024) + tokio |
| 数据库 | SQLite via rusqlite（bundled，WAL 模式）|
| 前端 | React 19 + TypeScript |
| 样式 | Tailwind CSS 3 |
| 状态管理 | Zustand |
| 阅读器渲染 | WebView2 (Tauri webview) |
| 内容提取 | Mozilla Readability.js via QuickJS |
| Markdown → HTML | comrak（GFM：表格、删除线、任务列表、自动链接）|
| HTML → Markdown | 自研 Rust 转换器（scraper crate）|
| Feed 解析 | feed-rs（RSS/Atom/JSON Feed）|
| LLM 客户端 | reqwest + SSE 流式解析 |
| 模板引擎 | Tera |
| 图表 | Recharts |
| 凭据存储 | Windows Credential Manager |
| 自动更新 | Tauri updater |

---

## 快速开始

### 环境要求

- [Rust](https://www.rust-lang.org/)（Edition 2024）
- [Node.js](https://nodejs.org/) 18+
- [Microsoft Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- [WebView2 Runtime](https://developer.microsoft.com/zh-cn/microsoft-edge/webview2/)（Windows 11 已预装）

### 开发模式

```bash
# 克隆仓库
git clone https://github.com/Seven-Ljy77/Oasis.git
cd Oasis
git checkout windows

# 安装前端依赖
npm install

# 启动开发模式（热重载）
cd src-tauri
cargo tauri dev
```

### 构建

```bash
cargo tauri build
# 输出：src-tauri/target/release/bundle/
```

---

## 项目结构

```
oasis-windows/
├── src-tauri/                    # Rust 后端
│   ├── src/
│   │   ├── main.rs               # 入口
│   │   ├── lib.rs                # 模块声明，命令注册
│   │   ├── state.rs              # AppState
│   │   ├── error.rs              # 统一 AppError 类型
│   │   ├── db/                   # 数据库层（16 个 Store + 查询构建器）
│   │   ├── feed/                 # 订阅源同步、OPML、引导、侧栏计数
│   │   ├── reader/               # Readability 桥接、Markdown 转换/渲染、主题
│   │   ├── agent/                # LLM 提供商、路由解析、提示词模板
│   │   │   ├── summary/          # 摘要执行器 + 存储
│   │   │   ├── translation/      # 翻译执行器 + 分段 + 双语
│   │   │   └── tagging/          # 标签执行器 + 批量
│   │   ├── digest/               # 笔记 + 文摘导出 + 模板
│   │   ├── tags/                 # 标签标准化 + 建议
│   │   ├── usage/                # Token 追踪 + 报表
│   │   ├── tasking/              # 任务队列 + 作业运行器
│   │   ├── resources/            # 内置提示词/模板加载器
│   │   └── commands/             # Tauri IPC 处理器（9 个命令文件）
│   ├── migrations/               # SQL 迁移脚本（001-018）
│   ├── icons/                    # 应用图标（16 种尺寸）
│   └── capabilities/             # Tauri 2 权限清单
├── src/                          # React 前端
│   ├── App.tsx                   # 根三栏布局组件
│   ├── components/ui/            # 基础 UI 组件（Button, Dialog, Sheet 等）
│   ├── features/                 # 功能模块
│   │   ├── sidebar/              # 订阅源列表 + 标签筛选
│   │   ├── entry-list/           # 文章列表 + 搜索模态框 + 多选
│   │   ├── reader/               # 阅读器视图 + 面板（摘要/翻译/标签/笔记）
│   │   ├── settings/             # 设置（通用/阅读器/智能体/文摘/日志）
│   │   ├── tags/                 # 标签库管理
│   │   ├── digest/               # 分享/导出文摘
│   │   └── usage/                # 用量统计图表
│   ├── stores/                   # 9 个 Zustand Store
│   ├── hooks/                    # 自定义 Hook（可拖拽、防抖、键盘等）
│   └── lib/                      # IPC 封装、类型定义、格式化、常量
├── resources/                    # YAML 模板文件
│   ├── prompts/                  # AI 智能体提示词模板
│   └── templates/                # 文摘导出模板
└── docs/                         # 架构方案 + 阶段总结
```

---

## 配置指南

### LLM 提供商设置

1. 打开 设置 → 智能体 → 提供商
2. 点击"添加提供商"并填写：
   - 名称：任意显示名称
   - Base URL：OpenAI 兼容 API 端点（如 Ollama：`http://localhost:11434/v1`）
   - API Key：提供商的 API 密钥
3. 切换到模型页签，添加至少一个模型
4. 切换到智能体页签，为摘要/翻译/标签分配主模型

### 本地开发默认配置

项目预配置为本地 LLM 使用：

- `baseURL`：`http://localhost:5810/v1`
- `apiKey`：`local`
- `model`：`qwen3`
- `thinkingModel`：`qwen3-thinking`

### 提示词自定义

在 设置 → 智能体 中点击"自定义提示词"按钮编辑提示词模板。文件存储在 `%LOCALAPPDATA%/Oasis/prompts/` 目录。编辑后点击"重新加载提示词"即可生效，无需重启。

---

## 数据库

SQLite 数据库结构与 macOS Mercury 保持一致以确保兼容性。完整 DDL 见 `docs/ARCHITECTURE.md` 第三节。

数据库位置：`%LOCALAPPDATA%/Oasis/oasis.db`

---

## 开发阶段

| 阶段 | 状态 | 范围 |
|------|------|------|
| 0-1 | 已完成 | 项目框架搭建，核心阅读 MVP |
| 2-4 | 已完成 | AI 智能体、笔记/文摘、标签系统 |
| 5-7 | 已完成 | 打磨：用量报表、主题系统、i18n、Dark Mode、Readability.js |
| 8 | 已完成 | 搜索重构、多选导出、划词翻译、面板持久化、提示词自定义 |
| 9 | 已完成 | 图标生成、i18n 补全、错误友好化、UI 清理、文档完善 |

---

## 许可证

MIT License — 原始项目见 [macOS Mercury](https://github.com/neolee/mercury)。

---

## 致谢

- 原版 macOS Mercury 作者：[Neo Lee](https://github.com/neolee)
- Windows 移植：[Seven-Ljy77](https://github.com/Seven-Ljy77)
