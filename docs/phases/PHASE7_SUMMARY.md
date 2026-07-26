# Mercury Windows — Phase 7 开发总结

> 日期：2026-07-26
> 分支：`windows`
> 基线：Phase 6（Digest/Export 系统 + 模板自定义 + Share 按钮增强）

---

## 一、完成概况

Phase 7 聚焦于 **阅读体验深化** 和 **应用质量打磨**——包括 Readability.js 内容清洗（阅读管线核心升级）、OPML 并发导入 + 实时进度、i18n 多语言系统、Dark Mode 主题完善、侧栏未读计数、批量操作修复等。

| 贡献者 | 内容 |
|--------|------|
| Ljy | 全部功能实现（Rust 后端 + React 前端 + CSS 主题） |

---

## 二、新增/修改文件统计

| 类别 | 文件数 | 说明 |
|------|--------|------|
| Rust 新建 | 1 | `db/content_store_impl.rs` |
| Rust 修改 | ~10 | readability（重写）、pipeline、reader_commands、opml_import（重写）、feed_commands、entry_commands、entry_store、query_builder、state、lib |
| React 新建 | 2 | `lib/translations.ts`、`lib/i18n.tsx` |
| React 修改 | ~30 | 全部 feature 组件（i18n 翻译）、App、useReaderStore、useEntryStore、useSidebarStore、useFeedStore、ipc、types |
| CSS 修改 | 2 | `index.css`（Dark Mode 全覆盖）、`tailwind.config.js` |
| 文档 | 1 | `PHASE7_SUMMARY.md` |

---

## 三、Readability.js 内容清洗

### 3.1 后端

**依赖**: `readability-js = "0.1"` — 通过 QuickJS 嵌入式 JS 引擎 + linkedom DOM 执行真正的 Mozilla Readability.js 源码，非 Rust 移植。100% 还原 Firefox Reader View 提取质量。

**文件**: `src-tauri/src/reader/readability.rs`（重写）

```rust
pub fn extract_article_content(raw_html: &str) -> Result<CleanedArticle, AppError> {
    let readability = Readability::new()?;
    let article = readability.parse(raw_html)?;
    Ok(CleanedArticle {
        content_html: article.content,
        title: Some(article.title).filter(|t| !t.is_empty()),
        byline: article.byline,
        text_content: article.text_content,
    })
}
```

**管线升级**（`src-tauri/src/reader/pipeline.rs`）：

```
旧: fetch raw HTML → convert to Markdown → render → display
新: fetch raw HTML → Readability.js 清洗 → convert cleaned HTML → render → display → persist to DB
```

**5 级缓存**（`RebuildAction` 全部 5 级实现）:
| 层级 | 条件 | 操作 |
|------|------|------|
| ServeCached | HTML 缓存命中 | 直接返回 |
| RerenderFromMarkdown | Markdown 缓存 + 版本当前 | 用当前主题重渲染 |
| RebuildMarkdownAndRender | 清洗 HTML 缓存 + 版本当前 | 重新 Markdown 转换 + 渲染 |
| RerunReadabilityAndRebuild | 源 HTML 缓存 | 重新清洗 + 转换 + 渲染 |
| FetchAndRebuildFull | 无缓存 | 完整网络获取 |

**清洗效果**: Wikipedia Rust 文章从 1,001KB 原始 HTML 缩减到 663KB（34% 减少），广告/导航/侧栏/页脚全部过滤。

### 3.2 数据库层

**新建**: `src-tauri/src/db/content_store_impl.rs`

```rust
pub struct SqliteContentStore { db: Arc<DatabaseManager> }

impl ContentStore for SqliteContentStore {
    async fn load(&self, entry_id: i64) -> Result<Option<Content>, AppError>;
    async fn upsert_source(entry_id, html, document_base_url, pipeline_type) -> Result;
    async fn upsert_artifacts(entry_id, cleaned_html, readability_title, ...) -> Result;
    async fn invalidate_layer(entry_id, target) -> Result;
    async fn load_cache(entry_id, theme_id) -> Result<Option<ContentHTMLCache>>;
}
```

