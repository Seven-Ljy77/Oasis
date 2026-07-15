# Mercury Windows — Phase 2 开发总结

> 日期：2026-07-14
> 分支：`windows`
> 基线：Phase 1（订阅源管理 + 阅读器三模式 + OPML 导入导出）

---

## 一、完成概况

Phase 2 实现了**标签系统（完整 CRUD + 筛选 + 合并 + 批量操作）**、**星标系统修复**、**文章批量管理**，以及大量 bug 修复和 UI 打磨。

| 贡献者 | 内容 |
|--------|------|
| Sly | 标签系统初始实现（TagStore、Tag 命令、TagFilter UI、ReaderTaggingPanel、星标标记） |
| Ljy | 代码 Review（21 个问题发现）、标签系统全面修复、标签合并、批量删除、Delete All、UI 交互优化、数据库修复 |

---

## 二、新增/修改文件统计

| 类别 | 文件数 | 说明 |
|------|--------|------|
| Rust 新增 | 3 | tag_store 完整实现、tag_commands 12 个命令、normalization |
| Rust 修改 | ~10 | entry_store（upsert/delete 修复）、feed_commands、reader_commands、lib.rs、state.rs、manager.rs、migrations.rs |
| React 新增 | 1 | TagMergeSheet |
| React 修改 | ~12 | TagFilter、ReaderTaggingPanel、ReaderToolbar、ReaderDetailView、FeedList、EntryListView、useAppStore、useTagStore、useFeedStore、useEntryStore、useSidebarStore、ipc.ts |
| SQL 迁移 | 2 | 016_cleanup_empty_tags、017_undelete_entries |

---

## 三、标签系统

### 3.1 数据库层

**SqliteTagStore** (`db/tag_store.rs`，480+ 行)：

| 方法 | 功能 |
|------|------|
| `load_all()` | 加载全部标签 |
| `create(name)` | 创建标签（含同名检测、标准化） |
| `rename(id, new_name)` | 重命名标签 |
| `delete(id)` | 删除标签（级联清理别名和关联） |
| `merge(source_id, target_id)` | 合并标签：迁移文章关联 → 迁移别名 → 删除源标签 |
| `assign_to_entry(id)` | 给文章打标签 |
| `remove_from_entry(id)` | 移除文章标签 |
| `load_by_entry(id)` | 查文章的所有标签 |
| `add_alias / delete_alias` | 别名管理 |
| `delete_empty()` | 清理空名标签 |
| `recalculate_counts()` | 基于非删除文章重算所有标签计数 |

### 3.2 标签标准化

`normalization.rs`：
```
trim → to_lowercase → 统一分隔符(-, _, /, \)为空格 → 合并连续空格
```

示例：`"  AI-generated  "` → `"ai generated"`

### 3.3 Tauri 命令（12 个）

| 命令 | 功能 |
|------|------|
| `get_tags` | 获取全部标签（含别名） |
| `get_tag_library` | 获取标签库 |
| `create_tag` | 创建标签（拒绝空名） |
| `rename_tag` | 重命名 |
| `delete_tag` | 删除单个标签 |
| `merge_tag` | 合并标签 |
| `assign_tag` | 给文章打标签 |
| `remove_tag` | 移除文章标签 |
| `get_tags_for_entry` | 查文章标签 |
| `suggest_tags` | AI/NLP 标签建议（待实现） |
| `delete_tags_batch` | 批量删除标签 |
| `delete_unused_tags` | 删除计数为 0 的标签 |
| `recalculate_tag_counts` | 重算所有标签计数 |

### 3.4 侧栏标签筛选

**TagFilter** — Tags 面板：
- 搜索过滤（按名称）
- **Any / All** 匹配模式切换
- 多选标签（checkbox）
- 右键菜单：**Rename**、**Merge Into...**、**Delete**
- 选中标签后显示 **Clear selected** + **Delete selected** 批量操作
- **Delete unused** 一键清理未使用标签
- 每个标签显示 `usage_count`

### 3.5 阅读器标签面板

**ReaderTaggingPanel**：
- 逗号分隔输入多个标签
- AI 建议区（待后端 NLP/AI 实现）
- 已有标签区（点击即分配/移除）
- 创建新标签（自动标准化）
- 分配/移除后自动刷新全局标签计数

### 3.6 标签合并

**TagMergeSheet**：
- 右键标签 → **Merge Into...** → 弹窗
- 源标签只读显示
- 可搜索目标标签（含文章数）
- 确认后：迁移文章关联 + 迁移别名 → 删除源标签

---

## 四、星标系统修复

**组员提交 `859925a`** — 星标标记功能：
- ReaderToolbar 添加星标按钮，连通 `markStarred` IPC
- ReaderDetailView 传 `entryId`、`isStarred`、`onStar` props 给 Toolbar
- Sidebar 中 `selectedFeedSelectionType` 用于 Starred 高亮判断

**后续修复**：
- All Feeds / Starred / 具体订阅源的选中状态独立（修复重复高亮）
- `useEntryStore.markStarred` 乐观更新（前端立即反馈，后端异步确认）

