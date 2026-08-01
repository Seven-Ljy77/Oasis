# Mercury Windows — Phase 1 开发总结

> 日期：2026-07-13  
> 分支：`windows`  
> 基线：Phase 0 项目框架（189 个文件，全部 `todo!()` 骨架）

---

## 一、完成概况

Phase 0 结束后，框架中所有功能均为空壳。Phase 1 实现了**订阅源管理、文章列表、三种阅读模式、OPML 导入导出**四个核心模块，从 Rust 后端到 React 前端全链路打通。

## 二、新增/修改文件统计

| 层级 | 新增 | 修改 | 说明 |
|------|------|------|------|
| Rust 后端 | 0 | ~20 | 填充 `todo!()` 为真实实现 |
| React 前端 | 0 | ~10 | 接线 IPC、修复 bug |
| 配置文件 | 0 | 2 | capabilities 权限 |

---

## 三、订阅源管理

### 3.1 Feed 添加

**前端** `FeedEditorSheet.tsx`：
- Check 按钮 → 调用 `probe_feed` 命令，向后端请求抓取并解析 Feed，自动填充标题
- Add Feed 按钮 → 调用 `add_feed` 命令，创建订阅源并导入文章
- 错误提示：URL 格式错误、非 Feed 内容、重复订阅均显示红色错误

**后端** `feed_commands.rs`：
- `add_feed`：验证 URL（HTTPS 强制）→ 查重 → reqwest 抓取 XML → feed-rs 解析 → SQLite 存储 Feed + Entry
- `probe_feed`：同上但不存储，返回发现的标题和文章数
- `get_feeds`：返回全部订阅源

### 3.2 Feed 删除

- `delete_feed` → SQLite 级联删除 feed 及所有关联 entry
- 前端删除时同时清空文章列表、跳回 All Feeds

### 3.3 数据模型与存储

**SqliteFeedStore** (`db/feed_store.rs`)：
- `load_all()` — `SELECT * FROM feed ORDER BY title COLLATE NOCASE`
- `upsert()` — `INSERT ... ON CONFLICT(feed_url) DO UPDATE`
- `delete(id)` — `DELETE FROM feed WHERE id = ?`
- `find_by_url(url)` — 查重

**SqliteEntryStore** (`db/entry_store.rs`)：
- `load_page()` — 动态 WHERE 构建 + 游标分页 `(published_at DESC, created_at DESC, id DESC)`，始终过滤 `is_deleted = 0`
- `load_next_page()` — 基于 cursor 续加载
- `mark_read()` — 动态 IN 子句批量更新
- `mark_starred()` — 单篇收藏切换
- `delete_entry()` — 软删除 `SET is_deleted = 1`
- `upsert_entries()` — `INSERT OR IGNORE`，防重复
- `search()` — LIKE 搜索，支持三种范围（title / title+summary / title+summary+content）

### 3.4 Feed 解析器

**`feed_parser.rs`** — 使用 `feed-rs` crate：
- 同一套代码处理 RSS 2.0、Atom、JSON Feed 三种格式
- 提取：title, site_url, entries(guid, url, title, author, published_at, summary, content_html)

### 3.5 同步服务

**`sync_service.rs`**：
- `sync_feed()` — reqwest 抓取 → parse → upsert entries → 更新 last_fetched_at
- `sync_all()` — Semaphore 并发控制，`JoinSet` 并行同步
- `RateLimitTracker` — 2 秒间隔限速

---

## 四、文章列表

### 4.1 游标分页

前端 `EntryListView` 通过 `useEntryStore` 调用 `load_entries`，后端构建动态 SQL：

```sql
SELECT e.*, f.title AS feed_title
FROM entry e JOIN feed f ON e.feed_id = f.id
WHERE e.is_deleted = 0
  AND e.feed_id = ?        -- 可选
  AND e.is_read = 0        -- 未读筛选
  AND e.is_starred = 1     -- 收藏筛选
  AND (e.title LIKE ? OR e.summary LIKE ?)  -- 搜索
ORDER BY e.published_at DESC, e.created_at DESC, e.id DESC
LIMIT 50
```

无限滚动自动触发 `loadNextPage()`。

### 4.2 交互功能

