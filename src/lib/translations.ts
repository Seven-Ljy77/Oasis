export type Locale = "en" | "zh-CN";

export interface TranslationDict {
  common: {
    cancel: string;
    save: string;
    close: string;
    confirm: string;
    delete: string;
    edit: string;
    rename: string;
    merge: string;
    browse: string;
    import_: string;
    export_: string;
    copy: string;
    clear: string;
    reset: string;
    retry: string;
    search: string;
    loading: string;
    noData: string;
    enabled: string;
    disabled: string;
  };
  sidebar: {
    feeds: string;
    tags: string;
    allFeeds: string;
    starred: string;
    addFeed: string;
    syncAll: string;
    settings: string;
    importOpml: string;
    exportOpml: string;
    editFeed: string;
    deleteFeed: string;
    any: string;
    all: string;
    searchTags: string;
    deleteSelected: string;
    deleteUnused: string;
    clearSelected: string;
  };
  entryList: {
    entries: string;
    starred: string;
    unreadOnly: string;
    markAllRead: string;
    markAllUnread: string;
    deleteAll: string;
    exportDigest: string;
    exportMultipleDigest: string;
    multiSelect: string;
    exitMultiSelect: string;
    exportArticles: string;
    noArticles: string;
    selectFeedHint: string;
    selected: string;
    continue: string;
  };
  reader: {
    reader: string;
    web: string;
    dual: string;
    selectArticle: string;
    toggleStar: string;
    aiSummary: string;
    translation: string;
    tagging: string;
    note: string;
    theme: string;
    share: string;
    copyLink: string;
    copyDigest: string;
    openInBrowser: string;
    loadingArticle: string;
    hasNote: string;
    clearTranslation: string;
  };
  summary: {
    title: string;
    generate: string;
    abort: string;
    copy: string;
    clear: string;
    short: string;
    medium: string;
    detailed: string;
    autoSummary: string;
    targetLanguage: string;
    detailLevel: string;
    ready: string;
    generating: string;
    completed: string;
    failed: string;
  };
  translation: {
    title: string;
    start: string;
    bilingual: string;
    targetLanguage: string;
    concurrency: string;
    promptStrategy: string;
    standard: string;
    hyMtOpt: string;
    ready: string;
    translating: string;
    completed: string;
    segments: string;
    failed: string;
    noSegments: string;
  };
  tagging: {
    title: string;
    addTag: string;
    aiSuggestions: string;
    nlpSuggestions: string;
    existingTags: string;
    aiDisabled: string;
    apply: string;
    remove: string;
  };
  note: {
    title: string;
    placeholder: string;
    save: string;
    characters: string;
    saving: string;
    saved: string;
    idle: string;
  };
  theme: {
    appearance: string;
    auto: string;
    light: string;
    dark: string;
    eyeCare: string;
    readerTheme: string;
    classic: string;
    paper: string;
    fontFamily: string;
    fontSize: string;
    lineHeight: string;
    contentWidth: string;
    quickStyle: string;
    none: string;
    warm: string;
    cool: string;
    slate: string;
    preset: string;
    preview: string;
    reset: string;
  };
  settings: {
    title: string;
    general: string;
    reader: string;
    agents: string;
    digest: string;
    usage: string;
    logs: string;
  };
  generalSettings: {
    language: string;
    languageDesc: string;
    syncConcurrency: string;
    syncConcurrencyDesc: string;
    usageRetention: string;
    usageRetentionDesc: string;
    aiTagging: string;
    aiTaggingDesc: string;
    openTagLibrary: string;
    batchAiTagging: string;
    retentionKeepForever: string;
    retentionMonths: string;
  };
  agentSettings: {
    providers: string;
    models: string;
    agents: string;
    addProvider: string;
    addModel: string;
    editProvider: string;
    editModel: string;
    deleteProvider: string;
    deleteModel: string;
    testConnection: string;
    setDefault: string;
    name: string;
    baseUrl: string;
    apiKey: string;
    modelName: string;
    temperature: string;
    maxTokens: string;
    summary: string;
    translation: string;
    tagging: string;
    primaryModel: string;
    fallbackModel: string;
    connectionSuccess: string;
    connectionFailed: string;
    active: string;
    noModels: string;
    newName: string;
    summaryAgent: string;
    translationAgent: string;
    taggingAgent: string;
    customizePrompt: string;
    reloadPrompts: string;
    reloadHint: string;
    reloading: string;
    reloadSuccess: string;
    reloadFailed: string;
  };
  digestSettings: {
    exportFolder: string;
    browse: string;
    noFolder: string;
    template: string;
    templateCustomization: string;
    openTemplateFile: string;
  };
  digest: {
    shareTitle: string;
    exportTitle: string;
    exportMultipleTitle: string;
    copyToClipboard: string;
    copied: string;
    exportMarkdown: string;
    selectAll: string;
    deselectAll: string;
    exportNArticles: string;
    importComplete: string;
    loadFailed: string;
  };
  opmlImport: {
    title: string;
    opmlFile: string;
    browse: string;
    replaceExisting: string;
    replaceExistingDesc: string;
    forceSiteName: string;
    forceSiteNameDesc: string;
    import_: string;
    importing: string;
    completed: string;
    fetching: string;
    done: string;
    error: string;
    skipped: string;
    added: string;
    errors: string;
    close: string;
  };
  feedEditor: {
    addTitle: string;
    editTitle: string;
    feedUrl: string;
    check: string;
    feedName: string;
    addFeed: string;
    saveChanges: string;
    validating: string;
    invalidUrl: string;
    duplicateFeed: string;
  };
  tagLibrary: {
    title: string;
    search: string;
    filterAll: string;
    filterUnused: string;
    filterHasAliases: string;
    identity: string;
    name: string;
    normalizedName: string;
    status: string;
    provisional: string;
    permanent: string;
    aliases: string;
    addAlias: string;
    actions: string;
    rename: string;
    mergeInto: string;
    delete: string;
    makePermanent: string;
    usageCount: string;
  };
  batchTagging: {
    title: string;
    configure: string;
    running: string;
    review: string;
    apply: string;
    scope: string;
    concurrency: string;
    skipTagged: string;
    skipAttempted: string;
    start: string;
    abort: string;
    processed: string;
    succeeded: string;
    failed: string;
    keep: string;
    discard: string;
  };
  usage: {
    title: string;
    totalTokens: string;
    totalRequests: string;
    successRate: string;
    qualityMetrics: string;
    coverageRate: string;
    avgTokensPerRequest: string;
    promptTokens: string;
    completionTokens: string;
    requests: string;
    period1w: string;
    period2w: string;
    period1m: string;
    periodComparison: string;
    notAvailable: string;
  };
  logs: {
    title: string;
    description: string;
    uploadedMsg: string;
    uploadFailed: string;
    uploading: string;
    uploadLogs: string;
    clearing: string;
    clearLogs: string;
    refresh: string;
    showing: string;
    of: string;
    entries: string;
    loading: string;
    noEntries: string;
    timestamp: string;
    level: string;
    event: string;
    message: string;
    logDetails: string;
    timezone: string;
    additionalInfo: string;
  };
  status: {
    syncing: string;
    syncFailed: string;
    lastSync: string;
    feeds: string;
    entries: string;
    unread: string;
    never: string;
    minutesAgo: string;
    hoursAgo: string;
    yesterday: string;
  };
}

