# Mercury Windows — 项目架构方案

## Context

将 macOS 原生 RSS 阅读器 Mercury（SwiftUI + GRDB + WKWebView）移植到 Windows 平台。
选定技术栈：**Tauri 2 + Rust 后端 + React/TypeScript 前端 + WebView2**。
目标：保持 macOS 版的核心产品价值（本地优先、轻量、AI 智能体），使用适合 Windows 的技术栈重写。

---

## 一、技术栈总览

| 层面 | 技术 | 说明 |
|------|------|------|
| 桌面框架 | Tauri 2.x | 系统 WebView2 复用，~15MB 包体 |
| 后端语言 | Rust (Edition 2024) | 编译为原生 Windows 二进制 |
| 异步运行时 | tokio | Rust 异步标准 |
| 数据库 | SQLite (rusqlite + WAL) | 与 macOS 版相同数据库格式 |
| 前端 UI | React 19 + TypeScript | 声明式 UI，对标 SwiftUI |
| 样式 | Tailwind CSS 4 | 主题令牌映射到 CSS 变量 |
| 状态管理 | Zustand | 轻量，接近 @Observable 模式 |
| 前端路由 | 无（桌面应用，组件状态驱动） | 与 macOS 版一致 |
| 阅读器渲染 | WebView2 (Tauri WebView) | 对标 WKWebView |
| 文章清洗 | Mozilla Readability.js | 在 WebView 中执行 |
| Markdown→HTML | 自研 Rust 渲染器 (comrak + 增强) | 对标 MarkupHTMLVisitor |
| HTML→Markdown | 自研 Rust 转换器 (scraper) | 对标 MarkdownConverter |
| Feed 解析 | feed-rs crate | RSS/Atom/JSON Feed |
| LLM 客户端 | reqwest + SSE 流式解析 | OpenAI 兼容 API |
| 模板引擎 | Tera | 对标 Mustache 模板系统 |
| 图表 | Recharts | 用量统计报告 |
| 凭据存储 | Windows Credential Manager | 对标 macOS Keychain |
| 自动更新 | Tauri updater | 对标 Sparkle |
| 测试 | Rust: cargo test / TS: Vitest | |

---

## 二、项目目录结构