源 HTML、清洗 HTML（含标题/作者/版本号）、Markdown（含版本号）、渲染 HTML 缓存全部持久化到 `content` 和 `content_html_cache` 表。

### 3.3 前端适配

- `buildReaderHTML` IPC 新增 `entryId` 参数，用于缓存写入
- `ReaderDetailView` 监听 `themeMode` 变化触发重建

---

## 四、OPML 并发导入 + 实时进度

### 4.1 后端

**文件**: `src-tauri/src/feed/opml_import.rs`（重写）

**之前**: `for outline in outlines` 串行循环，一个 feed 慢全部阻塞，零进度反馈。

**之后**: `tokio::sync::Semaphore` + `tokio::task::JoinSet` 并发处理（默认 6 路），每篇 emit `import-opml-progress` 事件：

```json
{
  "feed_title": "Hacker News",
  "feed_url": "...",
  "status": "fetching|done|error|skipped",
  "completed": 3,
  "total": 10,
  "error": "..." // 仅失败时
}
```

**命令签名变更**:
```rust
pub async fn import_opml(
    app_handle: tauri::AppHandle,      // NEW: 发射事件
    state: State<'_, AppState>,
    path: String,
    replace: bool,
    force_site_name: bool,
    concurrency: Option<u32>,           // NEW: 并发数
) -> Result<ImportResult, AppError>
```

### 4.2 前端

**文件**: `src/features/sidebar/ImportOPMLSheet.tsx`（重写）

- 实时进度条 + "3/15 completed" 计数器
- 逐篇状态列表：🔵 fetching / ✅ done / ➡️ skipped / ❌ failed
- 状态汇总 chips（fetching/done/skipped/failed 分别计数）
- 导入完成后显示摘要：added X, skipped Y，errors 可展开查看详情

---

## 五、i18n 多语言系统

### 5.1 架构

```
src/lib/translations.ts     ← 字典（200+ 键，en + zh-CN 完整翻译）
src/lib/i18n.tsx            ← I18nProvider + useI18n() hook
App.tsx                     ← <I18nProvider> 包裹整个应用
GeneralSettings.tsx         ← 语言选择器调用 setLocale()，即时切换
```

### 5.2 设计

- **零外部依赖**: 自研轻量级 i18n，基于 React Context
- **单向数据流**: `useState`（React）为 UI 唯一真实源，Zustand 仅负责持久化到磁盘
- **运行时切换**: 选择语言后所有界面即时更新，无需重启
- **持久化**: 语言偏好存入 `mercury-config.json`，重启保持
- **翻译覆盖**: 侧栏、文章列表、阅读器、Settings（全部页签）、弹窗 Sheets、状态栏

### 5.3 翻译组件

全部 ~30 个 React 组件已接入 `useI18n()` hook，替换硬编码英文字符串为 `t.*` 翻译键。

| 区域 | 翻译组件数 |
|------|-----------|
| 侧栏 | SidebarView, FeedList, TagFilter, FeedEditorSheet, ImportOPMLSheet |
| 文章列表 | EntryListView, MultiSelectToolbar |
| 阅读器 | ReaderDetailView, ReaderToolbar, ReadingModePicker, ThemeSwitcher, Summary/Translation/Tagging/Note 面板 |
| Settings | AppSettingsView, GeneralSettings, ReaderSettings, AgentSettingsView, DigestSettings |
| Tags | TagLibrarySheet, TagMergeSheet, TagRenameSheet, BatchTaggingSheet |
| Digest | ShareDigestSheet, ExportDigestSheet, ExportMultipleDigestSheet |
| Usage | UsageReportView |

---

## 六、Dark Mode 主题完善

### 6.1 Reader 内容区深色模式

**文件**: `src-tauri/src/reader/theme.rs`

新增三个预设：

