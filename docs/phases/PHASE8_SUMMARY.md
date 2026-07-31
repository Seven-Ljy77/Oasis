# Mercury Windows -- Phase 8 开发总结

> 日期：2026-07-31
> 分支：`windows`
> 基线：Phase 7（Readability.js 清洗 + i18n + Dark Mode + 侧栏计数 + 批量操作修复）
> 提交数：38 个 commit

---

## 一、完成概况

Phase 8 聚焦于 **搜索重构、多选导出、翻译增强、面板持久化、Agent 提示词自定义、错误处理完善** 以及 **大量 UI/UX 打磨**。

---

## 二、搜索系统重构

### 2.1 从顶栏搜索到模态搜索框

**之前**：Ctrl+F 或点击搜索时，页面顶部出现一条细窄的搜索栏。

**之后**：
- 搜索打开时弹出居中模态框，背景虚化（`backdrop-blur`）
- 面板宽度 `max-w-3xl`（后升级为 `max-w-4xl`），矩形设计，不与屏幕边缘相连
- 输入框自动聚焦，200ms 防抖
- 键盘导航：上下箭头 + Enter 选中

### 2.2 分类搜索

搜索关键词同时匹配三个维度：
- **Articles**（标题/摘要/正文含关键词）
- **Tags**（标签名含关键词）
- **Notes**（笔记内容含关键词）

后端新增 `search_categorized` 命令，前端改用左右两栏布局：
- 左栏：三个分类选项（Articles / Tags / Notes），显示各自命中数
- 右栏：选中分类的结果列表

### 2.3 搜索入口

文章列表 header 中，unread-only 和三个点菜单之间新增搜索按钮（放大镜图标），点击等价于 Ctrl+F。

---

## 三、多选模式与批量导出

### 3.1 多选切换按钮

文章列表 header 新增多选按钮（checklist 图标），位于 unread-only 按钮左侧。激活后：
- 顶部出现 toolbar，显示已选数量和操作按钮
- 点击文章行变为勾选/取消而非跳转
- 按 Esc 退出多选模式

### 3.2 批量导出 Toolbar

多选 toolbar 三个按钮：
- **Cancel**：退出多选
- **Export Digest**：弹出保存对话框 → 导出选中文章的 AI 摘要 + 笔记（Markdown）
- **Export Articles**：弹出保存对话框 → 导出选中文章的原文 Markdown

后端新增 `export_articles` 命令：读取 entry 的 title/author/url + content 表的 markdown，合并写入 `.md` 文件。无 markdown 时 fallback 到 RSS 摘要。

### 3.3 三点菜单清理

三点菜单中的 Export Digest 和 Export Multiple Digest 已移除（功能迁移至多选 toolbar）。

---

## 四、划词翻译（Word/Phrase Translation）

### 4.1 功能

从 test 分支 cherry-pick 合入（`390b96f`）：
- 阅读器中选中文字 → 旁边出现蓝色"译"按钮
- 点击 → 弹出浮动窗口，显示 LLM 翻译结果
- 弹窗带加载动画、关闭按钮、指向选区的箭头
- 坐标边界裁切确保不超出阅读区域

### 4.2 Bug 修复

合入过程中发现并修复：
- **Tera/Mustache 冲突**：翻译模板使用 `{{#previousSourceText}}` Mustache 语法，Tera 不识别。`translate_text` 改用简单直接 prompt 绕过模板引擎
- **PromptTemplate YAML 映射**：添加 `#[serde(rename/alias)]` 修复字段名不匹配（`systemTemplate` vs `system_prompt`）
- **弹窗固定位置**：注入 JS 未传坐标，修复为捕获 mouseup 的 `clientX`/`clientY` 并通过 `postMessage` 传递
- **弹窗距离过远**：偏移从 20px 缩减到 4px

---

## 五、列宽与面板持久化

### 5.1 列宽记忆

三栏宽度改用 React state 驱动（`sidebarW` / `entryW`），localStorage 做缓存：
- 拖拽松手时即时保存
- 启动时从 localStorage 恢复
- 关闭/重启应用自动记住

### 5.2 折叠栏改进

- 点击整个折叠条（而非仅箭头按钮）即可展开被折叠的侧栏
- 折叠时保存当前宽度，展开时恢复
- 面板始终挂载 DOM（不再卸载/重挂载），消除展开时的宽度闪烁

### 5.3 面板高度稳定

Summary 和 Note 面板的 `maxHeight` 从 React inline style 迁移到 Tailwind class，避免 React 重渲染时覆盖拖拽设置的高度。

### 5.4 拖拽防误选

拖拽分栏时将 `document.body.userSelect = "none"`，松手恢复，防止拖拽时误选中文字。

---

## 六、Agent 提示词自定义

### 6.1 后端

- `reveal_custom_template` 命令扩展支持 Agent 提示词模板（`summary.default.yaml` 等）
- 新增 `reload_prompt_templates` 命令，热刷新模板缓存，无需重启
- `PromptTemplateStore` 初始化为用户 prompts 目录（之前 `user_dir` 一直为 `None`，从未加载自定义模板）
- `PromptTemplate` 的 YAML 反序列化同时接受 `systemTemplate`/`system_prompt` 和 `template`/`user_prompt_template` 两种命名

### 6.2 前端

Settings → Agents 页面：
- 每个 Agent（Summary / Translation / Tagging）底部新增 **Customize Prompt** 按钮
- 页面顶部新增 **Reload Prompts** 按钮，带状态反馈：`Reloading...` → `Successfully Reloaded` / `Failed`

---

## 七、错误处理完善

### 7.1 配置缺失时的错误信息