```
oasis-windows/
├── src-tauri/                          # Rust 后端
│   ├── Cargo.toml
│   ├── tauri.conf.json                 # Tauri 配置（窗口、更新、权限）
│   ├── capabilities/                   # Tauri 2 权限声明
│   ├── icons/                          # 应用图标
│   ├── migrations/                     # SQL 迁移脚本
│   │   ├── 001_create_feed.sql
│   │   ├── 002_create_entry.sql
│   │   ├── 003_create_content.sql
│   │   ├── 004_create_content_html_cache.sql
│   │   ├── 005_create_tag_tables.sql
│   │   ├── 006_create_entry_note.sql
│   │   ├── 007_create_agent_provider.sql
│   │   ├── 008_create_agent_model.sql
│   │   ├── 009_create_agent_profile.sql
│   │   ├── 010_create_agent_task_run.sql
│   │   ├── 011_create_llm_usage_event.sql
│   │   ├── 012_create_summary_result.sql
│   │   ├── 013_create_translation_tables.sql
│   │   ├── 014_create_tag_batch_tables.sql
│   │   └── ...
│   └── src/
│       ├── main.rs                     # Tauri 入口，注册命令
│       ├── lib.rs                      # 模块声明
│       ├── state.rs                    # 应用全局状态 (AppState)
│       ├── error.rs                    # 统一错误类型
│       │
│       ├── db/                         # 数据库层
│       │   ├── mod.rs
│       │   ├── manager.rs              # DatabaseManager (连接池、WAL)
│       │   ├── migrations.rs           # 迁移执行器
│       │   ├── models.rs               # 数据模型 struct
│       │   ├── feed_store.rs           # Feed CRUD
│       │   ├── entry_store.rs          # Entry 查询/分页/标记
│       │   ├── content_store.rs        # Content 读写
│       │   ├── entry_note_store.rs     # 笔记存储
│       │   ├── tag_store.rs            # Tag/TagAlias/EntryTag
│       │   ├── tag_library_store.rs    # 标签库管理
│       │   ├── tag_batch_store.rs      # 批量打标签
│       │   ├── agent_provider_store.rs # 提供商配置
│       │   ├── agent_model_store.rs    # 模型配置
│       │   ├── agent_profile_store.rs  # Agent 路由配置
│       │   ├── agent_task_run_store.rs # Agent 任务记录
│       │   ├── llm_usage_store.rs      # Token 用量
│       │   ├── summary_store.rs        # 摘要结果
│       │   ├── translation_store.rs    # 翻译结果
│       │   └── query_builder.rs        # Entry 查询构建器
│       │
│       ├── feed/                       # 订阅源管理
│       │   ├── mod.rs
│       │   ├── sync_service.rs         # 同步引擎
│       │   ├── feed_parser.rs          # feed-rs 封装
│       │   ├── opml_import.rs          # OPML 导入
│       │   ├── opml_export.rs          # OPML 导出
│       │   ├── feed_validator.rs       # URL 验证
│       │   ├── title_resolver.rs       # 标题解析
│       │   ├── bootstrap.rs            # 首次启动引导
│       │   └── sidebar_counts.rs       # 侧栏计数
│       │
│       ├── reader/                     # 阅读管线
│       │   ├── mod.rs
│       │   ├── pipeline.rs             # 管线编排
│       │   ├── readability.rs          # Readability.js 调用桥
│       │   ├── markdown_converter.rs   # HTML → Markdown
│       │   ├── markdown_renderer.rs    # Markdown → Reader HTML
│       │   ├── html_patcher.rs         # 增量 DOM 更新
│       │   ├── theme.rs               # 主题令牌与 CSS 生成
│       │   └── navigation_policy.rs   # WebView URL 导航
│       │
│       ├── agent/                      # AI 智能体
│       │   ├── mod.rs
│       │   ├── runtime.rs              # 运行时状态机
│       │   ├── provider.rs             # LLM 提供商客户端
│       │   ├── route.rs               # 模型路由选择
│       │   ├── prompt_template.rs      # Prompt 模板引擎
│       │   ├── failure.rs             # 错误分类与重试
│       │   ├── summary/               # 摘要智能体
│       │   │   ├── mod.rs
│       │   │   ├── executor.rs
│       │   │   └── storage.rs
│       │   ├── translation/           # 翻译智能体
│       │   │   ├── mod.rs
│       │   │   ├── executor.rs
│       │   │   ├── segment.rs          # 段落提取
│       │   │   ├── bilingual.rs        # 双语合成
│       │   │   └── storage.rs
│       │   └── tagging/               # 标签智能体
│       │       ├── mod.rs
│       │       ├── executor.rs         # 单篇标签
│       │       └── batch.rs           # 批量打标签
│       │
│       ├── digest/                     # 笔记与文摘
│       │   ├── mod.rs
│       │   ├── note_controller.rs      # 笔记生命周期
│       │   ├── composition.rs          # 文摘合成
│       │   ├── export.rs              # 导出文件
│       │   └── template.rs            # 文摘模板
│       │
│       ├── tags/                       # 标签系统
│       │   ├── mod.rs
│       │   ├── normalization.rs        # 标签标准化
│       │   ├── suggestion.rs           # 输入建议
│       │   └── local_service.rs        # 本地实体提取
│       │
│       ├── usage/                      # 用量统计
│       │   ├── mod.rs
│       │   ├── tracker.rs             # Token 事件记录
│       │   ├── retention.rs           # 数据保留策略
│       │   └── reports.rs             # 报表查询
│       │
│       ├── tasking/                    # 任务系统
│       │   ├── mod.rs
│       │   ├── task_queue.rs           # 优先级任务队列
│       │   ├── job_runner.rs           # 超时任务执行器
│       │   └── failure_policy.rs       # 失败处理策略
│       │
│       ├── resources/                  # 内嵌资源
│       │   ├── prompts.rs             # Prompt 模板管理
│       │   └── templates.rs           # Digest 模板管理
│       │
│       └── commands/                   # Tauri IPC 命令
│           ├── mod.rs
│           ├── feed_commands.rs        # 订阅源相关命令
│           ├── entry_commands.rs       # 文章相关命令
│           ├── reader_commands.rs      # 阅读器相关命令
│           ├── agent_commands.rs       # AI Agent 命令
│           ├── tag_commands.rs         # 标签命令
│           ├── digest_commands.rs      # 笔记与文摘命令
│           ├── usage_commands.rs       # 用量统计命令
│           ├── settings_commands.rs    # 设置命令
│           └── window_commands.rs      # 窗口/文件对话框
│
├── src/                                # React 前端
│   ├── main.tsx                        # 入口
│   ├── App.tsx                         # 根组件（三栏布局）
│   ├── styles/
│   │   ├── index.css                   # Tailwind + 全局样式
│   │   └── reader-theme.css            # 阅读器主题 CSS 变量
│   │
│   ├── components/                     # 通用组件
│   │   ├── ui/                         # 基础 UI 组件
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Slider.tsx
│   │   │   ├── Toggle.tsx
│   │   │   ├── Dialog.tsx
│   │   │   ├── Sheet.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Chip.tsx
│   │   │   ├── ContextMenu.tsx
│   │   │   └── Tooltip.tsx
│   │   ├── SplitPane.tsx               # 可拖拽分隔面板
│   │   ├── StatusBar.tsx               # 状态栏
│   │   └── SearchField.tsx             # 搜索框
│   │
│   ├── features/                       # 功能模块
│   │   ├── sidebar/                    # 侧栏
│   │   │   ├── SidebarView.tsx
│   │   │   ├── FeedList.tsx
│   │   │   ├── TagFilter.tsx
│   │   │   ├── FeedEditorSheet.tsx
│   │   │   └── ImportOPMLSheet.tsx
│   │   │
│   │   ├── entry-list/                 # 文章列表
│   │   │   ├── EntryListView.tsx
│   │   │   ├── EntryRow.tsx
│   │   │   └── MultiSelectToolbar.tsx
│   │   │
│   │   ├── reader/                     # 阅读器
│   │   │   ├── ReaderDetailView.tsx
│   │   │   ├── ReaderToolbar.tsx
│   │   │   ├── ReaderWebView.tsx       # WebView 封装
│   │   │   ├── ReaderThemePanel.tsx
│   │   │   ├── ReaderSummaryPanel.tsx
│   │   │   ├── ReaderTranslationPanel.tsx
│   │   │   ├── ReaderTaggingPanel.tsx
│   │   │   ├── ReaderNotePanel.tsx
│   │   │   └── ReadingModePicker.tsx
│   │   │
│   │   ├── settings/                   # 设置
│   │   │   ├── AppSettingsView.tsx
│   │   │   ├── GeneralSettings.tsx
│   │   │   ├── ReaderSettings.tsx
│   │   │   ├── AgentSettings/          # 智能体设置
│   │   │   │   ├── AgentSettingsView.tsx
│   │   │   │   ├── ProviderTab.tsx
│   │   │   │   ├── ModelTab.tsx
│   │   │   │   ├── AgentTab.tsx
│   │   │   │   ├── SummaryAgentConfig.tsx
│   │   │   │   ├── TranslationAgentConfig.tsx
│   │   │   │   └── TaggingAgentConfig.tsx
│   │   │   └── DigestSettings.tsx
│   │   │
│   │   ├── tags/                       # 标签管理
│   │   │   ├── TagLibrarySheet.tsx
│   │   │   ├── TagRenameSheet.tsx
│   │   │   └── BatchTaggingSheet.tsx
│   │   │
│   │   ├── digest/                     # 文摘
│   │   │   ├── ShareDigestSheet.tsx
│   │   │   ├── ExportDigestSheet.tsx
│   │   │   └── ExportMultipleDigestSheet.tsx
│   │   │
│   │   └── usage/                      # 用量统计
│   │       ├── UsageReportView.tsx
│   │       ├── ProviderReport.tsx
│   │       ├── ModelReport.tsx
│   │       └── AgentReport.tsx
│   │
│   ├── stores/                         # Zustand 状态管理
│   │   ├── useAppStore.ts              # 全局状态
│   │   ├── useFeedStore.ts             # 订阅源状态
│   │   ├── useEntryStore.ts            # 文章列表状态
│   │   ├── useReaderStore.ts           # 阅读器状态
│   │   ├── useSettingsStore.ts         # 设置状态
│   │   ├── useTagStore.ts              # 标签状态
│   │   └── useAgentStore.ts            # Agent 状态
│   │
│   ├── hooks/                          # 自定义 Hooks
│   │   ├── useTauriCommand.ts          # IPC 命令封装
│   │   ├── useTauriEvent.ts            # 后端事件监听
│   │   ├── useAutoSave.ts              # 自动保存 (笔记)
│   │   ├── useDebounce.ts              # 防抖 (搜索)
│   │   └── useKeyboardShortcut.ts      # 键盘快捷键
│   │
│   └── lib/                            # 工具函数
│       ├── ipc.ts                      # Tauri invoke 类型封装
│       ├── types.ts                    # 共享类型定义
│       ├── format.ts                   # 日期/数字格式化
│       └── constants.ts                # 常量
│
├── resources/                          # 内嵌资源文件
│   ├── prompts/                        # AI Agent Prompt 模板
│   │   ├── summary.default.yaml
│   │   ├── translation.default.yaml
│   │   ├── translation.hy-mt.yaml
│   │   └── tagging.default.yaml
│   └── templates/                      # Digest 文摘模板
│       ├── single-text.yaml
│       ├── single-markdown.yaml
│       └── multiple-markdown.yaml
│
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
└── README.md
```

