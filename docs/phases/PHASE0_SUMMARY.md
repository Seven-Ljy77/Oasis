# Mercury Windows — 项目框架搭建阶段总结

> 日期：2026-07-13  
> 分支：`windows`  
> 参考基线：macOS Mercury（`mac` 分支，约 170 个 Swift 文件，162 项功能）

---

## 一、项目概况

将 macOS 原生 RSS 阅读器 Mercury 移植到 Windows 平台，采用 **Tauri 2 + Rust + React/TypeScript + WebView2** 技术栈重写。本阶段完成了完整项目框架搭建，包含所有模块的接口定义、数据模型、组件骨架和配置系统。

---

## 二、技术栈

| 层面 | 技术 | 说明 |
|------|------|------|
| 桌面框架 | Tauri 2.11 | 复用系统 WebView2，包体 ~15MB |
| 后端语言 | Rust 1.97 (Edition 2024) | 编译为原生 Windows 二进制 |
| 异步运行时 | tokio | Rust 异步标准 |
| 数据库 | SQLite via rusqlite (bundled, WAL) | 与 macOS 版相同数据库格式 |
| 前端 UI | React 19 + TypeScript | 声明式 UI |
| 样式 | Tailwind CSS 3 | 主题令牌映射到 CSS 变量 |
| 状态管理 | Zustand 5 | 轻量状态管理 |
| 阅读器渲染 | WebView2 (Tauri WebView) | 对标 macOS WKWebView |
| 文章清洗 | Mozilla Readability.js | 在 WebView 中执行 |
| Markdown → HTML | comrak (GFM) | 对标 macOS MarkupHTMLVisitor |
| HTML → Markdown | 自研 Rust (scraper) | 对标 macOS MarkdownConverter |
| Feed 解析 | feed-rs | RSS/Atom/JSON Feed |
| LLM 客户端 | reqwest + SSE | OpenAI 兼容 API |
| 模板引擎 | Tera | 对标 macOS Mustache 模板 |
| 图表 | Recharts | 用量统计报告 |
| 凭据存储 | Windows Credential Manager | 对标 macOS Keychain |
| 自动更新 | Tauri updater | 对标 Sparkle |

---

## 三、文件统计

| 类别 | 文件数 | 说明 |
|------|--------|------|
| Rust 后端 | 86 | 包含 models, stores, traits, commands, domain 模块 |
| SQL 迁移 | 15 | 完整 macOS 兼容 schema |
| React/TypeScript 前端 | 71 | 组件, stores, hooks, types, IPC 封装 |
| YAML 资源模板 | 7 | 4 个 AI prompt + 3 个 digest template |
| 配置文件 | 10 | Cargo.toml, package.json, tauri.conf, vite, tailwind, tsconfig |
| **总计** | **189** | |

---

## 四、Rust 后端架构

### 4.1 目录结构

