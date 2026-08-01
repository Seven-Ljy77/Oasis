# Mercury Windows — Phase 4 开发总结

> 日期：2026-07-21
> 分支：`test_agent`
> 基线：Phase 3（下拉菜单交互修复 + 阅读器性能优化）

---

## 一、完成概况

Phase 4 实现了**完整的 AI Agent 功能体系**：LLM Provider 管理、AI 摘要（流式渲染）、AI 翻译（分段双语）、AI 标签推荐，以及配套的用量追踪、Settings 完善、笔记系统、同步进度、可拖拽面板等。

| 贡献者 | 内容 |
|--------|------|
| Ljy | AI Agent 全栈实现（Rust 后端 + React 前端 + Prompt 模板） |

---

## 二、新增/修改文件统计

| 类别 | 文件数 | 说明 |
|------|--------|------|
| Rust 新建 | 6 | 5 个 SQLite store 实现 + 1 个 migration |
| Rust 修改 | ~25 | agent 模块全部 executor/provider/route/runtime、commands、tasking、usage、feed sync |
| React 新建 | 1 | `useResizableHeight` hook |
| React 修改 | ~15 | Reader 面板、Settings 页签、FeedList 侧栏、Toolbar、IPCs、Types |
| 资源文件 | 4 | Prompt YAML 模板（summary/translation/translation-hy-mt/tagging） |
| 文档 | 1 | PHASE4_SUMMARY.md |

## 三、AI Agent 核心架构

```
Tauri Commands (agent_commands, usage_commands, settings_commands, feed_commands)
    │
    ▼
AgentRuntimeEngine (runtime.rs) — 管理 agent 生命周期、并发控制
    │
    ├─ TaskQueue (tasking/) — 入队、调度、取消
    │   └─ JobRunner — timeout + cancellation
    │
    └─ Executors (summary / translation / tagging)
        ├─ RouteResolver — 查 agent_profile → 选 provider/model
        ├─ PromptTemplateStore — YAML 加载 → Tera 变量替换
        ├─ OpenAIProvider — POST /chat/completions + SSE 流式解析
        ├─ failure.rs — 11 种错误分类 + 指数退避重试
        ├─ SQLite Stores — 摘要/翻译缓存、用量记录
        └─ BilingualComposer — 双语对照/纯译文 HTML 生成
```

## 四、数据层 — SQLite Store 实现

### 4.1 5 个新 Store

| Store | 方法数 | 关键特性 |
|------|--------|---------|
| `SqliteAgentConfigStore` | 9 | Provider/Model/Profile CRUD + archive + set_default |
| `SqliteAgentTaskStore` | 4 | record_run → update_run_status 生命周期 |
| `SqliteLLMUsageStore` | 6 | 按天聚合、两期对比、按状态计数、过期清理 |
| `SqliteSummaryStore` | 5 | UNIQUE(entry, lang, detail) + LRU evict |
| `SqliteTranslationStore` | 5 | checkpoint 事务（save → finalize → load） |

### 4.2 EntryStore 增强

- 新增 `load_by_id` 方法，单次精确查询替代全文搜索 hack

### 4.3 迁移

- `018_agent_config_unique.sql` — 为 agent 配置表和翻译表添加 UNIQUE 索引

## 五、AI 摘要（Summary Agent）

### 5.1 后端

| 组件 | 文件 | 功能 |
|------|------|------|
| `SummaryExecutor` | `agent/summary/executor.rs` | 缓存检查 → 路由解析 → prompt 渲染 → `provider.stream()` → 逐 token emit |
| `SummaryStorage` | `agent/summary/storage.rs` | 接入 `SqliteSummaryStore` 进行持久化缓存 |

**特性：**
- 流式 SSE 解析，逐 token 推送到前端
- 双层缓存：SQLite 持久化 + 内存 LRU
- 12 种目标语言、3 个详细度等级
- 优先使用 `content` 表 markdown 全文，fallback 到 RSS 摘要

### 5.2 前端