- 未读蓝色圆点 + 标题加粗
- 悬停显示收藏按钮
- 选中文章 3 秒后自动标记已读
- 右键菜单：Mark Read/Unread、Delete、Export Multiple Digest
- 多选模式 → 导出多篇文摘（待实现）
- All Feeds 显示全部源的文章混排

---

## 五、阅读器渲染（三种模式）

### 5.1 Reader 模式

**管线流程**：
```
文章 URL → reqwest GET 原文 HTML → scraper DOM 遍历转 Markdown → comrak GFM 渲染 → 注入主题 CSS → iframe 显示
```

**`markdown_converter.rs`**（250 行）：
- `scraper::Html::parse_document()` 解析 HTML
- 递归遍历 DOM 树，处理 h1-h6 / p / ul / ol / blockquote / pre>code / img / a / strong / em / br
- 跳过 script / style / nav / header / footer / aside

**`markdown_renderer.rs`**（162 行）：
- `comrak::markdown_to_html()` 渲染，启用 table / strikethrough / tasklist / autolink 扩展
- 包裹完整 HTML5 文档，注入 `ThemeTokens::to_css()` 生成的 CSS 变量

**`readability.rs`** — 简化版，仅 fetch HTML（Readability.js 清洗延后）

### 5.2 Web 模式

- `ReaderWebView` 收到 `mode="web"` 时渲染 `<iframe src={entryUrl}>`
- 直接加载原始网页

### 5.3 Dual 模式

- `ReaderDetailView` 检测 `readingMode === "dual"` 时左右分栏
- 左侧 Reader（清洗后内容），右侧 Web（原网页）
- 50/50 宽度

### 5.4 阅读模式选择器

`ReadingModePicker` — 三个按钮的 segmented control：
- **Reader**（书图标）— 清洗后阅读
- **Web**（地球图标）— 原始网页
- **Dual**（分栏图标）— 左右对照

---

## 六、OPML 导入导出

### 6.1 OPML 导入

**`opml_import.rs`**：
- `quick_xml::Reader` 解析 OPML 2.0 XML
- 提取 `<outline type="rss" xmlUrl="..." title="..." htmlUrl="..."/>`
- `import_into_db()` — 逐条 fetch + parse + upsert，错误收集不阻断
- `replace` 模式：先清空现有订阅源再导入
- `force_site_name` 模式：跳过 OPML 标题，使用 Feed XML 自身的标题

**前端** `ImportOPMLSheet.tsx`：
- Browse 按钮 → Tauri dialog `open()` → 原生文件选择器
- Replace existing / Force site name 两个选项
- 错误和成功状态显示

### 6.2 OPML 导出

**`opml_export.rs`**：
- 生成标准 OPML 2.0 XML
- XML 转义处理（`& < > " '`）
- `OpmlExporter::export()` → 写入文件

**前端** `FeedList.tsx`：
- `...` 菜单 → Export OPML → Tauri dialog `save()` → 原生保存对话框

---

## 七、关键 Bug 修复

| 问题 | 原因 | 修复 |
|------|------|------|
| 点文章右侧无反应 | `ReaderDetailView` 从 `useAppStore` 读 `selectedEntryId`，但 `EntryListView` 写入 `useEntryStore` | 统一改为从 `useEntryStore` 读取 |
| Reader 模式无内容 | Rust 参数 `entry_url` 与前端 `entryUrl` 蛇形/驼峰不匹配 | 统一为 `entryUrl`（驼峰） |
| 添加无效 URL 不报错 | `useFeedStore.addFeed` catch 后只存 error 不 throw | 改为 `throw err` 重新抛出 |
| Check 不覆盖已有标题 | `!title` 条件阻止更新 | 去掉条件，始终更新 |
| 删除订阅源文章列表不消失 | 未调 `clearEntries()` | 删除时同时清空 + 跳回 All Feeds |
| OPML 导入标题带 .net | `force_site_name` 直接用 URL hostname 作标题 | 改为走 `resolve_title` 使用 Feed XML 标题 |
| Browse 按钮无效 | `@tauri-apps/plugin-dialog` 类型解析问题 | 改用 `import * as dialog` + `dialog.open()` |
| 端口 1420 占用导致启动失败 | 旧进程未完全退出 | 用 `node process.kill(PID)` 杀掉 |