```
src-tauri/src/
├── main.rs                  # Tauri 入口
├── lib.rs                   # 模块声明，AppState 初始化，42 个命令注册
├── error.rs                 # AppError 统一错误类型（16 种变体）
├── state.rs                 # AppState + AppConfig
│
├── db/                      # 数据库层 (17 文件)
│   ├── manager.rs           # DatabaseManager（Mutex<Connection>, WAL 模式）
│   ├── migrations.rs        # 迁移执行器（嵌入 15 个 SQL 文件）
│   ├── models.rs            # 25 个数据模型 struct（Feed → TagBatchNewTagReview）
│   ├── query_builder.rs     # EntryListQuery（游标分页构建器）
│   └── *_store.rs (13 文件) # async trait 接口（FeedStore, EntryStore, ...）
│
├── feed/                    # 订阅源管理 (9 文件)
│   ├── sync_service.rs      # 同步引擎 + 速率限制
│   ├── feed_parser.rs       # feed-rs 封装
│   ├── opml_import/export   # OPML 导入导出
│   ├── feed_validator.rs    # URL 验证 + HTTPS 强制
│   ├── title_resolver.rs    # 多来源标题解析
│   ├── bootstrap.rs         # 首次启动引导
│   └── sidebar_counts.rs    # 侧栏未读/收藏计数
│
├── reader/                  # 阅读管线 (7 文件)
│   ├── pipeline.rs          # ReaderPipeline trait + RebuildAction
│   ├── readability.rs       # Readability.js 桥接
│   ├── markdown_converter   # HTML → Markdown (scraper)
│   ├── markdown_renderer    # Markdown → HTML (comrak)
│   ├── theme.rs             # ThemeTokens（13 字段）+ CSS 生成
│   ├── html_patcher.rs      # 增量 DOM 更新
│   └── navigation_policy.rs # WebView URL 导航策略
│
├── agent/                   # AI 智能体 (17 文件)
│   ├── runtime.rs           # AgentRuntimeEngine 状态机 + 并发控制
│   ├── provider.rs          # LLMProvider trait + OpenAIProvider
│   ├── route.rs             # 模型路由选择
│   ├── prompt_template.rs   # Prompt 模板渲染
│   ├── failure.rs           # 错误分类 + 重试策略
│   ├── summary/             # 摘要智能体 (executor + storage)
│   ├── translation/         # 翻译智能体 (executor + segment + bilingual + storage)
│   └── tagging/             # 标签智能体 (executor + batch)
│
├── digest/                  # 笔记与文摘 (5 文件)
│   ├── note_controller.rs   # 笔记生命周期
│   ├── composition.rs       # 文摘合成
│   ├── export.rs            # 文件导出
│   └── template.rs          # 文摘模板
│
├── tags/                    # 标签系统 (4 文件)
│   ├── normalization.rs     # 标签标准化
│   ├── suggestion.rs        # 输入建议
│   └── local_service.rs     # 本地实体提取
│
├── usage/                   # 用量统计 (4 文件)
│   ├── tracker.rs           # Token 事件记录
│   ├── retention.rs         # 数据保留策略
│   └── reports.rs           # 报表查询
│
├── tasking/                 # 任务系统 (4 文件)
│   ├── task_queue.rs        # 优先级任务队列
│   ├── job_runner.rs        # 超时任务执行器
│   └── failure_policy.rs    # 失败处理策略
│
├── resources/               # 内嵌资源管理 (3 文件)
│   ├── prompts.rs           # Prompt 模板加载
│   └── templates.rs         # Digest 模板加载
│
├── commands/                # Tauri IPC 命令 (10 文件)
│   ├── feed_commands.rs     # 6 个命令
│   ├── entry_commands.rs    # 6 个命令
│   ├── reader_commands.rs   # 2 个命令
│   ├── agent_commands.rs    # 5 个命令
│   ├── tag_commands.rs      # 8 个命令
│   ├── digest_commands.rs   # 5 个命令
│   ├── usage_commands.rs    # 5 个命令
│   ├── settings_commands.rs # 4 个命令
│   └── window_commands.rs   # 3 个命令
│
└── migrations/              # SQL 迁移 (15 文件)
    ├── 001_create_feed.sql
    ├── 002_create_entry.sql
    ├── 003_create_content.sql
    ├── 004_create_content_html_cache.sql
    ├── 005_create_tag_tables.sql
    ├── 006_create_entry_note.sql
    ├── 007_create_agent_provider.sql
    ├── 008_create_agent_model.sql
    ├── 009_create_agent_profile.sql
    ├── 010_create_agent_task_run.sql
    ├── 011_create_llm_usage_event.sql
    ├── 012_create_summary_result.sql
    ├── 013_create_translation_tables.sql
    ├── 014_create_tag_batch_tables.sql
    └── 015_create_indexes.sql
```

### 4.2 数据库 Schema（15 张表，与 macOS 相同）