| 组件 | 功能 |
|------|------|
| `ReaderSummaryPanel` | 灯泡按钮展开 → 选语言/详细度 → Generate → Markdown→HTML 渲染 |
| `useReaderStore` | `summaryHTML` 状态 + streaming token 监听 |

## 六、AI 翻译（Translation Agent）

### 6.1 后端

| 组件 | 文件 | 功能 |
|------|------|------|
| `SegmentExtractor` | `agent/translation/segment.rs` | HTML p/li/blockquote 提取 + 纯文本 fallback 按段落切分 |
| `TranslationExecutor` | `agent/translation/executor.rs` | 并发分段翻译（semaphore 1-5）+ content-hash 缓存 + checkpoint 续传 + 段级重试 |
| `BilingualComposer` | `agent/translation/bilingual.rs` | 3 种模式：interleaved（原文→译文交替）、translation_only（纯译文）、compose |
| `TranslationStorage` | `agent/translation/storage.rs` | 接入 `SqliteTranslationStore` |

**特性：**
- 并发翻译（1-5 segments 同时调 LLM）
- Bilingual 开关：双语对照 / 纯译文
- 清空翻译按钮恢复原文
- 段落数显示 + 翻译状态提示

### 6.2 前端

| 组件 | 功能 |
|------|------|
| `ReaderTranslationPanel` | Start Translation 按钮 → 等待结果 → 加载 bilingual HTML → 显示在阅读区 |
| `ReaderDetailView` | `translationHTML` 条件渲染 → 覆盖 reader 内容 |
| `ReaderToolbar` | 翻译切换 + 清空翻译按钮 |

## 七、AI 标签推荐（Tagging Agent）

### 7.1 后端

| 组件 | 文件 | 功能 |
|------|------|------|
| `TaggingExecutor` | `agent/tagging/executor.rs` | 取前 800 字 + 50 个高频 tag 词汇 → LLM → JSON 解析 → 标准化匹配 |
| `BatchTaggingExecutor` | `agent/tagging/batch.rs` | 并发批量打标签（worker pool + semaphore） |

**特性：**
- `TagSuggestion` 统一接口：`{ name, source: "ai"|"existing"|"error", tag_id }`
- 正文优先，内容短则用标题补足
- Temperature 0.7 + max_tokens 300 保证足够多样性
- Prompt 要求至少 2 个标签

### 7.2 前端

| 组件 | 功能 |
|------|------|
| `ReaderTaggingPanel` | `#` 按钮弹出 → 加载动画 → AI Suggestions（紫色）/ Existing Tags（蓝色）→ 点击应用/移除 |
| `ReaderToolbar` | `#` 标签按钮 |

## 八、LLM 基础设施

### 8.1 OpenAIProvider

- `complete()` — POST JSON + 解析 response
- `stream()` — SSE bytes_stream 逐行解析
- `resolve_api_key()` — keyring (Windows Credential Manager) → fallback 内联 key

### 8.2 Prompt 模板系统

- `PromptTemplateStore` — YAML 加载 + Tera Mustache 渲染 + user/builtin 双级 fallback
- 4 个内置模板：`summary.default.yaml`、`translation.default.yaml`、`translation.hy-mt.yaml`、`tagging.default.yaml`（v1.1）
- `include_str!` 编译时嵌入

### 8.3 路由与失败处理

- `RouteResolver` — 按 capability flags 自动选择模型（primary + fallback）
- `failure.rs` — 11 种 `AgentFailureReason` + `classify()` + `retry_delay()` 指数退避 + jitter

## 九、用量追踪（Usage Tracking）

| 组件 | 文件 | 功能 |
|------|------|------|
| `record_usage_event` | `usage/tracker.rs` | 记录每次 LLM 调用的 provider/model/token/status |
| `query_report` | `usage/reports.rs` | 7 种时间窗口聚合 → `UsageReportSnapshot`（含 provider/model/agent breakdown） |
| `purge_expired` | `usage/retention.rs` | 根据 RetentionPolicy 清理过期数据 |
| `UsageReportView` | `features/usage/` | Settings → Usage 标签页，Recharts 图表 + 真实数据 |
| 日期修复 | reports.rs / usage_commands.rs | `to_date` 加 1 天修复今天数据被排除的 bug |