---

## 三、数据库 Schema

与 macOS 版保持相同表结构，确保未来可互通。

### 核心表

```sql
-- 订阅源
CREATE TABLE feed (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    feed_url TEXT NOT NULL UNIQUE,
    site_url TEXT,
    feed_parser_version INTEGER,
    last_fetched_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 文章
CREATE TABLE entry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    feed_id INTEGER NOT NULL REFERENCES feed(id) ON DELETE CASCADE,
    guid TEXT,
    url TEXT,
    title TEXT,
    author TEXT,
    published_at TEXT,
    summary TEXT,
    is_read INTEGER NOT NULL DEFAULT 0,
    is_starred INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_entry_feed_guid ON entry(feed_id, guid);
CREATE UNIQUE INDEX idx_entry_feed_url ON entry(feed_id, url);

-- 文章内容 (Reader 管线)
CREATE TABLE content (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id INTEGER NOT NULL UNIQUE REFERENCES entry(id) ON DELETE CASCADE,
    html TEXT,                          -- 源 HTML
    cleaned_html TEXT,                  -- Readability 清洗后 HTML
    readability_title TEXT,
    readability_byline TEXT,
    readability_version INTEGER,
    markdown TEXT,                      -- 规范化 Markdown
    markdown_version INTEGER,
    display_mode TEXT NOT NULL DEFAULT 'cleaned',
    document_base_url TEXT,
    pipeline_type TEXT NOT NULL DEFAULT 'default',
    resolved_intermediate_content TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 渲染 HTML 缓存 (按主题)
CREATE TABLE content_html_cache (
    entry_id INTEGER NOT NULL REFERENCES entry(id) ON DELETE CASCADE,
    theme_id TEXT NOT NULL,
    html TEXT NOT NULL,
    reader_render_version INTEGER,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (entry_id, theme_id)
);

-- 笔记
CREATE TABLE entry_note (
    entry_id INTEGER PRIMARY KEY REFERENCES entry(id) ON DELETE CASCADE,
    markdown_text TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 标签系统

```sql
CREATE TABLE tag (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    normalized_name TEXT NOT NULL UNIQUE,
    is_provisional INTEGER NOT NULL DEFAULT 1,
    usage_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE tag_alias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tag_id INTEGER NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
    alias TEXT NOT NULL,
    normalized_alias TEXT NOT NULL UNIQUE
);

