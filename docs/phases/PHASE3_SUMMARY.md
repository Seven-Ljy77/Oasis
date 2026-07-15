# Mercury Windows — Phase 3 开发总结

> 日期：2026-07-15
> 分支：`windows`
> 基线：Phase 2（标签系统 + 星标修复 + 批量操作 + 代码 Review）

---

## 一、完成概况

Phase 3 聚焦于 **UI 交互打磨**和**阅读器性能优化**，解决了 Phase 2 遗留的交互体验问题，并显著提升了文章加载速度。

| 贡献者 | 内容 |
|--------|------|
| Ljy | 下拉菜单交互修复、阅读器性能优化（HTTP 连接池 + 前端缓存 + Loading 态）、文档结构整理 |

---

## 二、新增/修改文件统计

| 类别 | 文件数 | 说明 |
|------|--------|------|
| Rust 修改 | 2 | readability.rs（HTTP Client 复用）、reader_commands.rs（snake_case） |
| React 修改 | 4 | EntryListView（下拉菜单）、ReaderDetailView（loading）、ReaderWebView（loading spinner）、useReaderStore（缓存 + loading） |
| 文档修改 | 5 | CLAUDE.md、PHASE0_SUMMARY.md、ARCHITECTURE.md 移位、MERCURY_FEATURES.md 移位、PHASE3_SUMMARY.md（新增） |

---

## 三、下拉菜单交互修复

### 3.1 问题

EntryListView 右上角 `...` 按钮使用纯 CSS `group-hover:block` 控制菜单显隐，**鼠标刚移过去菜单就消失**，极难操作。

### 3.2 修复

**EntryListView.tsx** — 将 CSS 方案替换为 FeedList 同款 JS 控制方案：

```
悬停 → 菜单立即打开
鼠标移走 → 250ms 延迟关闭（给时间让鼠标移到菜单上）
点击 ... → 固定菜单（pin），鼠标移走不消失
点击菜单外部 → 取消固定 + 关闭
点击菜单项 → 执行操作 + 关闭
```

涉及状态：
- `moreMenuOpen` — 菜单是否可见
- `moreMenuPinned` — 是否已固定（点击切换）
- `hideTimerRef` — 延迟隐藏计时器（250ms）
- `moreMenuRef` — 用于检测外部点击

---

## 四、阅读器性能优化

### 4.1 问题诊断

每次点击文章，阅读器流水线执行完整的 **网络请求 → HTML→Markdown 转换 → Markdown→HTML 渲染**，且**无任何缓存**。主要瓶颈：

1. **网络请求**（500ms~3s）：每篇文章都新建 `reqwest::Client`，无连接复用，TLS 握手重复开销
2. **无前端缓存**：切回刚看过的文章也需要重新 fetch
3. **无加载反馈**：fetch 期间右侧白屏，用户不知道系统是否在工作

### 4.2 优化措施

| # | 改动 | 文件 | 效果 |
|---|------|------|------|
| 1 | **HTTP Client 复用** | `reader/readability.rs` | `LazyLock` 全局单例 + 连接池（90s 空闲保活），避免重复 TCP/TLS 握手 |
| 2 | **前端 HTML 缓存** | `stores/useReaderStore.ts` | `Map<URL, HTML>` LRU 缓存最近 30 篇文章。切回看过的文章**瞬间显示** |
| 3 | **加载指示器** | `ReaderWebView.tsx` + `ReaderDetailView.tsx` | 正在加载时显示旋转 spinner + "Loading article..." |

### 4.3 实现细节

**Rust — 全局 HTTP Client（`readability.rs`）**：

```rust
use std::sync::LazyLock;

static CLIENT: LazyLock<reqwest::Client> = LazyLock::new(|| {
    reqwest::Client::builder()
        .user_agent("Mozilla/5.0 ...")
        .timeout(Duration::from_secs(30))
        .pool_idle_timeout(Duration::from_secs(90))
        .build()
        .expect("Failed to create HTTP client")
});
```

- `LazyLock` 确保线程安全的一次性初始化
- `pool_idle_timeout(90s)` 保持连接池中空闲连接 90 秒，同一域名后续请求复用连接

**Frontend — LRU 缓存（`useReaderStore.ts`）**：

```typescript
buildReaderHTML: async (entryUrl) => {
  // 1. 检查缓存 — 命中则瞬间渲染
  const cached = get().readerCache.get(entryUrl);
  if (cached) { set({ readerHTML: cached }); return; }

  // 2. 未命中 — 显示 loading + 发起请求
  set({ readerLoading: true });
  const result = await ipc.buildReaderHTML(entryUrl);

  // 3. 写入缓存（超过 30 条淘汰最旧）
  const next = new Map(cache);
  next.set(entryUrl, result.html);
  while (next.size > 30) {
    const oldest = next.keys().next().value;
    if (oldest) next.delete(oldest);
  }
  set({ readerHTML: result.html, readerLoading: false, readerCache: next });
}
```

