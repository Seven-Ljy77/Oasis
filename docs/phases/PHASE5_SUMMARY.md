# Mercury Windows — Phase 5 开发总结

> 日期：2026-07-22
> 分支：`windows`
> 基线：Phase 4（AI Agent 功能体系完成）

---

## 一、完成概况

Phase 5 聚焦于 **设置持久化、AI 标签控制、标签库完善、主题系统、键盘快捷键** 以及 **多项 UI/UX 改进**。

| 贡献者 | 内容 |
|--------|------|
| Ljy | 设置持久化、AI 标签开关、Tag Library 重写、主题系统（ThemeSwitcher + CSS 变量 + 缓存渲染）、可拖拽布局、搜索修复 |
| Sly | 键盘快捷键（从 test 分支 cherry-pick 合并） |

---

## 二、新增/修改文件统计

| 类别 | 文件数 | 说明 |
|------|--------|------|
| Rust 修改 | ~5 | settings_commands、tag_commands、reader_commands、feed_commands |
| React 新建 | 2 | ThemeSwitcher.tsx、useResizableWidth.tsx |
| React 修改 | ~12 | App.tsx、ReaderDetailView、ReaderToolbar、ReaderWebView、ReaderSettings、GeneralSettings、TagLibrarySheet、AgentSettingsView、EntryListView、ReaderTaggingPanel、FeedList、useKeyboardShortcuts |
| Store 修改 | 2 | useReaderStore、useSettingsStore |
| 配置修改 | 3 | tailwind.config.js、index.css、types.ts |
| 文档 | 1 | PHASE5_SUMMARY.md |

## 三、设置持久化

### 3.1 后端

文件：`src-tauri/src/commands/settings_commands.rs`

- `load_config_from_disk()` — 从 `%LOCALAPPDATA%/Mercury/mercury-config.json` 读取
- `save_config_to_disk()` — 保存到 JSON 文件
- `load_settings` — 启动时从磁盘加载，更新内存状态
- `save_settings` — 保存时写入磁盘，同步触发 retention 清理
- `lib.rs` 启动时调用 `load_config_from_disk()` 替代默认配置

**修复：** `save_settings` 参数名 `config` → `settings`，解决前端 `{ settings }` 无法匹配 Rust 参数的 bug。

## 四、AI 标签开关

### 4.1 前端

文件：`src/features/reader/ReaderTaggingPanel.tsx`

- 读取 `useSettingsStore.settings.ai_tagging_enabled`
- 关闭时显示 "AI tag suggestions are disabled. Enable in Settings → General."
- 开启时正常运作，加载动画只在开启时显示

### 4.2 后端

文件：`src-tauri/src/commands/tag_commands.rs`

- `suggest_tags` 命令读取 `state.config.read().await.ai_tagging_enabled`
- 关闭时跳过 TaggingExecutor 调用，直接返回 existing tags
- 开启时调用 AI 获取建议标签

## 五、Tag Library 重写

文件：`src/features/tags/TagLibrarySheet.tsx`

- **移除所有硬编码占位数据**，改用 `useTagStore.tagLibrary` 真实数据
- **Rename** → 内联编辑（点击 → 输入框 → OK/Cancel）
- **Merge** → 选择目标标签 → Confirm Merge → 调用 `mergeTag` IPC
- **Delete** → 二次确认 → 调用 `deleteTag` IPC
- **筛选** → All / Unused / Has Aliases（移除 Provisional）
- **搜索** → 按名称模糊过滤
- 打开时自动调用 `loadTagLibrary()` 加载最新数据

## 六、键盘快捷键合并

提交：`336e7ee` (cherry-pick `145675d` from test branch)

| 快捷键 | 功能 |
|--------|------|
| `J` / `K` | 上/下一篇文章 |
| `M` | 切换已读/未读 |
| `U` | 切换仅未读过滤器 |
| `S` | 收藏/取消收藏 |
| `V` | 在浏览器打开原文 |
| `Esc` | 关闭搜索/关闭 Sheet |
| `Ctrl+F` | 打开搜索（主页专属） |

**修复：**
- `searchText` 加入 `useEffect` 依赖数组，修复搜索输入不生效
- `Esc` 提到 `isEditableTarget` 之前，搜索框内也能关闭
- `Esc` 增加关闭 active Sheet 逻辑（Settings etc.）
- `Ctrl+F` 仅主页生效，Sheet 打开时跳过

## 七、主题系统（Reader Theme）

### 7.1 ThemeSwitcher 组件

文件：`src/features/reader/ThemeSwitcher.tsx`（从 test 分支复制并重写）

| 控件 | 范围 | 说明 |
|------|------|------|
| Appearance | Auto / Light / Dark / Eye Care | 全局应用颜色主题 |
| Reader Theme | Classic / Paper | 阅读器预设 |
| Font Size | 12-28px | +/- 按钮 + 点击数字直接输入 |
| Font Family | Georgia / Merriweather / Inter / JetBrains Mono | 下拉选择 |
| Line Height | 1.2-3.0 | +/- 按钮 + 点击直接输入 |
| Content Width | 400-1200px | +/- 按钮 + 点击直接输入 |

### 7.2 CSS 变量化主题

文件：`tailwind.config.js`、`src/styles/index.css`

- Tailwind 所有颜色类改用 CSS 变量（`var(--color-*)`）
- `.force-dark` / `.force-light` / `.force-eyecare` CSS 类切换全局颜色
- `setThemeMode` 修改 `document.documentElement.classList` 实现即时切换