CREATE TABLE entry_tag (
    entry_id INTEGER NOT NULL REFERENCES entry(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
    source TEXT NOT NULL,               -- 'manual' | 'nltagger' | 'ai' | 'ai_batch'
    confidence REAL,
    PRIMARY KEY (entry_id, tag_id)
);
```

### Agent 与 LLM 配置

```sql
CREATE TABLE agent_provider_profile (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    base_url TEXT NOT NULL,
    api_key_ref TEXT NOT NULL,          -- Windows Credential Manager 引用
    test_model TEXT,
    is_default INTEGER NOT NULL DEFAULT 0,
    is_enabled INTEGER NOT NULL DEFAULT 1,
    is_archived INTEGER NOT NULL DEFAULT 0,
    archived_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE agent_model_profile (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_profile_id INTEGER NOT NULL REFERENCES agent_provider_profile(id),
    model_name TEXT NOT NULL,
    temperature REAL,
    top_p REAL,
    max_tokens INTEGER,
    is_streaming INTEGER NOT NULL DEFAULT 1,
    supports_summary INTEGER NOT NULL DEFAULT 1,
    supports_translation INTEGER NOT NULL DEFAULT 1,
    supports_tagging INTEGER NOT NULL DEFAULT 1,
    is_default INTEGER NOT NULL DEFAULT 0,
    is_enabled INTEGER NOT NULL DEFAULT 1,
    is_archived INTEGER NOT NULL DEFAULT 0,
    archived_at TEXT,
    last_tested_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE agent_profile (
    agent_type TEXT NOT NULL UNIQUE,     -- 'summary' | 'translation' | 'tagging'
    primary_model_profile_id INTEGER REFERENCES agent_model_profile(id),
    fallback_model_profile_id INTEGER REFERENCES agent_model_profile(id)
);

CREATE TABLE agent_task_run (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_id INTEGER REFERENCES entry(id),
    task_type TEXT NOT NULL,
    status TEXT NOT NULL,
    request_source TEXT,
    duration_ms INTEGER,
    prompt_version TEXT,
    template_id TEXT,
    route_model_name TEXT,
    route_provider_name TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE llm_usage_event (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_run_id INTEGER REFERENCES agent_task_run(id),
    provider_name TEXT NOT NULL,
    provider_base_url TEXT NOT NULL,
    model_name TEXT NOT NULL,
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    request_phase TEXT NOT NULL,         -- 'primary' | 'fallback' | 'retry'
    request_status TEXT NOT NULL,        -- 'success' | 'failed' | 'cancelled' | 'timed_out'
    endpoint_url TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 摘要与翻译

```sql
CREATE TABLE summary_result (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_run_id INTEGER NOT NULL REFERENCES agent_task_run(id) ON DELETE CASCADE,
    entry_id INTEGER NOT NULL REFERENCES entry(id) ON DELETE CASCADE,
    target_language TEXT NOT NULL,
    detail_level TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(entry_id, target_language, detail_level)
);

CREATE TABLE translation_result (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_run_id INTEGER REFERENCES agent_task_run(id),
    entry_id INTEGER NOT NULL REFERENCES entry(id) ON DELETE CASCADE,
    target_language TEXT NOT NULL,
    source_content_hash TEXT NOT NULL,
    segmenter_version TEXT NOT NULL,
    run_status TEXT NOT NULL DEFAULT 'succeeded',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE translation_segment (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    translation_result_id INTEGER NOT NULL REFERENCES translation_result(id) ON DELETE CASCADE,
    segment_id TEXT NOT NULL,
    source_text TEXT NOT NULL,
    translated_text TEXT NOT NULL,
    order_index INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'completed'
);
```

### 批量打标签

```sql
CREATE TABLE tag_batch_run (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status TEXT NOT NULL,
    scope_label TEXT,
    concurrency INTEGER NOT NULL DEFAULT 3,
    skip_already_applied INTEGER NOT NULL DEFAULT 1,
    skip_already_tagged INTEGER NOT NULL DEFAULT 0,
    total_entries INTEGER NOT NULL DEFAULT 0,
    processed_count INTEGER NOT NULL DEFAULT 0,
    succeeded_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    kept_count INTEGER NOT NULL DEFAULT 0,
    discarded_count INTEGER NOT NULL DEFAULT 0,
    inserted_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE tag_batch_entry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL REFERENCES tag_batch_run(id) ON DELETE CASCADE,
    entry_id INTEGER NOT NULL REFERENCES entry(id),
    lifecycle_state TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE tag_batch_assignment_staging (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL REFERENCES tag_batch_run(id) ON DELETE CASCADE,
    entry_id INTEGER NOT NULL REFERENCES entry(id),
    normalized_name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    resolved_tag_id INTEGER REFERENCES tag(id),
    assignment_kind TEXT NOT NULL        -- 'matched' | 'new_proposal'
);

CREATE TABLE tag_batch_new_tag_review (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL REFERENCES tag_batch_run(id) ON DELETE CASCADE,
    normalized_name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    hit_count INTEGER NOT NULL DEFAULT 0,
    sample_entry_count INTEGER NOT NULL DEFAULT 0,
    decision TEXT NOT NULL DEFAULT 'pending'  -- 'pending' | 'keep' | 'discard'
);
```

---

## 四、Rust 后端架构

### 4.1 AppState（全局状态）

```rust
// 对标 macOS AppModel，Tauri 中作为 Managed State
pub struct AppState {
    pub db: DatabaseManager,
    pub task_queue: TaskQueue,
    pub agent_runtime: AgentRuntimeEngine,
    pub feed_store: Arc<RwLock<Vec<Feed>>>,
    pub config: Arc<RwLock<AppConfig>>,
    // ...
}
```

### 4.2 核心 Crate 依赖

```toml
[dependencies]
tauri = { version = "2", features = ["tray-icon", "shell-open"] }
tauri-plugin-dialog = "2"        # 文件对话框
tauri-plugin-updater = "2"       # 自动更新
tauri-plugin-shell = "2"         # 打开浏览器

rusqlite = { version = "0.32", features = ["bundled"] }  # SQLite (bundled 无外部依赖)
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
reqwest = { version = "0.12", features = ["stream", "rustls-tls"] }
feed-rs = "2"                    # Feed 解析
scraper = "0.21"                 # HTML DOM 操作
comrak = "0.29"                  # Markdown → HTML (GFM)
tera = "1"                       # 模板引擎
sha2 = "0.10"                    # SHA-256 (段落哈希)
quick-xml = "0.37"               # OPML 解析/生成
chrono = "0.4"                   # 日期时间
regex = "1"                      # 正则
uuid = "1"                       # ID 生成
thiserror = "2"                  # 错误派生
```

### 4.3 命令 API（IPC 接口）

Tauri 命令 = macOS 版 AppModel 方法的对等物，前端通过 `invoke()` 调用。

```rust
// === Feed 命令 ===
#[tauri::command] async fn add_feed(url: String, title: Option<String>) -> Result<Feed, Error>
#[tauri::command] async fn update_feed(id: i64, url: String, title: Option<String>) -> Result<Feed, Error>
#[tauri::command] async fn delete_feed(id: i64) -> Result<(), Error>
#[tauri::command] async fn sync_feeds(concurrency: u32) -> Result<SyncProgress, Error>
#[tauri::command] async fn import_opml(path: String, replace: bool, force_site_name: bool) -> Result<ImportResult, Error>
#[tauri::command] async fn export_opml(path: String) -> Result<(), Error>

// === Entry 命令 ===
#[tauri::command] async fn load_entries(query: EntryListQuery) -> Result<EntryPage, Error>
#[tauri::command] async fn load_next_entries(cursor: PageCursor) -> Result<EntryPage, Error>
#[tauri::command] async fn mark_read(entry_ids: Vec<i64>, is_read: bool) -> Result<(), Error>
#[tauri::command] async fn mark_starred(entry_id: i64, is_starred: bool) -> Result<(), Error>
#[tauri::command] async fn delete_entry(entry_id: i64) -> Result<(), Error>
#[tauri::command] async fn search_entries(text: String, scope: SearchScope) -> Result<Vec<EntryListItem>, Error>

// === Reader 命令 ===
#[tauri::command] async fn build_reader_html(entry_id: i64, theme: ThemeTokens) -> Result<ReaderHTML, Error>
#[tauri::command] async fn get_available_fonts() -> Result<Vec<String>, Error>

// === Agent 命令 ===
#[tauri::command] async fn start_summary(entry_id: i64, language: String, detail: String) -> Result<(), Error>
#[tauri::command] async fn start_translation(entry_id: i64, language: String) -> Result<(), Error>
#[tauri::command] async fn start_tagging_panel(entry_id: i64) -> Result<Vec<TagSuggestion>, Error>
#[tauri::command] async fn cancel_agent(entry_id: i64, task_kind: String) -> Result<(), Error>

// === 流式事件 (后端 → 前端推送) ===
// 摘要 token:  emit("summary-token", { entry_id, token, is_complete })
// 翻译段完成: emit("translation-segment", { entry_id, segment_id, text })
// 同步进度:   emit("sync-progress", { feed_id, progress, status })
// Agent 状态: emit("agent-state-change", { entry_id, phase, status_text })
```

### 4.4 Agent 运行时状态机

从 macOS 版直接移植状态机设计：

```
Idle → Waiting → Requesting → Generating → Persisting → Completed
                                                      → Failed
                                                      → TimedOut
                                                      → Cancelled
```

并发策略：
- Summary: 活跃 1 + 等待 1（latest-only 替换）
- Translation: 活跃 1 + 等待 1
- Tagging: 活跃 1 + 等待 0
- TaggingBatch: 活跃 1 + 等待 0

### 4.5 Readability.js 集成方案

```
┌─────────────────────────────────────────────┐
│  Rust Backend                               │
│  ┌───────────────────────────────────────┐  │
│  │  reader::readability::extract()        │  │
│  │  1. 加载源 HTML                        │  │
│  │  2. 通过 Tauri WebView IPC 注入 JS     │  │
│  │  3. JS 执行 Mozilla Readability.js     │  │
│  │  4. 返回 { content, title, byline }    │  │
│  │  5. Rust 存储 cleaned_html             │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

WebView 中注入脚本：
```javascript
// readability-bridge.js (打包为资源)
import { Readability } from '@mozilla/readability';

const document = new JSDOM(html).window.document;  // 或直接用隐藏 iframe
const reader = new Readability(document);
const result = reader.parse();
return JSON.stringify(result);
```

### 4.6 Markdown 管线

```
源 HTML                 → cleaned_html  (Readability.js)
cleaned_html            → markdown      (自研 Rust 转换器，scraper DOM 遍历)
markdown                → reader_html   (comrak GFM 渲染 + 主题 CSS 注入)
reader_html + theme_id  → 缓存查询/写入  (content_html_cache)
```

对标 macOS MarkdownConverter 的功能：
- 块级：h1-h6、p、ul/ol 嵌套列表、blockquote、pre>code、hr、figure/figcaption、table(GFM pipe)
- 内联：a、em/i、strong/b、del/s、code、img、picture、sup/sub(HTML pass-through)
- 媒体检测：img+br+caption 模式 → 媒体块 + 说明块分离
- 空白处理：DOM 碎片化不变性，边界空白丢弃

---

## 五、前端组件架构

### 5.1 组件树

```
<App>
├── <AppShell>                          # 三栏布局容器
│   ├── <SidebarView>                   # 左侧栏 (250px)
│   │   ├── <SectionToggle />           # Feeds | Tags 切换
│   │   ├── <FeedList>                  # (Feeds 模式)
│   │   │   ├── <VirtualFeedRow />      # All Feeds / Starred
│   │   │   └── <FeedRow />             # 单个订阅源
│   │   ├── <TagFilter>                 # (Tags 模式)
│   │   │   ├── <TagSearchField />
│   │   │   ├── <MatchModePicker />     # Any / All
│   │   │   └── <TagItem />             # 标签条目
│   │   └── <StatusBar />
│   ├── <EntryListView>                 # 中间列表 (400px)
│   │   ├── <EntryListHeader />
│   │   └── <EntryRow />                # 文章行
│   └── <ReaderDetailView>             # 右侧阅读 (flex)
│       ├── <ReaderToolbar />
│       │   ├── <ReadingModePicker />   # Reader / Web / Dual
│       │   ├── <TranslationButton />
│       │   ├── <TaggingButton />
│       │   ├── <NoteButton />
│       │   ├── <ThemeButton />
│       │   └── <ShareMenu />
│       ├── <ReaderBanner />            # Agent 消息横幅
│       ├── <ReaderWebView />           # 阅读器 WebView
│       ├── <ReaderSummaryPanel />      # 摘要面板
│       ├── <ReaderTranslationPanel />  # 翻译面板
│       ├── <ReaderTaggingPanel />      # 标签面板
│       └── <ReaderNotePanel />         # 笔记面板
├── <AppSettingsView>                   # 设置窗口
├── <FeedEditorSheet />                 # 添加/编辑订阅源
├── <ImportOPMLSheet />
├── <TagLibrarySheet />
├── <TagRenameSheet />
├── <BatchTaggingSheet />
├── <ShareDigestSheet />
├── <ExportDigestSheet />
├── <ExportMultipleDigestSheet />
└── <UsageReportView />
```

### 5.2 状态管理 (Zustand)

```typescript
// useAppStore.ts — 全局应用状态
interface AppState {
  isReady: boolean;
  bootstrapState: 'idle' | 'importing' | 'failed';
  syncState: 'idle' | 'syncing' | 'failed';
  totalUnread: number;
  lastSyncAt: string | null;
  sidebarSection: 'feeds' | 'tags';
  selectedFeedId: number | 'all' | 'starred';
  selectedEntryId: number | null;
  readingMode: 'reader' | 'web' | 'dual';
  showUnreadOnly: boolean;
  searchText: string;
  selectedTagIds: number[];
  tagMatchMode: 'any' | 'all';
}

// useReaderStore.ts — 阅读器状态
interface ReaderState {
  themePreset: 'classic' | 'paper';
  themeMode: 'auto' | 'forceLight' | 'forceDark';
  themeOverrides: ThemeOverrides;
  effectiveTheme: ThemeTokens;
  readerHTML: string | null;
  summaryState: SummaryState;
  translationState: TranslationState;
  noteText: string;
  noteSaveState: 'idle' | 'saving' | 'saved' | 'failed';
}
```

---

## 六、开发阶段

### Phase 1：基础设施 + 核心阅读 (MVP)
- Tauri 项目搭建，Rust 编译调试环境
- 数据库 Schema + 迁移系统
- 订阅源 CRUD + OPML 导入导出
- Feed 解析与同步
- 文章列表 + 三栏布局
- Readability 清洗 + Markdown 转换 + WebView 渲染
- 基础主题 (Classic + Paper, Light/Dark)

### Phase 2：AI 智能体
- LLM 提供商/模型配置管理
- Windows Credential Manager API Key 存储
- 摘要智能体 (流式输出)
- 翻译智能体 (双语对照)
- 标签智能体 (单篇 + 批量)

### Phase 3：笔记与文摘
- 文章笔记编辑器
- 分享文摘 (纯文本)
- 导出文摘 (单篇/多篇 Markdown)
- 模板系统

### Phase 4：标签系统
- 标签面板
- 标签库管理 (重命名/合并/别名)
- 批量打标签工作流
- NLTagger 替代 (本地实体提取)

### Phase 5：完善与发布
- 用量统计报告 (图表)
- Obsidian Publish 支持
- 自动更新
- 安装包 (MSI/NSIS)
- 测试覆盖
- 多语言支持

---

## 七、验证方案

每阶段完成后：
1. `cargo test` — Rust 单元测试通过
2. `cargo clippy` — 无 lint 警告
3. `npm test` (Vitest) — 前端组件测试通过
4. 手动测试：添加 RSS 源 → 查看文章 → 切换主题 → 生成摘要
5. 数据库兼容性：创建 SQLite 文件 → 关闭应用 → 重新打开 → 数据完整性验证
6. Windows 10 和 Windows 11 真机测试