---

## 八、技术架构

### 前后端数据流

```
React 组件 → useXxxStore → lib/ipc.ts → Tauri invoke() → Rust command → Store trait → SQLite
                    ↑                                                        ↓
                    └────────── Result<T, AppError> ←────────────────────────┘
```

### 关键 trait 接口

```rust
#[async_trait]
pub trait FeedStore: Send + Sync {
    async fn load_all(&self) -> Result<Vec<Feed>, AppError>;
    async fn upsert(&self, feed: Feed) -> Result<Feed, AppError>;
    async fn delete(&self, id: i64) -> Result<(), AppError>;
    async fn find_by_url(&self, url: &str) -> Result<Option<Feed>, AppError>;
}

#[async_trait]
pub trait EntryStore: Send + Sync {
    async fn load_page(&self, query: EntryListQuery) -> Result<EntryPage, AppError>;
    async fn load_next_page(&self, cursor: PageCursor) -> Result<EntryPage, AppError>;
    async fn mark_read(&self, ids: &[i64], is_read: bool) -> Result<(), AppError>;
    async fn mark_starred(&self, id: i64, is_starred: bool) -> Result<(), AppError>;
    async fn delete_entry(&self, id: i64) -> Result<(), AppError>;
    async fn search(&self, text: &str, scope: SearchScope) -> Result<Vec<EntryListItem>, AppError>;
    async fn upsert_entries(&self, feed_id: i64, entries: &[EntryUpsertData]) -> Result<usize, AppError>;
}
```

### IPC 命令清单

| 域 | 命令 | 功能 |
|------|------|------|
| Feed | `add_feed` | 添加订阅源 |
| Feed | `get_feeds` | 获取全部订阅源 |
| Feed | `update_feed` | 编辑订阅源 |
| Feed | `delete_feed` | 删除订阅源 |
| Feed | `sync_feeds` | 同步全部订阅源 |
| Feed | `probe_feed` | 验证 Feed URL 并返回标题 |
| Feed | `import_opml` | 导入 OPML |
| Feed | `export_opml` | 导出 OPML |
| Entry | `load_entries` | 加载文章列表（首页） |
| Entry | `load_next_entries` | 加载下一页 |
| Entry | `mark_read` | 标记已读/未读 |
| Entry | `mark_starred` | 标记收藏 |
| Entry | `delete_entry` | 软删除文章 |
| Entry | `search_entries` | 搜索文章 |
| Reader | `build_reader_html` | 构建阅读器 HTML |
| Reader | `get_available_fonts` | 获取可用字体列表 |

---

## 九、当前状态

| 功能 | 状态 |
|------|------|
| 添加/删除 RSS 订阅源 | ✅ 完成 |
| Check 验证 + 自动填标题 | ✅ 完成 |
| 无效 URL / 重复订阅检测 | ✅ 完成 |
| 文章列表（游标分页、未读、收藏） | ✅ 完成 |
| 自动标记已读 | ✅ 完成 |
| Reader 模式（fetch→Markdown→渲染） | ✅ 完成 |
| Web 模式（iframe 原网页） | ✅ 完成 |
| Dual 模式（左右分栏对照） | ✅ 完成 |
| OPML 导入（文件对话框 + 批量添加） | ✅ 完成 |
| OPML 导出（保存对话框 + 生成 XML） | ✅ 完成 |
| 主题切换 | 待实现 |
| AI 摘要/翻译/标签 | 待实现 |
| 笔记与文摘 | 待实现 |
| 标签系统 | 待实现 |
| 用量统计 | 待实现 |

---

## 十、验证结果

| 验证项 | 结果 |
|--------|------|
| `cargo check` | 0 错误，6 警告（均为未读字段） |
| `npx tsc --noEmit` | 0 错误 |
| `npx vite build` | 成功 |
| 手动：添加 RSS 源 | 正常 |
| 手动：文章列表 + 点击加载 | 正常 |
| 手动：Reader / Web / Dual 三模式 | 正常 |
| 手动：OPML 导入导出 | 正常 |
| 手动：重启持久化 | 正常 |