| 表名 | 用途 |
|------|------|
| `feed` | RSS/Atom/JSON Feed 订阅 |
| `entry` | 文章（含软删除 `is_deleted`） |
| `content` | Reader 管线数据（源 HTML → 清洗 → Markdown） |
| `content_html_cache` | 按主题缓存的渲染 HTML |
| `entry_note` | 文章 Markdown 笔记 |
| `tag` / `tag_alias` / `entry_tag` | 扁平标签系统 + 别名解析 |
| `agent_provider_profile` / `agent_model_profile` / `agent_profile` | LLM 配置 |
| `agent_task_run` / `llm_usage_event` | Agent 执行记录 + Token 追踪 |
| `summary_result` / `translation_result` / `translation_segment` | AI 输出缓存 |
| `tag_batch_run` / `tag_batch_entry` / `tag_batch_assignment_staging` / `tag_batch_new_tag_review` | 批量打标签流水线 |

### 4.3 关键架构设计

- **Store 层采用 trait 抽象**：13 个 `#[async_trait]` 接口，可 mock 测试，可替换实现
- **Agent 可扩展**：`AgentExecutor` trait 支持插件式新增智能体类型
- **统一错误类型**：`AppError` 含 16 种变体，实现 Serialize/Deserialize
- **Agent 运行时状态机**：Idle → Waiting → Requesting → Generating → Persisting → Completed/Failed/TimedOut/Cancelled
- **并发控制**：Summary(1+1), Translation(1+1), Tagging(1+0), TaggingBatch(1+0)

---

## 五、React 前端架构

### 5.1 目录结构

```
src/
├── main.tsx                  # React 入口
├── App.tsx                   # 三栏布局根组件
│
├── lib/                      # 工具函数 (4 文件)
│   ├── types.ts              # 完整 TypeScript 接口定义
│   ├── ipc.ts                # Tauri invoke() 类型封装（40+ 函数）
│   ├── format.ts             # 日期/数字格式化
│   └── constants.ts          # 应用常量
│
├── styles/                   # 样式 (2 文件)
│   ├── index.css             # Tailwind CSS + 全局样式
│   └── reader-theme.css      # 阅读器主题 CSS
│
├── components/               # 通用组件
│   ├── ui/                   # 基础 UI 组件 (11 文件)
│   │   ├── Button.tsx        # 4 变体, 3 尺寸, loading 状态
│   │   ├── Input.tsx         # 带前缀图标, 错误态, 清除按钮
│   │   ├── Select.tsx        # 下拉选择器
│   │   ├── Slider.tsx        # 范围滑块
│   │   ├── Toggle.tsx        # 开关切换
│   │   ├── Dialog.tsx        # 模态对话框
│   │   ├── Sheet.tsx         # 侧滑面板
│   │   ├── Badge.tsx         # 内联徽标
│   │   ├── Chip.tsx          # 标签芯片
│   │   ├── ContextMenu.tsx   # 右键菜单
│   │   └── Tooltip.tsx       # 悬浮提示
│   ├── SplitPane.tsx         # 拖拽分隔面板
│   ├── StatusBar.tsx         # 状态栏
│   └── SearchField.tsx       # 搜索框
│
├── features/                 # 功能模块 (32 文件)
│   ├── sidebar/              # 侧栏 (5 文件)
│   │   ├── SidebarView.tsx
│   │   ├── FeedList.tsx
│   │   ├── TagFilter.tsx
│   │   ├── FeedEditorSheet.tsx
│   │   └── ImportOPMLSheet.tsx
│   ├── entry-list/           # 文章列表 (3 文件)
│   │   ├── EntryListView.tsx
│   │   ├── EntryRow.tsx
│   │   └── MultiSelectToolbar.tsx
│   ├── reader/               # 阅读器 (9 文件)
│   │   ├── ReaderDetailView.tsx
│   │   ├── ReaderToolbar.tsx
│   │   ├── ReaderWebView.tsx
│   │   ├── ReaderThemePanel.tsx
│   │   ├── ReaderSummaryPanel.tsx
│   │   ├── ReaderTranslationPanel.tsx
│   │   ├── ReaderTaggingPanel.tsx
│   │   ├── ReaderNotePanel.tsx
│   │   └── ReadingModePicker.tsx
│   ├── settings/             # 设置 (5 文件)
│   │   ├── AppSettingsView.tsx
│   │   ├── GeneralSettings.tsx
│   │   ├── ReaderSettings.tsx
│   │   ├── AgentSettings/AgentSettingsView.tsx
│   │   └── DigestSettings.tsx
│   ├── tags/                 # 标签管理 (3 文件)
│   │   ├── TagLibrarySheet.tsx
│   │   ├── TagRenameSheet.tsx
│   │   └── BatchTaggingSheet.tsx
│   ├── digest/               # 文摘 (3 文件)
│   │   ├── ShareDigestSheet.tsx
│   │   ├── ExportDigestSheet.tsx
│   │   └── ExportMultipleDigestSheet.tsx
│   └── usage/                # 用量统计 (4 文件)
│       ├── UsageReportView.tsx
│       ├── ProviderReport.tsx
│       ├── ModelReport.tsx
│       └── AgentReport.tsx
│
├── stores/                   # Zustand 状态管理 (8 文件)
│   ├── useAppStore.ts        # 全局 UI 状态
│   ├── useFeedStore.ts       # 订阅源 CRUD
│   ├── useEntryStore.ts      # 文章列表 + 分页
│   ├── useEntryListStore.ts  # 文章列表扩展
│   ├── useReaderStore.ts     # 阅读器（主题 + Agent 面板）
│   ├── useSettingsStore.ts   # 设置持久化
│   ├── useSidebarStore.ts    # 侧栏计数 + 同步状态
│   ├── useTagStore.ts        # 标签库 + 批量打标签
│   └── useAgentStore.ts      # Agent 状态 + 可用性
│
└── hooks/                    # 自定义 Hooks (6 文件)
    ├── useTauriCommand.ts    # IPC 调用封装
    ├── useTauriEvent.ts      # 后端事件监听
    ├── useAutoSave.ts        # 防抖自动保存
    ├── useDebounce.ts        # 泛型防抖
    ├── useKeyboardShortcut.ts # 键盘快捷键
    └── useKeyboardShortcuts.ts # 多快捷键管理
```