| 模式 | 背景色 | 文字色 |
|------|--------|--------|
| `dark()` | `#1a1b1e` | `#e2e2e2` |
| `eyecare()` | `#f5e6d3` | `#4a3728` |
| `default()` (light) | `#faf9f7` | `#1a1a1a` |

**文件**: `src-tauri/src/commands/reader_commands.rs`

`ReaderThemeParams` 新增 `themeMode` 字段。`build_reader_html` 根据模式选择基础色板。前端 `useReaderStore.buildReaderHTML` 在 Auto 模式下检测系统 `matchMedia` 并传解析后的 mode。

### 6.2 App 外层深色模式

**文件**: `src/styles/index.css`

- `.force-dark` 类：覆盖全部 `text-slate-*` 文字色（`!important` 确保优先）
- 语义色覆盖：红色/绿色/琥珀色/蓝色提示框
- 表单元素：input/select/textarea 文字色适配
- Auto 模式：启动时通过 `useEffect` 检测系统主题 → 加 `force-dark`/`force-light` class
- 系统主题变化监听：`matchMedia("(prefers-color-scheme: dark)").addEventListener("change", ...)`

### 6.3 Bug 修复过程

| 问题 | 根因 | 修复 |
|------|------|------|
| Auto 模式无效 | `themeMode: "auto"` 是 store 默认值但 `setThemeMode("auto")` 从未在启动时被调用 | App.tsx 挂载时立即调用 `setThemeMode(initialMode)` |
| CSS 修改不生效 | 仅 `npx vite build` 更新 dist/ 但 `cargo build` 未重新嵌入资源 | 每次前端变更后均执行 `cargo build` |
| Light 模式花白 | `@media (prefers-color-scheme: dark)` 内的全局文字色覆盖影响了 Light 模式 | 移除 media query 中的文字色覆盖，仅通过 JS 加 class 控制 |

---

## 七、侧栏未读计数

### 7.1 后端

**文件**: `src-tauri/src/feed/sidebar_counts.rs`（重写）

```rust
pub fn compute_projection(db: &Arc<DatabaseManager>) -> Result<SidebarProjection, AppError> {
    // 6 条 SQL 一次性计算:
    // - 全局未读数 (is_deleted=0 AND is_read=0)
    // - 收藏数 + 收藏未读数
    // - 总文章数 + 总订阅源数
    // - 每 feed 的未读数 + 总数 (LEFT JOIN entry)
}
```

**Tauri 命令**: `get_sidebar_projection` → 返回 `SidebarProjection`

### 7.2 前端

- `useSidebarStore.loadCounts()` — 调用 IPC 并更新全部计数 + 同步到 AppStore
- **刷新时机**: 启动时 / Sync 完成后 / OPML 导入后 / 每次 markRead / markStarred / deleteEntry
- 侧栏各 feed 旁显示未读 badge
- 底栏状态栏显示订阅源数、文章总数、未读数

### 7.3 Bug 修复

| 问题 | 根因 | 修复 |
|------|------|------|
| 左下角 unread 数不更新 | `getState().totalUnread` 是静态快照，不响应 state 变化 | 改为 `useSidebarStore((s) => s.totalUnread)` 响应式订阅 |
| 计数始终为 370 不变 | 只修改前端 dist/ 但 Rust 二进制未重新编译 | `cargo build` 重新嵌入前端资源 |

---

## 八、批量操作修复

### 8.1 问题

Mark All Read / Mark All Unread / Delete All 只操作当前页面可见的 ~50 篇文章（page-scoped），而非当前筛选条件下的全部文章（query-scoped）。

### 8.2 修复

**后端新增命令**:

| 命令 | 功能 |
|------|------|
| `mark_all_read(query, is_read)` | 根据查询条件标记全部匹配文章 |
| `delete_all_entries(query)` | 软删除全部匹配文章 |

`EntryStore` trait 新增 `mark_all_read` 和 `delete_all_entries` 方法，复用现有 `build_where_clause` 生成 WHERE 子句。

`EntryListQuery` 增加 `#[serde(default)]` 确保前端缺字段时反序列化不失败。`TagMatchMode` 增加 `#[serde(rename_all = "lowercase")]` 修复大小写不匹配。