// UTF-8 safe, same key shape as TranslationDict.
// Build-time check: `satisfies` catches missing keys.

export const translations: Record<Locale, TranslationDict> = {
  en: {
    common: {
      cancel: "Cancel",
      save: "Save",
      close: "Close",
      confirm: "Confirm",
      delete: "Delete",
      edit: "Edit",
      rename: "Rename",
      merge: "Merge",
      browse: "Browse",
      import_: "Import",
      export_: "Export",
      copy: "Copy",
      clear: "Clear",
      reset: "Reset",
      retry: "Retry",
      search: "Search",
      loading: "Loading...",
      noData: "No data",
      enabled: "Enabled",
      disabled: "Disabled",
    },
    sidebar: {
      feeds: "Feeds",
      tags: "Tags",
      allFeeds: "All Feeds",
      starred: "Starred",
      addFeed: "Add Feed",
      syncAll: "Sync All",
      settings: "Settings",
      importOpml: "Import OPML",
      exportOpml: "Export OPML",
      editFeed: "Edit",
      deleteFeed: "Delete",
      any: "Any",
      all: "All",
      searchTags: "Search tags...",
      deleteSelected: "Delete Selected",
      deleteUnused: "Delete Unused",
      clearSelected: "Clear all selected",
    },
    entryList: {
      entries: "Entries",
      starred: "Starred",
      unreadOnly: "Unread only",
      markAllRead: "Mark All Read",
      markAllUnread: "Mark All Unread",
      deleteAll: "Delete All",
      exportDigest: "Export Digest",
      exportMultipleDigest: "Export Multiple Digest",
      multiSelect: "Multi-select",
      exitMultiSelect: "Exit multi-select",
      exportArticles: "Export Articles",
      noArticles: "No articles to display",
      selectFeedHint: "Select a feed or adjust your filters",
      selected: "selected",
      continue: "Continue",
    },
    reader: {
      reader: "Reader",
      web: "Web",
      dual: "Dual",
      selectArticle: "Select an article to begin reading",
      toggleStar: "Toggle star",
      aiSummary: "AI Summary",
      translation: "Translation",
      tagging: "Tags",
      note: "Note",
      theme: "Theme",
      share: "Share",
      copyLink: "Copy Link",
      copyDigest: "Copy Digest",
      openInBrowser: "Open in Browser",
      loadingArticle: "Loading article...",
      hasNote: "Note",
      clearTranslation: "Clear Translation",
    },
    summary: {
      title: "AI Summary",
      generate: "Generate",
      abort: "Abort",
      copy: "Copy",
      clear: "Clear",
      short: "Short",
      medium: "Medium",
      detailed: "Detailed",
      autoSummary: "Auto-summary",
      targetLanguage: "Target Language",
      detailLevel: "Detail Level",
      ready: "Summary ready — click Generate",
      generating: "Generating summary...",
      completed: "Summary completed",
      failed: "Summary failed",
    },
    translation: {
      title: "Translation",
      start: "Start Translation",
      bilingual: "Bilingual",
      targetLanguage: "Target Language",
      concurrency: "Concurrency",
      promptStrategy: "Prompt Strategy",
      standard: "Standard",
      hyMtOpt: "HY-MT Opt",
      ready: "Translation ready — click Start",
      translating: "Translating...",
      completed: "Translation completed",
      failed: "Translation failed",
      segments: "segments",
      noSegments: "No translatable segments found in this article",
    },
    tagging: {
      title: "Tags",
      addTag: "Add tags...",
      aiSuggestions: "AI Suggestions",
      nlpSuggestions: "NLP Suggestions",
      existingTags: "Existing Tags",
      aiDisabled: "AI tag suggestions are disabled. Enable in Settings → General.",
      apply: "Apply",
      remove: "Remove",
    },
    note: {
      title: "Note",
      placeholder: "Write your notes here...",
      save: "Save",
      characters: "characters",
      saving: "Saving...",
      saved: "Saved",
      idle: "",
    },
    theme: {
      appearance: "Appearance",
      auto: "Auto",
      light: "Light",
      dark: "Dark",
      eyeCare: "Eye Care",
      readerTheme: "Reader Theme",
      classic: "Classic",
      paper: "Paper",
      fontFamily: "Font Family",
      fontSize: "Font Size",
      lineHeight: "Line Height",
      contentWidth: "Content Width",
      quickStyle: "Quick Style",
      none: "None",
      warm: "Warm",
      cool: "Cool",
      slate: "Slate",
      preset: "Preset",
      preview: "Preview",
      reset: "Reset",
    },
    settings: {
      title: "Settings",
      general: "General",
      reader: "Reader",
      agents: "Agents",
      digest: "Digest",
      usage: "Usage",
      logs: "Logs",
    },
    generalSettings: {
      language: "Language",
      languageDesc: "UI display language and AI output language preference.",
      syncConcurrency: "Sync Concurrency",
      syncConcurrencyDesc: "Number of feeds to sync simultaneously.",
      usageRetention: "Usage Data Retention",
      usageRetentionDesc: "How long to keep API usage and analytics data.",
      aiTagging: "Enable AI Auto-Tagging",
      aiTaggingDesc: "Automatically suggest tags for new articles using AI.",
      openTagLibrary: "Open Tag Library",
      batchAiTagging: "Batch AI Tagging",
      retentionKeepForever: "Keep forever",
      retentionMonths: "month",
    },
    agentSettings: {
      providers: "Providers",
      models: "Models",
      agents: "Agents",
      addProvider: "Add Provider",
      addModel: "Add Model",
      editProvider: "Edit Provider",
      editModel: "Edit Model",
      deleteProvider: "Delete Provider",
      deleteModel: "Delete Model",
      testConnection: "Test Connection",
      setDefault: "Set Default",
      name: "Name",
      baseUrl: "Base URL",
      apiKey: "API Key",
      modelName: "Model Name",
      temperature: "Temperature",
      maxTokens: "Max Tokens",
      summary: "Summary",
      translation: "Translation",
      tagging: "Tagging",
      primaryModel: "Primary Model",
      fallbackModel: "Fallback Model",
      connectionSuccess: "Connection successful",
      connectionFailed: "Connection failed",
      active: "Active",
      noModels: "No models configured for this provider.",
      newName: "New name:",
      summaryAgent: "Summary Agent",
      translationAgent: "Translation Agent",
      taggingAgent: "Tagging Agent",
      customizePrompt: "Customize Prompt",
      reloadPrompts: "Reload Prompts",
      reloadHint: "Edit prompt files then click Reload to apply without restart.",
      reloading: "Reloading...",
      reloadSuccess: "Successfully Reloaded",
      reloadFailed: "Failed",
    },
    digestSettings: {
      exportFolder: "Export Folder",
      browse: "Browse",
      noFolder: "No folder selected",
      template: "Export Template",
      templateCustomization: "Template Customization",
      openTemplateFile: "Open Template File",
    },
    digest: {
      shareTitle: "Share Digest",
      exportTitle: "Export Digest",
      exportMultipleTitle: "Export Multiple Digest",
      copyToClipboard: "Copy to Clipboard",
      copied: "Copied!",
      exportMarkdown: "Export as Markdown",
      selectAll: "Select All",
      deselectAll: "Deselect All",
      exportNArticles: "Export {n} Articles",
      importComplete: "Import complete",
      loadFailed: "Unable to generate digest",
    },
    opmlImport: {
      title: "Import OPML",
      opmlFile: "OPML File",
      browse: "Browse...",
      replaceExisting: "Replace existing feeds",
      replaceExistingDesc: "All current feeds will be removed before importing.",
      forceSiteName: "Force site name as feed title",
      forceSiteNameDesc: "Uses the feed's own title instead of the OPML title.",
      import_: "Import",
      importing: "Importing feeds...",
      completed: "completed",
      fetching: "fetching",
      done: "done",
      error: "failed",
      skipped: "skipped",
      added: "added",
      errors: "errors",
      close: "Close",
    },
    feedEditor: {
      addTitle: "Add Feed",
      editTitle: "Edit Feed",
      feedUrl: "Feed URL",
      check: "Check",
      feedName: "Feed Name",
      addFeed: "Add Feed",
      saveChanges: "Save Changes",
      validating: "Validating...",
      invalidUrl: "Invalid URL",
      duplicateFeed: "Already subscribed",
    },
    tagLibrary: {
      title: "Tag Library",
      search: "Search tags...",
      filterAll: "All",
      filterUnused: "Unused",
      filterHasAliases: "Has Aliases",
      identity: "Identity",
      name: "Name",
      normalizedName: "Normalized Name",
      status: "Status",
      provisional: "Provisional",
      permanent: "Permanent",
      aliases: "Aliases",
      addAlias: "Add Alias",
      actions: "Actions",
      rename: "Rename",
      mergeInto: "Merge Into...",
      delete: "Delete",
      makePermanent: "Make Permanent",
      usageCount: "Usage Count",
    },
    batchTagging: {
      title: "Batch AI Tagging",
      configure: "Configure",
      running: "Running",
      review: "Review",
      apply: "Apply",
      scope: "Scope",
      concurrency: "Concurrency",
      skipTagged: "Skip already tagged",
      skipAttempted: "Skip already attempted",
      start: "Start",
      abort: "Abort",
      processed: "Processed",
      succeeded: "Succeeded",
      failed: "Failed",
      keep: "Keep",
      discard: "Discard",
    },
    usage: {
      title: "Usage",
      totalTokens: "Total Tokens",
      totalRequests: "Total Requests",
      successRate: "Success Rate",
      qualityMetrics: "Quality Metrics",
      coverageRate: "Coverage Rate",
      avgTokensPerRequest: "Avg Tokens / Request",
      promptTokens: "Prompt Tokens",
      completionTokens: "Completion Tokens",
      requests: "Requests",
      period1w: "1 Week",
      period2w: "2 Weeks",
      period1m: "1 Month",
      periodComparison: "Period Comparison",
      notAvailable: "N/A",
    },
    logs: {
      title: "Logs",
      description: "View, upload, and clear diagnostic logs for troubleshooting.",
      uploadedMsg: "Uploaded {n} log entries successfully.",
      uploadFailed: "Upload failed",
      uploading: "Uploading...",
      uploadLogs: "Upload Logs",
      clearing: "Clearing...",
      clearLogs: "Clear Logs",
      refresh: "Refresh",
      showing: "Showing",
      of: "of",
      entries: "entries",
      loading: "Loading...",
      noEntries: "No log entries found.",
      timestamp: "Timestamp",
      level: "Level",
      event: "Event",
      message: "Message",
      logDetails: "Log Details",
      timezone: "Times are displayed in local timezone.",
      additionalInfo: "Additional Info",
    },
    status: {
      syncing: "Syncing...",
      syncFailed: "Sync failed",
      lastSync: "Last sync",
      feeds: "Feeds",
      entries: "Entries",
      unread: "Unread",
      never: "never",
      minutesAgo: "m ago",
      hoursAgo: "h ago",
      yesterday: "yesterday",
    },
  },

  "zh-CN": {
    common: {
      cancel: "取消",
      save: "保存",
      close: "关闭",
      confirm: "确认",
      delete: "删除",
      edit: "编辑",
      rename: "重命名",
      merge: "合并",
      browse: "浏览",
      import_: "导入",
      export_: "导出",
      copy: "复制",
      clear: "清除",
      reset: "重置",
      retry: "重试",
      search: "搜索",
      loading: "加载中...",
      noData: "暂无数据",
      enabled: "已启用",
      disabled: "已禁用",
    },
    sidebar: {
      feeds: "订阅源",
      tags: "标签",
      allFeeds: "全部文章",
      starred: "收藏",
      addFeed: "添加订阅",
      syncAll: "同步全部",
      settings: "设置",
      importOpml: "导入 OPML",
      exportOpml: "导出 OPML",
      editFeed: "编辑",
      deleteFeed: "删除",
      any: "任一",
      all: "全部",
      searchTags: "搜索标签...",
      deleteSelected: "删除选中",
      deleteUnused: "删除未使用",
      clearSelected: "清除选中",
    },
    entryList: {
      entries: "文章",
      starred: "收藏",
      unreadOnly: "仅未读",
      markAllRead: "全部标为已读",
      markAllUnread: "全部标为未读",
      deleteAll: "删除全部",
      exportDigest: "导出文摘",
      exportMultipleDigest: "导出多篇文摘",
      multiSelect: "多选",
      exitMultiSelect: "退出多选",
      exportArticles: "导出原文",
      noArticles: "没有可显示的文章",
      selectFeedHint: "选择一个订阅源或调整筛选条件",
      selected: "已选择",
      continue: "继续",
    },
    reader: {
      reader: "阅读",
      web: "网页",
      dual: "双栏",
      selectArticle: "选择一篇文章开始阅读",
      toggleStar: "切换收藏",
      aiSummary: "AI 摘要",
      translation: "翻译",
      tagging: "标签",
      note: "笔记",
      theme: "主题",
      share: "分享",
      copyLink: "复制链接",
      copyDigest: "复制文摘",
      openInBrowser: "在浏览器中打开",
      loadingArticle: "加载文章中...",
      hasNote: "笔记",
      clearTranslation: "清除翻译",
    },
    summary: {
      title: "AI 摘要",
      generate: "生成",
      abort: "中止",
      copy: "复制",
      clear: "清除",
      short: "简短",
      medium: "中等",
      detailed: "详细",
      autoSummary: "自动摘要",
      targetLanguage: "目标语言",
      detailLevel: "详细程度",
      ready: "摘要就绪 — 点击生成",
      generating: "正在生成摘要...",
      completed: "摘要已完成",
      failed: "摘要生成失败",
    },
    translation: {
      title: "翻译",
      start: "开始翻译",
      bilingual: "双语对照",
      targetLanguage: "目标语言",
      concurrency: "并发数",
      promptStrategy: "提示策略",
      standard: "标准",
      hyMtOpt: "混元优化",
      ready: "翻译就绪 — 点击开始",
      translating: "翻译中...",
      completed: "翻译完成",
      failed: "翻译失败",
      segments: "段",
      noSegments: "此文章没有可翻译的段落",
    },
    tagging: {
      title: "标签",
      addTag: "添加标签...",
      aiSuggestions: "AI 建议",
      nlpSuggestions: "NLP 建议",
      existingTags: "已有标签",
      aiDisabled: "AI 标签建议已禁用。请在 设置 → 通用 中启用。",
      apply: "应用",
      remove: "移除",
    },
    note: {
      title: "笔记",
      placeholder: "在此写下笔记...",
      save: "保存",
      characters: "字",
      saving: "保存中...",
      saved: "已保存",
      idle: "",
    },
    theme: {
      appearance: "外观",
      auto: "自动",
      light: "浅色",
      dark: "深色",
      eyeCare: "护眼",
      readerTheme: "阅读主题",
      classic: "经典",
      paper: "纸张",
      fontFamily: "字体",
      fontSize: "字号",
      lineHeight: "行高",
      contentWidth: "内容宽度",
      quickStyle: "快速风格",
      none: "无",
      warm: "暖色",
      cool: "冷色",
      slate: "石板色",
      preset: "预设",
      preview: "预览",
      reset: "重置",
    },
    settings: {
      title: "设置",
      general: "通用",
      reader: "阅读器",
      agents: "智能体",
      digest: "文摘",
      usage: "用量",
      logs: "日志",
    },
    generalSettings: {
      language: "语言",
      languageDesc: "界面显示语言和 AI 输出语言偏好。",
      syncConcurrency: "同步并发数",
      syncConcurrencyDesc: "同时同步的订阅源数量。",
      usageRetention: "用量数据保留",
      usageRetentionDesc: "保留 API 使用和分析数据的时间。",
      aiTagging: "启用 AI 自动标签",
      aiTaggingDesc: "使用 AI 自动为新文章建议标签。",
      openTagLibrary: "打开标签库",
      batchAiTagging: "批量 AI 打标签",
      retentionKeepForever: "永久保留",
      retentionMonths: "个月",
    },
    agentSettings: {
      providers: "提供商",
      models: "模型",
      agents: "智能体",
      addProvider: "添加提供商",
      addModel: "添加模型",
      editProvider: "编辑提供商",
      editModel: "编辑模型",
      deleteProvider: "删除提供商",
      deleteModel: "删除模型",
      testConnection: "测试连接",
      setDefault: "设为默认",
      name: "名称",
      baseUrl: "基础 URL",
      apiKey: "API 密钥",
      modelName: "模型名称",
      temperature: "温度",
      maxTokens: "最大 Token",
      summary: "摘要",
      translation: "翻译",
      tagging: "标签",
      primaryModel: "主模型",
      fallbackModel: "备用模型",
      connectionSuccess: "连接成功",
      connectionFailed: "连接失败",
      active: "正常",
      noModels: "此提供商未配置模型。",
      newName: "新名称：",
      summaryAgent: "摘要智能体",
      translationAgent: "翻译智能体",
      taggingAgent: "标签智能体",
      customizePrompt: "自定义提示词",
      reloadPrompts: "重新加载提示词",
      reloadHint: "编辑提示词文件后点击重新加载即可生效，无需重启。",
      reloading: "加载中...",
      reloadSuccess: "加载成功",
      reloadFailed: "加载失败",
    },
    digestSettings: {
      exportFolder: "导出目录",
      browse: "浏览",
      noFolder: "未选择目录",
      template: "导出模板",
      templateCustomization: "模板自定义",
      openTemplateFile: "打开模板文件",
    },
    digest: {
      shareTitle: "分享文摘",
      exportTitle: "导出文摘",
      exportMultipleTitle: "导出多篇文摘",
      copyToClipboard: "复制到剪贴板",
      copied: "已复制!",
      exportMarkdown: "导出为 Markdown",
      selectAll: "全选",
      deselectAll: "取消全选",
      exportNArticles: "导出 {n} 篇文章",
      importComplete: "导入完成",
      loadFailed: "无法生成文摘",
    },
    opmlImport: {
      title: "导入 OPML",
      opmlFile: "OPML 文件",
      browse: "浏览...",
      replaceExisting: "替换已有订阅源",
      replaceExistingDesc: "导入前将删除所有现有订阅源。",
      forceSiteName: "使用站点名作为标题",
      forceSiteNameDesc: "使用订阅源自身标题代替 OPML 中的标题。",
      import_: "导入",
      importing: "正在导入...",
      completed: "已完成",
      fetching: "获取中",
      done: "完成",
      error: "失败",
      skipped: "跳过",
      added: "已添加",
      errors: "错误",
      close: "关闭",
    },
    feedEditor: {
      addTitle: "添加订阅源",
      editTitle: "编辑订阅源",
      feedUrl: "订阅源 URL",
      check: "检测",
      feedName: "订阅源名称",
      addFeed: "添加订阅",
      saveChanges: "保存更改",
      validating: "验证中...",
      invalidUrl: "无效的 URL",
      duplicateFeed: "已订阅",
    },
    tagLibrary: {
      title: "标签库",
      search: "搜索标签...",
      filterAll: "全部",
      filterUnused: "未使用",
      filterHasAliases: "有别名",
      identity: "标识",
      name: "名称",
      normalizedName: "标准化名称",
      status: "状态",
      provisional: "临时",
      permanent: "永久",
      aliases: "别名",
      addAlias: "添加别名",
      actions: "操作",
      rename: "重命名",
      mergeInto: "合并到...",
      delete: "删除",
      makePermanent: "转为永久",
      usageCount: "使用次数",
    },
    batchTagging: {
      title: "批量 AI 打标签",
      configure: "配置",
      running: "运行中",
      review: "审核",
      apply: "应用",
      scope: "范围",
      concurrency: "并发数",
      skipTagged: "跳过已有标签",
      skipAttempted: "跳过已处理",
      start: "开始",
      abort: "中止",
      processed: "已处理",
      succeeded: "成功",
      failed: "失败",
      keep: "保留",
      discard: "丢弃",
    },
    usage: {
      title: "用量",
      totalTokens: "Token 总量",
      totalRequests: "请求总数",
      successRate: "成功率",
      qualityMetrics: "质量指标",
      coverageRate: "覆盖率",
      avgTokensPerRequest: "平均 Token / 请求",
      promptTokens: "输入 Token",
      completionTokens: "输出 Token",
      requests: "请求数",
      period1w: "1 周",
      period2w: "2 周",
      period1m: "1 个月",
      periodComparison: "周期对比",
      notAvailable: "暂无",
    },
    logs: {
      title: "日志",
      description: "查看、上传和清空诊断日志以进行故障排查。",
      uploadedMsg: "已成功上传 {n} 条日志记录。",
      uploadFailed: "上传失败",
      uploading: "上传中...",
      uploadLogs: "上传日志",
      clearing: "清空中...",
      clearLogs: "清空日志",
      refresh: "刷新",
      showing: "显示",
      of: "/",
      entries: "条",
      loading: "加载中...",
      noEntries: "暂无日志记录。",
      timestamp: "时间戳",
      level: "级别",
      event: "事件",
      message: "消息",
      logDetails: "日志详情",
      timezone: "时间以本地时区显示。",
      additionalInfo: "附加信息",
    },
    status: {
      syncing: "同步中...",
      syncFailed: "同步失败",
      lastSync: "上次同步",
      feeds: "订阅源",
      entries: "文章",
      unread: "未读",
      never: "从未",
      minutesAgo: "分钟前",
      hoursAgo: "小时前",
      yesterday: "昨天",
    },
  },
};