### 5.2 组件树

```
<App>  # 三栏布局
├── <SidebarView>              # 左侧栏 (250px)
│   ├── Feeds / Tags 切换
│   ├── <FeedList>             # All Feeds, Starred, 订阅源列表
│   ├── <TagFilter>            # 标签搜索, 多选筛选
│   └── <StatusBar>            # 同步状态, 任务进度, 统计
├── <EntryListView>            # 中间列 (400px)
│   ├── 搜索, 未读筛选
│   ├── <EntryRow>             # 未读指示器, 标题, 日期, 收藏按钮
│   └── 无限滚动加载
└── <ReaderDetailView>         # 右侧阅读区 (flex)
    ├── <ReaderToolbar>        # 模式切换, 翻译, 标签, 笔记, 主题
    ├── <ReaderWebView>        # WebView2 渲染
    ├── <ReaderSummaryPanel>   # AI 摘要面板
    ├── <ReaderTranslationPanel> # 双语翻译面板
    ├── <ReaderTaggingPanel>   # 标签输入面板
    └── <ReaderNotePanel>      # 笔记编辑面板

# 弹窗/Sheet 层
├── <AppSettingsView>          # 四标签页：通用/阅读器/智能体/文摘
├── <FeedEditorSheet>          # 添加/编辑订阅源
├── <ImportOPMLSheet>          # OPML 导入选项
├── <TagLibrarySheet>          # 标签库管理
├── <BatchTaggingSheet>        # 批量打标签工作流
├── <ShareDigestSheet>         # 分享文摘
├── <ExportDigestSheet>        # 导出单篇文摘
├── <ExportMultipleDigestSheet> # 导出多篇文摘
└── <UsageReportView>          # 用量统计图表
```

---

## 六、资源文件

### 6.1 AI Prompt 模板（从 macOS 直接复用）