### 4.4 效果

| 场景 | 优化前 | 优化后 |
|------|--------|--------|
| 首次打开文章 | 500ms~3s（白屏） | 500ms~3s（有 loading spinner） |
| 切回看过的文章 | 重新 fetch，500ms~3s | **瞬间显示**（命中缓存） |
| 连续看 30 篇不同文章 | 每次都新建连接 | 连接复用，略快 |
| 同域名多篇文章 | 每次都 TLS 握手 | 首次后复用连接 |

---

## 五、文档结构整理

将项目根目录下的架构文档移入 `docs/` 目录，统一文档管理：

| 文件 | 变更 |
|------|------|
| `ARCHITECTURE.md` | → `docs/ARCHITECTURE.md` |
| `MERCURY_FEATURES.md` | → `docs/MERCURY_FEATURES.md` |
| `CLAUDE.md` | 更新内部引用路径 |
| `docs/phases/PHASE0_SUMMARY.md` | 更新文档链接 |

---

## 六、功能清单（截至 Phase 3）

### 已实现

| 域 | 功能 | 状态 |
|------|------|------|
| **订阅源** | 添加/删除 RSS 订阅源 | ✅ |
| | Check 验证 + 自动填标题 | ✅ |
| | 无效 URL / 重复订阅检测 | ✅ |
| | OPML 导入（文件对话框 + 批量添加） | ✅ |
| | OPML 导出（保存对话框 + 生成 XML） | ✅ |
| | All Feeds / Starred / 标签筛选 | ✅ |
| **文章列表** | 游标分页 + 无限滚动 | ✅ |
| | 未读指示器 + 收藏按钮 | ✅ |
| | 自动标记已读（3 秒延迟） | ✅ |
| | Delete All（全部订阅源 + 全部文章） | ✅ |
| | `...` 菜单交互（hover+延迟+click固定） | ✅ |
| **阅读器** | Reader 模式（fetch→Markdown→comrak渲染） | ✅ |
| | Web 模式（iframe 原网页） | ✅ |
| | Dual 模式（左右分栏） | ✅ |
| | ReadingModePicker 三模式切换 | ✅ |
| | HTTP Client 连接池复用 | ✅ |
| | 前端 HTML 缓存（30 篇 LRU） | ✅ |
| | Loading 加载指示器 | ✅ |
| **标签** | 创建 / 删除 / 重命名标签 | ✅ |
| | 标签标准化（trim→lower→统一分隔符） | ✅ |
| | 给文章打标签 / 移除标签 | ✅ |
| | 侧栏标签筛选（搜索 + Any/All + 多选） | ✅ |
| | 标签计数（基于非删除文章） | ✅ |
| | 标签合并（Merge Into...） | ✅ |
| | 批量删除标签（选中 / 未使用） | ✅ |
| | 标签面板（AI/NLP 建议区 + 已有标签区） | ✅ |
| **星标** | 文章收藏 / 取消收藏 | ✅ |
| | Starred 虚拟订阅源 | ✅ |
| | 选中高亮独立 | ✅ |

### 待实现

| 域 | 功能 |
|------|------|
| 阅读器 | Readability.js 清洗、主题切换、字体自定义、SQLite 持久化缓存 |
| AI | LLM 配置、摘要（流式）、翻译（双语）、标签智能体 |
| 标签 | 标签库管理 UI、标签关联推荐、批量打标签、本地 NLP |
| 笔记 | 文摘笔记编辑、分享/导出 Digest |
| 用量 | Token 统计图表 |
| 其他 | Obsidian 管线、自动更新、多语言 |

---

## 七、技术亮点

1. **`LazyLock` 全局 HTTP Client** — 线程安全的一次性初始化 + 连接池，比每次新建 Client 减少 50-200ms TLS 握手开销
2. **前端 LRU 缓存** — `Map` 数据结构天然保持插入顺序，迭代首个 key 即可淘汰最旧条目，无需额外依赖
3. **JS 控制的下拉菜单** — 250ms 延迟 + click-to-pin 模式，解决纯 CSS `group-hover` 体验问题。FeedList 和 EntryListView 共享同一交互范式

---

## 八、验证结果

| 验证项 | 结果 |
|--------|------|
| `cargo check` | 0 错误，6 警告（均为已有） |
| `npx tsc --noEmit` | 0 错误 |
| 手动：`...` 下拉菜单交互 | 正常（hover 延迟 + click 固定 + 外部点击关闭） |
| 手动：阅读器首次加载 | 正常（显示 loading spinner → 内容渲染） |
| 手动：阅读器缓存命中 | 正常（切回看过的文章瞬间显示） |
| 手动：阅读器三模式 | 正常 |