### 7.3 缓存渲染优化

文件：`src-tauri/src/commands/reader_commands.rs`

- 新增 `try_render_from_cache()` — 从 `content` 表读取缓存 Markdown，跳过网络 fetch
- `build_reader_html` 接收 `theme` 参数（fontFamily/fontSize/lineHeight/contentWidth/quickStyle）
- Theme 变化时：先尝试缓存 → Markdown 重渲染（秒级），失败再走完整 pipeline

### 7.4 Quick Style 生效

文件：`src/features/settings/ReaderSettings.tsx`

| 模式 | 阅读器背景色 | 文字色 |
|------|-------------|--------|
| None | `#faf9f7` | `#1a1a1a` |
| Warm | `#fdf6e3` | `#5c4b2c` |
| Cool | `#f0f4f8` | `#2c3e50` |
| Slate | `#f5f5f5` | `#374151` |

- 后端 `ReaderThemeParams.quickStyle` 字段
- store `buildReaderHTML` 传递 quickStyle 到 IPC
- ReaderDetailView useEffect 监听 quickStyle 变化触发重建
- Preview 区域实时反映 quickStyle 颜色

### 7.5 Settings Reader 同步

- Font Family 选项与 ThemeSwitcher 统一（4 项）
- Content Width 统一为 px 单位（400-1200px），range slider 步长 40px
- Quick Style 预览区实时显示背景色 + 文字色变化

## 八、可拖拽三栏布局

文件：`src/hooks/useResizableWidth.tsx`、`src/App.tsx`

- 侧栏 ↔ 文章列表 ↔ 阅读器 三个区域通过竖向拖拽条调整宽度
- `useResizableWidth` hook，使用 Pointer Capture API（和面板拖拽同一方案）
- 宽度记忆到 `localStorage`，重启后恢复

## 九、其他修复和优化

| 修复 | 文件 | 说明 |
|------|------|------|
| 搜索不生效 | `EntryListView.tsx` | `searchText` 加入 `useEffect` 依赖 |
| 设置保存失效 | `settings_commands.rs` | 参数名 `config` → `settings` |
| ReaderWebView 黑屏 | `ReaderWebView.tsx` | 去除 iframe `key`，改为 `srcdoc` 自然更新 |
| 主题切换 loading | `reader_commands.rs` | 缓存 Markdown 跳过网络 fetch |
| Reader 右边距 | `ReaderSettings.tsx` | 添加 `p-4` 与其他页签对齐 |
| Digest Browse 按钮 | `DigestSettings.tsx` | 接通 Tauri dialog 文件夹选择器 |
| Settings 入口 | `FeedList.tsx` | 侧栏齿轮图标 |
| AgentSettings 按钮 | `AgentSettingsView.tsx` | Edit/Test/Set Default 接线 |

## 十、功能清单（截至 Phase 5）

### 已实现

| 域 | 功能 | 状态 |
|------|------|------|
| **主题系统** | Appearance 切换、Reader Theme 预设、字体/字号/行高/宽度自定义、Quick Style 色温 | ✅ |
| **布局** | 三栏可拖拽、面板可拖拽、高度记忆 | ✅ |
| **LLM 配置** | Provider/Model/AgentProfile CRUD + 连接测试 + API Key | ✅ |
| **AI 摘要** | 流式生成、Markdown→HTML、12 语言、3 详细度、双层缓存 | ✅ |
| **AI 翻译** | 分段并发、双语/纯译文、缓存、断点续传 | ✅ |
| **AI 标签** | AI 建议展示、标签开关控制、Tag Library 管理 | ✅ |
| **用量追踪** | Token 记录、按天聚合、Usage 标签页 | ✅ |
| **Note** | 5s 自动保存、面板开关保存、字符计数 | ✅ |
| **Settings** | 5 页签全部可用、设置持久化到磁盘 | ✅ |
| **快捷键** | J/K/M/U/S/V/Esc/Ctrl+F/Ctrl+D | ✅ |
| **Sync All** | 并发控制、进度反馈、列表刷新 | ✅ |
| **阅读器** | Reader/Web/Dual 三模式、缓存渲染、Loading 指示器 | ✅ |
| **标签系统** | CRUD、合并、批量删除、Any/All、标准化 | ✅ |
| **星标** | 收藏/取消、Starred 虚拟订阅源 | ✅ |

### 已知问题

| 问题 | 说明 |
|------|------|
| 翻译 0 segments | 某些文章内容提取失败 |
| Digest 导出 | Export 命令仍未实现 |
| i18n | Language 设置不改变 UI 文字 |
| Line Height 修改 | Settings 的 line-height range 和 ThemeSwitcher 的值范围略有差异 |

## 十一、验证结果

| 验证项 | 结果 |
|--------|------|
| `cargo check` | 0 错误，2 已有 warning |
| `npx tsc --noEmit` | 0 错误 |
| `npx vite build` | 81 modules |
| Quick Style 切换 | ✅ Warm/Cool/Slate 效果可见 |
| 设置持久化 | ✅ 重启后保持 |
| 拖拽布局 | ✅ 侧栏/文章列表/阅读器宽度可调 |
| 搜索 | ✅ Ctrl+F → 输入 → 结果更新 |
| 快捷键 | ✅ J/K/M/U/S/V 工作正常 |