**前端**: `EntryListView` 的 `handleMarkAllRead`/`handleMarkAllUnread`/`handleDeleteSelected` 改为构建当前查询 → 调用新命令 → 重新加载。

---

## 九、功能清单（截至 Phase 7）

### 新增/完善

| 域 | 功能 | 状态 |
|------|------|------|
| **Readability.js** | Mozilla Readability.js 内容清洗（QuickJS 嵌入） | ✅ |
| | 5 级缓存（源HTML/清洗HTML/Markdown/渲染HTML） | ✅ |
| | SqliteContentStore 持久化 | ✅ |
| **OPML 导入** | 并发导入（Semaphore + JoinSet，6路） | ✅ |
| | 实时进度条 + 逐篇状态 | ✅ |
| **i18n** | 英文/简体中文双语言，200+ 翻译键 | ✅ |
| | 运行时切换，持久化到磁盘 | ✅ |
| **Dark Mode** | Reader 内容区深色/护眼预设 | ✅ |
| | App 外层全组件深色覆盖（!important） | ✅ |
| | Auto 系统主题检测 + 变化监听 | ✅ |
| **侧栏计数** | 每 feed 未读数、全局未读、收藏计数 | ✅ |
| | 实时更新（每次读写操作后刷新） | ✅ |
| **批量操作** | Mark All Read/Unread query-scoped | ✅ |
| | Delete All query-scoped | ✅ |

### 已有功能（Phase 0-6 延续）

| 域 | 功能 | 状态 |
|------|------|------|
| **Digest 导出** | 单篇/多篇 Markdown 导出、分享复制、四种模板 | ✅ |
| **主题系统** | Appearance 切换、Reader Theme 预设、字体/字号/行高/宽度 | ✅ |
| **布局** | 三栏可拖拽、面板高度记忆 | ✅ |
| **LLM 配置** | Provider/Model/AgentProfile CRUD + 连接测试 + API Key | ✅ |
| **AI 摘要** | 流式生成、12 语言、3 详细度、双层缓存 | ✅ |
| **AI 翻译** | 分段并发、双语/纯译文、缓存、断点续传 | ✅ |
| **AI 标签** | AI 建议展示、标签开关控制、Tag Library 管理 | ✅ |
| **用量追踪** | Token 记录、按天聚合、Usage 标签页 | ✅ |
| **Note** | 5s 自动保存、面板开关保存、字符计数 | ✅ |
| **Settings** | 6 页签全部可用、设置持久化到磁盘 | ✅ |
| **快捷键** | J/K/M/U/S/V/Esc/Ctrl+F/Ctrl+D | ✅ |
| **Sync All** | 并发控制、进度反馈、列表刷新 | ✅ |
| **阅读器** | Reader/Web/Dual 三模式、缓存渲染 | ✅ |
| **标签系统** | CRUD、合并、批量删除、Any/All、标准化 | ✅ |
| **星标** | 收藏/取消、Starred 虚拟订阅源 | ✅ |

---

## 十、验证结果

| 验证项 | 结果 |
|--------|------|
| `cargo check` | 0 错误 |
| `npx tsc --noEmit` | 0 错误 |
| `npx vite build` | 0 错误 |
| Readability 清洗 — Wikipedia 文章 | 34% 体积缩减，标题/作者正确提取 ✅ |
| 5 级缓存 — 主题切换 | 从缓存 Markdown 重渲染（秒级） ✅ |
| Dark Mode — 三种模式 | Auto/Dark/Light 各自独立，互不干扰 ✅ |
| OPML 导入 — 并发 + 进度 | 6 路并发，逐篇状态可见 ✅ |
| i18n — 语言切换 | 即时生效，重启保持 ✅ |
| 侧栏计数 — 实时更新 | 读写操作后即刻刷新 ✅ |
| 批量操作 — query-scoped | Mark All Read/Unread/Delete All 对全部匹配文章生效 ✅ |