---

## 五、文章批量删除（Delete All）

**EntryListView** — `...` 菜单新增 Delete All：

- 删除**所有订阅源**（级联删除所有文章）
- 重算标签计数
- 刷新标签列表
- 清空文章列表、跳转 All Feeds
- 二次确认弹窗

---

## 六、数据库关键修复

| 问题 | 原因 | 修复 |
|------|------|------|
| Delete All 后重新导入文章被静默忽略 | `INSERT OR IGNORE` 见到已存在（已软删除）的条目直接跳过 | 改为 `ON CONFLICT ... DO UPDATE SET is_deleted = 0` |
| 标签计数不随软删除更新 | 计数器未过滤 `is_deleted` | 新增 `recalculate_counts()`，JOIN entry 过滤 |
| 启动时存在已软删除条目 | 之前 Delete All 遗留 | 启动时自动 `UPDATE entry SET is_deleted = 0` |
| 空名标签 | 早期创建时未校验 | 迁移 016 清理 + `create_tag` 拒绝空名 |

---

## 七、代码 Review 与 Bug 修复

### 组员代码 Review 发现（21 个问题）

**Rust 端（11 个）**：

| 严重性 | 问题 | 修复 |
|--------|------|------|
| 中高 | `add_alias` 用 `map_err(\|_\|)` 吞所有 DB 错误 | 区分 `QueryReturnedNoRows` vs 真错误 |
| 中 | `create_tag` 绕过 TagStore 直连 DB | 删除绕过代码 |
| 中 | `get_tags_for_entry` N+1 查询 | 记录为优化项 |
| 中 | `Err(_) => continue` 静默吞错 | NotFound 跳过，其余 propagate |
| 中 | `merge` 丢失 attribution | 记录为已知行为 |
| 低 | `tags_are_equal` 死代码 | 删除 |
| 低 | O(n*m) 别名分组 | 记录为优化项 |

**React 端（10 个）**：

| 严重性 | 问题 | 修复 |
|--------|------|------|
| Bug | `deleteFeed` 未 await，UI 假成功 | 加 `await` |
| Bug | `handleApplyTag` forEach 并行竞态 | 改 `for...of` 串行 |
| 性能 | `entries` 订阅导致键盘监听器反复重建 | 改用 `getState()` |
| 性能 | 未用的 `fontScale` 导致监听器重建 | 移除 |
| 死 UI | Clear translation / Theme 按钮无 onClick | 加占位 handler |
| 死代码 | `useCallback` 未使用 | 删除 |

### 后续发现并修复

| 问题 | 修复 |
|------|------|
| 标签名显示为空 | `TagWithAliases` 嵌套序列化 → 加 `#[serde(flatten)]` |
| Tag All/Any 模式不生效 | `tagMatchMode` 读写 useAppStore 而非 useSidebarStore |
| 标签 Rename 不工作 | 未传 tag ID → 加 `renameTargetTagId/Name` 到 app store |
| `...` 下拉菜单太灵敏 | 加 250ms 延迟隐藏 |
| Starred 按钮高亮不独立 | 统一使用 `selectedFeedSelectionType` |

---

## 八、功能清单

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
| **阅读器** | Reader 模式（fetch→Markdown→comrak渲染） | ✅ |
| | Web 模式（iframe 原网页） | ✅ |
| | Dual 模式（左右分栏） | ✅ |
| | ReadingModePicker 三模式切换 | ✅ |
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
| 阅读器 | Readability.js 清洗、主题切换、字体自定义 |
| AI | LLM 配置、摘要、翻译、标签智能体 |
| 标签 | 标签库管理 UI、标签关联推荐、批量打标签、本地 NLP |
| 笔记 | 文摘笔记编辑、分享/导出 |
| 用量 | Token 统计图表 |
| 其他 | Obsidian 管线、自动更新、多语言 |

---

## 九、技术亮点

1. **`#[serde(flatten)]` 解决前端类型不匹配** — Rust 嵌套结构体平铺为 JS 平级字段
2. **`ON CONFLICT ... DO UPDATE` 防重复导入** — 软删除条目重新导入时自动恢复
3. **启动时自动恢复 + 重算** — 数据库级容错，不依赖前端状态
4. **Zustand 多 Store 协调** — 通过 `getState()` 避免不必要的订阅重渲染
5. **标签操作后自动刷新全局计数** — assign/remove/delete 均触发 `recalculate_counts`

---

## 十、验证结果

| 验证项 | 结果 |
|--------|------|
| `cargo check` | 0 错误，7 警告 |
| `npx tsc --noEmit` | 0 错误 |
| `npx vite build` | 成功 |
| 手动：标签 CRUD + 筛选 | 正常 |
| 手动：标签合并 | 正常 |
| 手动：Delete All + 重新导入 | 正常 |
| 手动：阅读器三模式 | 正常 |
| 手动：OPML 导入导出 | 正常 |