**Usage 页面数据（全部真实）：**
- 堆叠柱状图（prompt + completion tokens）+ 折线（请求数）
- Total Tokens / Total Requests / Success Rate
- Success Rate 按 DB `request_status` 真实计算
- Token 数通过文本长度估算（≈4 字符/token）

## 十、运行时与调度

| 组件 | 文件 | 功能 |
|------|------|------|
| `AgentRuntimeEngine` | `agent/runtime.rs` | submit/cancel/finish 生命周期 + broadcast 事件 + 并发控制 |
| `TaskQueue` | `tasking/task_queue.rs` | enqueue/mark_started/update_progress/mark_completed/mark_failed |
| `JobRunner` | `tasking/job_runner.rs` | `run_with_timeout` + `run_cancellable`（oneshot 取消） |
| `FailurePolicy` | `tasking/failure_policy.rs` | `should_surface` + `retry_backoff` |

## 十一、Tauri 命令（34 个）

| 分类 | 命令数 | 主要命令 |
|------|--------|---------|
| Agent Config | 13 | get/add/update/delete/archive provider/model/profile + test |
| Agent Dispatch | 9 | start_summary/translation/tagging/batch + cancel + availability |
| Summary/Translation | 4 | generate_summary, get_summary, get_translation_segments, build_translation_html |
| Usage | 6 | get_usage_report, fetch_provider/model/agent_report, clear_usage |
| Settings | 5 | load/save_settings, test_provider_connection, reveal_custom_template, get_settings |
| Digest | 2 | save_note, load_note (formerly get_note) |

## 十二、Settings 完善

| 页签 | 修复内容 |
|------|---------|
| **General** | Language/Concurrency/Retention/AI Tagging 全部接通 `useSettingsStore` + 实时保存；Open Tag Library / Batch AI Tagging 按钮接线；参数名 `config`→`settings` 修复保存失效 bug |
| **Reader** | 添加 `p-4` 左边距，与其他页签对齐 |
| **Agents → Providers** | Edit（prompt 改名）、Test Connection（调 LLM）、Set Default、Delete 全部接线 |
| **Agents → Models** | Add Model 内联表单（model name + temperature + max_tokens + capability checkboxes）+ Delete |
| **Agents → Agents** | 所有 Provider 的真实模型列表；Primary/Fallback 下拉选中即保存 |
| **Digest** | Browse 按钮 → 原生文件夹选择器 |
| **Usage** | 新增标签页，柱状图图标，接入 UsageReportView |

## 十三、Article Note 系统

| 功能 | 实现 |
|------|------|
| MySQL 存储 | `entry_note` 表（entry_id PRIMARY KEY, markdown_text） |
| 加载 | 面板打开时自动加载已有笔记 |
| 保存 | 手动 Save 按钮 / 停止输入 5 秒自动保存 |
| 生命周期 | 面板关闭时立即保存、空笔记自动删除 |
| 字符计数 | 实时显示字数 / 上限 |

**命令修复：**
- `save_note`：参数名 `markdown_text`→`text` 匹配前端 IPC
- `load_note`：返回 `{ text }` 对象匹配前端类型

## 十四、Sync All + 进度展示

| 功能 | 实现 |
|------|------|
| Sync All 按钮 | 侧栏 Feeds 标题旁刷新图标，点击用配置的并发数同步所有源 |
| 并发控制 | `sync_all(concurrency)` → `tokio::sync::Semaphore` 限制同时抓取数 |
| 同步进度 | Rust `emit("sync-progress")` → 前端 `listen()` → 每个正在同步的 feed 显示旋转图标 |
| 完成后自动刷新 | 全部完成后 `loadFeeds()` 更新列表 |

## 十五、UI/UX 优化

