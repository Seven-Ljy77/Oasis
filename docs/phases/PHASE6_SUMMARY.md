# Mercury Windows — Phase 6 开发总结

> 日期：2026-07-24
> 分支：`windows`
> 基线：Phase 5（主题系统 + 设置持久化 + 键盘快捷键 + 可拖拽布局）

---

## 一、完成概况

Phase 6 实现了完整的 **笔记与文摘（Notes & Digest）系统**——包括单篇导出、多篇批量导出、分享复制、导出模板系统、文件夹路径持久化，以及共享按钮增强和 Open in Browser 修复。

| 贡献者 | 内容 |
|--------|------|
| Ljy | 全部 Digest/Export 系统实现（Rust 后端 + React 前端） |

---

## 二、新增/修改文件统计

| 类别 | 文件数 | 说明 |
|------|--------|------|
| Rust 新建 | 1 | `resources/templates/single-markdown.yaml` |
| Rust 修改 | 3 | digest_commands（重写）、settings_commands、state.rs |
| React 修改 | 8 | ExportDigestSheet、ExportMultipleDigestSheet、ShareDigestSheet、DigestSettings、ReaderToolbar、EntryListView、ipc.ts、types.ts |
| Store 修改 | 1 | useSettingsStore |

## 三、Digest 导出系统

### 3.1 后端

文件：`src-tauri/src/commands/digest_commands.rs`

**三个 RPC 命令全部实现：**

| 命令 | 功能 |
|------|------|
| `share_digest(entry_id)` | 生成纯文本文摘（标题+作者+URL+摘要+笔记），返回字符串 |
| `export_digest(entry_id, path)` | 导出单篇文章为 `.md` 文件 |
| `export_multiple_digest(entry_ids, path)` | 多篇文章合并导出为 `.md` 文件 |

**内容获取逻辑：**
- 标题/作者/URL → `entry` 表
- AI 摘要 → `summary_result` 表（LIMIT 1, ORDER BY created_at DESC）
- 用户笔记 → `entry_note` 表
- 发表日期 → `entry.published_at`

### 3.2 四种导出模板

| 模板 | 格式风格 | 摘要标题 | 笔记标题 |
|------|---------|---------|---------|
| **Default** | 标准格式 | `## Summary`（引用块） | `## Notes` |
| **Minimal** | 极简格式 | 只有标题+URL+可选摘要/笔记 | 无标题 | 无标题 |
| **Academic** | 学术格式 | `## Abstract`（引用块） | `## Commentary` |
| **Newsletter** | 通讯格式 | `## Highlights`（bullet list） | `## Editor's Note` |

**模板选择：**
- 存储在 `AppState.config.digest_template`（持久化到 `mercury-config.json`）
- Settings → Digest → Export Template 下拉选择
- 前端 `useSettingsStore` 读写

### 3.3 导出文件夹路径

- 存储在 `AppState.config.digest_export_folder`
- Settings → Digest → Browse 选择文件夹 → 持久化
- Export 时对话框默认定位到该目录
- 格式：`{folder}/{yyyy-mm-dd-{slug}.md}`

### 3.4 文件名生成

- 格式：`yyyy-mm-dd-{slug}.md`
- Slug：移除特殊字符、保留 CJK、空格替换为 `-`、最大 80 字符

## 四、前端交互

### 4.1 Export Digest（单篇）

入口：文章列表 `...` 菜单 → **Export Digest**

- 显示标题/作者/URL 预览
- 点 "Export as Markdown" → 系统保存对话框 → 写入 `.md` 文件

### 4.2 Export Multiple Digest（多篇）

入口：文章列表 `...` 菜单 → **Export Multiple Digest**

- 显示当前所有文章的复选框列表
- Select All / Deselect All 快捷操作
- 点 "Export N Articles" → 合并导出为一个 `.md`

### 4.3 Share Digest（分享）

入口：工具栏 📤 → **Copy Digest**

- 打开 Share Digest Sheet → 自动生成文摘预览
- 点 "Copy to Clipboard" → 复制纯文本文摘

### 4.4 Share 菜单增强

- **Copy Link** → 复制原文 URL
- **Copy Digest** → 打开 Share Digest Sheet
- **Open in Browser** → 调用系统默认浏览器打开原文（使用 `open_in_browser` Rust 命令）

## 五、Digest 模板自定义

### 5.1 Open Template File

入口：Settings → Digest → **Open Template File**

- 首次点击：自动在 `%LOCALAPPDATA%/Mercury/prompts/single-markdown.yaml` 创建默认模板
- 用系统默认编辑器（记事本/VS Code）打开 YAML 文件
- 用户可以编辑模板自定义格式

### 5.2 模板文件格式

文件：`resources/templates/single-markdown.yaml`

Mustache 风格的 YAML 模板：
```yaml
id: "single-markdown"
version: "1.0"
template: |
  # {{title}}
  {{#author}}*By {{author}}*{{/author}}
  {{#summary}}## Summary > {{summary}}{{/summary}}
  {{#note}}## Notes {{note}}{{/note}}
```

## 六、AppSettings 扩展

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `digest_export_folder` | `Option<String>` | `None` | 导出默认文件夹 |
| `digest_template` | `String` | `"default"` | 导出模板 ID |

## 七、其他修复

| 修复 | 文件 | 说明 |
|------|------|------|
| Open in Browser 无反应 | ReaderToolbar.tsx | `window.open` → `openInBrowser()` IPC → Rust `open_in_browser` 系统命令 |

## 八、功能清单（截至 Phase 6）

### 已实现

| 域 | 功能 | 状态 |
|------|------|------|
| **Digest 导出** | 单篇/多篇 Markdown 导出、分享复制、四种模板、文件夹路径 | ✅ |
| **模板自定义** | YAML 模板文件编辑器打开 | ✅ |
| **主题系统** | Appearance 切换、Reader Theme、字体/字号/行高/宽度、Quick Style | ✅ |
| **布局** | 三栏可拖拽、面板可拖拽、高度记忆 | ✅ |
| **LLM 配置** | Provider/Model/AgentProfile CRUD + 连接测试 + API Key | ✅ |
| **AI 摘要** | 流式生成、Markdown→HTML、12 语言、3 详细度、缓存 | ✅ |
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

## 九、验证结果

| 验证项 | 结果 |
|--------|------|
| `cargo check` | 0 错误，2 已有 warning |
| `npx tsc --noEmit` | 0 错误 |
| Export Digest | ✅ 单篇 .md 导出 |
| Export Multiple | ✅ 复选框多选 + 合并导出 |
| Share / Copy Digest | ✅ 文摘预览 + 一键复制 |
| Open in Browser | ✅ 系统浏览器打开 |
| Open Template File | ✅ 创建默认模板 + 编辑器打开 |
| Settings → Digest | ✅ 文件夹/模板持久化 |