```
resources/prompts/
├── summary.default.yaml       # 摘要智能体（3 级详细程度：short/medium/detailed）
├── translation.default.yaml   # 翻译智能体（标准策略）
├── translation.hy-mt.yaml     # 翻译智能体（HY-MT 优化策略）
└── tagging.default.yaml       # 标签智能体（含 few-shot 示例）
```

### 6.2 Digest 文摘模板（从 macOS 直接复用）

```
resources/templates/
├── single-text.yaml           # 单篇纯文本分享
├── single-markdown.yaml       # 单篇 Markdown 导出（Hugo frontmatter）
└── multiple-markdown.yaml     # 多篇 Markdown 合并导出
```

---

## 七、验证结果

| 验证项 | 结果 |
|--------|------|
| `cargo check` | **0 错误**，7 警告（均为 stub 未读字段）|
| `npx tsc --noEmit` | **0 错误** |
| `npx vite build` | **76 modules，4.08s** |
| `cargo tauri dev` | **成功启动**，窗口稳定运行 |
| 数据库自动迁移 | **成功**（15 个表自动创建于 `AppData/Local/Mercury/`） |

### 已解决的问题

1. **rusqlite::Connection 线程安全**：使用 `Mutex<Connection>` 包裹
2. **数据库文件触发无限重启**：数据库路径从项目目录改为 Windows 标准 AppData 目录
3. **Vite 监听 Rust target 目录冲突**：配置 `server.watch.ignored` 排除
4. **Tauri 插件配置格式**：移除空的 `dialog`/`shell`/`fs` 配置对象
5. **Windows 图标编译**：生成有效的 PNG-based ICO 文件

---

## 八、当前状态说明

> **所有 UI 界面均为骨架渲染，后端命令均为 `todo!()` 占位。**

- 窗口可以正常打开，三栏布局显示完整
- 界面交互可以触发 React 状态变更
- 但所有依赖后端的功能（Feed 同步、文章渲染、AI 摘要/翻译/标签等）均不可用
- 框架建立了完整的 trait 接口层和 IPC 通信桥梁，后续开发只需向接口填充实现

---

## 九、开发阶段（来自 docs/ARCHITECTURE.md）

| 阶段 | 范围 | 状态 |
|------|------|------|
| **Phase 0** | 项目框架搭建 | ✅ 完成 |
| **Phase 1** | 核心阅读 MVP（Tauri 脚手架, DB, Feed CRUD, OPML, 文章列表, 阅读器渲染, 主题） | 待开始 |
| **Phase 2** | AI 智能体（LLM 配置, 凭据存储, 摘要, 翻译, 标签） | 待开始 |
| **Phase 3** | 笔记与文摘（笔记编辑器, 分享/导出, 模板引擎） | 待开始 |
| **Phase 4** | 标签系统（标签面板, 标签库管理, 批量标签, 本地 NLP） | 待开始 |
| **Phase 5** | 完善与发布（用量图表, 自动更新, MSI/NSIS, 测试, i18n） | 待开始 |

---

## 十、关键设计决策

1. **Markdown 为规范格式**：文章清洗后存储为 Markdown，便于 LLM 输入和导出
2. **分层持久化 + 独立版本化**：Readability / Markdown / ReaderHTML 三层缓存可独立失效
3. **DB-first 写入模式**：所有变更先写数据库再更新内存
4. **软删除 + 防复活**：文章 `isDeleted` 标记 + 唯一索引防止同步重新插入
5. **通用任务队列**：所有异步操作统一通过 `TaskQueue` 调度
6. **Agent 运行时状态机**：统一生命周期管理，支持 concurrent + waiting queue
7. **模板引擎**：Mustache 风格占位符，Agent Prompts 和 Digest Templates 共用
8. **Prompt 所有权分离**：模板文件是 prompts 的唯一来源，执行代码不修改 prompt 文本
9. **提供商/模型归档**：软删除替代物理删除，保留用量统计完整性
10. **数据库 Schema 与 macOS 保持一致**：确保未来数据互通