- Translation：未配置模型时，`String(err)` → `[object Object]` → 改为提取 `err.message` 或 JSON.stringify
- Summary：空 catch → 添加错误状态并红色展示
- Tagging：catch 静默吞错 → 展示错误信息
- 后端 `suggest_tags`：`resolve_route` 失败时返回 error 建议，前端显示具体原因

### 7.2 翻译进度显示

翻译进行中状态文本改为 `Translating -- 3/10 segments` 格式，实时更新当前完成数和总段数（中英文均翻译 `segments`/`段`）。

---

## 八、Provider 编辑改进

Settings → Agents → Providers：
- Edit 按钮从 `prompt()` 弹窗升级为内联编辑表单
- 支持修改名称、Base URL、API Key 三个字段

---

## 九、翻译导出模板标签改名

Settings → Digest：`"Export Template"` → `"Export Digest Template"`（中文：`"导出模板"` → `"导出文摘模板"`），更明确其用途。

---

## 十、文件变更统计

| 类别 | 说明 |
|------|------|
| Rust 后端 | ~8 文件修改：`agent_commands.rs`（新增 translate_text、search_categorized、export_articles 命令）、`digest_commands.rs`、`entry_commands.rs`、`settings_commands.rs`、`prompt_template.rs`、`lib.rs` |
| React 前端 | ~15 文件修改：新增 `SearchModal.tsx`，重写 `MultiSelectToolbar.tsx`，修改 `App.tsx`、`ReaderDetailView.tsx`、`ReaderWebView.tsx`、`AgentSettingsView.tsx` 等 |
| Hooks | `useResizableWidth.tsx` 改为 React state 管理宽度，`useKeyboardShortcuts.ts` 增 Escape 退出多选 |
| 翻译/常量 | `translations.ts` 新增 ~20 个翻译键 |
| SQL | 无新增迁移 |

---

## 十一、功能清单（截至 Phase 8）

### 新增

| 域 | 功能 | 状态 |
|------|------|------|
| **搜索** | 模态搜索窗口 + 背景虚化 | ✅ |
| | 三分类搜索（Articles / Tags / Notes）| ✅ |
| | 左右两栏结果展示 | ✅ |
| | 搜索快捷按钮 | ✅ |
| **多选/导出** | 多选切换按钮 + 多选 toolbar | ✅ |
| | Export Digest（批量文摘导出）| ✅ |
| | Export Articles（批量原文导出）| ✅ |
| | Escape 退出多选 | ✅ |
| **划词翻译** | 选中文字显示"译"按钮 | ✅ |
| | 浮动弹窗展示翻译结果 | ✅ |
| **列宽持久化** | 三栏宽度记忆（localStorage）| ✅ |
| | 折叠栏整条可点击展开 | ✅ |
| | 拖拽时禁用文本选中 | ✅ |
| | 面板不因 React 渲染闪缩 | ✅ |
| **提示词自定义** | Customize Prompt 按钮（每个 Agent）| ✅ |
| | Reload Prompts 热刷新 | ✅ |
| | 用户目录自动加载 | ✅ |
| **翻译进度** | 实时显示 X/Y segments | ✅ |
| **错误反馈** | Agent 面板错误信息可读化 | ✅ |
| **Provider 编辑** | 内联编辑表单（名称/URL/Key）| ✅ |
| **UI 文案** | Export Digest Template 标签 | ✅ |

### 已有功能（Phase 0-7 延续）

| 域 | 功能 | 状态 |
|------|------|------|
| **Digest 导出** | 单篇/多篇 Markdown 导出、分享复制、四种模板 | ✅ |
| **主题系统** | Classic/Paper 预设、字体/字号/行高/宽度、Quick Style | ✅ |
| **布局** | 三栏可拖拽、面板高度记忆 | ✅ |
| **LLM 配置** | Provider/Model/AgentProfile CRUD + 连接测试 + API Key | ✅ |
| **AI 摘要** | 流式生成、12 语言、3 详细度、双层缓存 | ✅ |
| **AI 翻译** | 分段并发、双语/纯译文、缓存、断点续传 | ✅ |
| **AI 标签** | AI 建议展示、标签开关控制、Tag Library 管理 | ✅ |
| **用量追踪** | Token 记录、按天聚合、Usage 标签页 | ✅ |
| **Note** | 5s 自动保存、面板开关保存、字符计数 | ✅ |
| **Settings** | 6 页签全部可用、设置持久化 | ✅ |
| **快捷键** | J/K/M/U/S/V/Esc/Ctrl+F/Ctrl+D | ✅ |
| **Sync All** | 并发控制、进度反馈、列表刷新 | ✅ |
| **阅读器** | Reader/Web/Dual 三模式、缓存渲染、Readability.js | ✅ |
| **标签系统** | CRUD、合并、批量删除、Any/All、标准化 | ✅ |
| **星标** | 收藏/取消、Starred 虚拟订阅源 | ✅ |
| **i18n** | 英文/简体中文双语言 | ✅ |
| **Dark Mode** | 应用 + 阅读器深色主题 | ✅ |

---

## 十二、验证结果

| 验证项 | 结果 |
|--------|------|
| `cargo check` | 0 错误 |
| `npx tsc --noEmit` | 0 错误 |
| `npx vite build` | 0 错误 |
| 搜索模态框 + 分类搜索 | ✅ 正常 |
| 多选 + Export Digest/Articles | ✅ 正常 |
| 划词翻译 | ✅ 正常 |
| 面板宽度跨重启记忆 | ✅ 正常 |
| 折叠栏点击展开 | ✅ 正常 |
| Agent 提示词自定义 + 热刷新 | ✅ 正常 |
| 翻译进度 X/Y 显示 | ✅ 正常 |
| Agent 面板错误信息展示 | ✅ 正常 |
| Provider 内联编辑 | ✅ 正常 |