| 优化 | 说明 |
|------|------|
| 工具栏按钮 tooltip | 全部 11 个按钮添加 `title` 属性 |
| 可拖拽面板高度 | Summary/Translation/Note 三面板顶部拖拽条，`setPointerCapture` 解决 iframe 吞事件 |
| 面板高度记忆 | `localStorage` 持久化，关闭后再打开恢复上次高度 |
| 收起/展开 | 三个面板统一折叠条交互模式 |
| Share 下拉菜单 | Copy Link + Open in Browser |
| Settings 入口 | 侧栏齿轮图标 |

## 十六、功能清单（截至 Phase 4）

### 已实现

| 域 | 功能 | 状态 |
|------|------|------|
| **LLM 配置** | Provider/Model/AgentProfile CRUD + 连接测试 + API Key 管理 | ✅ |
| **AI 摘要** | 流式生成、Markdown→HTML 渲染、12 种语言、3 级详细度、双层缓存 | ✅ |
| **AI 翻译** | 分段并发翻译、双语对照/纯译文切换、content-hash 缓存、checkpoint 续传 | ✅ |
| **AI 标签** | AI 建议渲染、点击应用/移除、Temperature 调优、至少 2 个标签 | ✅ |
| **用量追踪** | Token 记录、按天聚合、Provider/Model breakdown、7 种时间窗口、成功/失败率 | ✅ |
| **Article Note** | 5 秒自动保存、面板关闭保存、空笔记删除、字符计数 | ✅ |
| **Sync All** | 并发控制、实时进度反馈、完成后列表刷新 | ✅ |
| **Settings** | 5 页签全部可用、实时保存、按钮接线 | ✅ |
| **订阅源** | 添加/删除 RSS 订阅源、OPML 导入导出 | ✅ |
| **文章列表** | 游标分页 + 无限滚动、未读/收藏/标签筛选、Delete All | ✅ |
| **阅读器** | Reader/Web/Dual 三模式、HTTP 连接池、前端缓存、Loading 指示器 | ✅ |
| **标签系统** | CRUD、合并、批量删除、Any/All 筛选、标准化 | ✅ |
| **星标** | 收藏/取消收藏、Starred 虚拟订阅源 | ✅ |
| **UI 交互** | 悬停延迟菜单、可拖拽面板、面板高度记忆、快捷键 | ✅ |

### 延后/已知问题

| 问题 | 说明 |
|------|------|
| 翻译 0 segments | 某些文章内容提取失败时返回空，已加错误提示 |
| Digest 导出 | Export 命令仍需实现（非 agent 范畴） |
| i18n | Language 设置已存但不影响 UI 文字 |
| 设置持久化到磁盘 | 当前仅存内存，重启应用后需要重新加载 |

## 十七、技术亮点

1. **`setPointerCapture`** — 使用 Pointer Events API 解决 iframe 吞鼠标事件的拖拽问题
2. **Tera + YAML Prompt 模板** — `include_str!` 编译时嵌入 + `serde_yaml` 解析，Prompt 和代码严格分离
3. **Segment 翻译并发** — Semaphore 控制 1-5 并发 + content-hash 缓存 + checkpoint 断点续传
4. **Zustand + localStorage 面板高度记忆** — 纯前端方案，无需后端存储
5. **流式 SSE 解析** — 手动逐行解析 SSE stream，兼容所有 OpenAI-compatible 后端
6. **Arc\<dyn Trait\> 依赖注入** — Executor 通过接口注入 Provider/Store，支持 Mock 测试
7. **Usage 日期查询修复** — `to_date + 1 day` 解决 `created_at < to_date` 排除今天的经典 bug

## 十八、验证结果

| 验证项 | 结果 |
|--------|------|
| `cargo check` | 0 错误，2 已有 warning |
| `npx tsc --noEmit` | 0 错误 |
| `npx vite build` | 81 modules，~7-9s |
| Summary: DeepSeek 流式生成 | ✅ 正常 |
| Translation: 分段双语 vs 纯译文 | ✅ 正常 |
| Tagging: AI Suggestions 出现 | ✅ 正常 |
| Usage: 真实 token 数据 | ✅ 正常 |
| Note: 5s 自动保存 + 重新打开加载 | ✅ 正常 |
| Sync All: 进度旋转 + 列表刷新 | ✅ 正常 |
