// =============================================================================
// Mercury — Reader Store
// =============================================================================

import { create } from "zustand";
import type {
  ThemePreset,
  ThemeMode,
  ThemeTokens,
  ReadingMode,
  ReaderPanel,
  SummaryResult,
  TranslationSegmentData,
} from "@/lib/types";
import { DEFAULT_THEME_PRESET, DEFAULT_THEME_TOKENS } from "@/lib/constants";
import * as ipc from "@/lib/ipc";

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export interface ReaderState {
  // Theme
  themePreset: ThemePreset;
  themeMode: ThemeMode;
  effectiveTheme: "light" | "dark";
  themeTokens: ThemeTokens;
  quickStyle: string;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  contentWidth: number;

  // Content
  readerHTML: string | null;
  readerLoading: boolean;
  translationHTML: string | null;
  entryTitle: string | null;
  readingMode: ReadingMode;
  readerCache: Map<string, string>;  // URL -> rendered HTML, max 30 entries

  // Banner
  bannerMessage: string | null;
  bannerType: "info" | "success" | "warning" | "error";
  bannerAction: { label: string; onClick: () => void } | null;

  // Summary panel
  activePanel: ReaderPanel;
  summaryOpen: boolean;
  summaryResult: SummaryResult | null;
  summaryText: string;
  summaryHTML: string;
  summaryTargetLanguage: string;
  summaryDetailLevel: string;
  summaryAutoEnabled: boolean;
  summaryLoading: boolean;
  summaryError: string | null;

  // Translation panel
  translationEnabled: boolean;
  translationBilingual: boolean;
  translationTargetLang: string;
  translationTargetLanguage: string;
  translationConcurrency: number;
  translationPromptStrategy: string;
  translationProgress: { completed: number; total: number } | null;
  translationSegments: TranslationSegmentData[];
  translationLoading: boolean;
  translationError: string | null;

  // Note panel
  noteText: string;
  noteSaveState: "idle" | "saving" | "saved" | "error";

  // Panel state
  openPanel: ReaderPanel;

  // Theme Actions
  setThemePreset: (preset: ThemePreset) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setEffectiveTheme: (theme: "light" | "dark") => void;
  setThemeTokens: (tokens: ThemeTokens) => void;
  setQuickStyle: (style: string) => void;
  setFontFamily: (font: string) => void;
  setFontSize: (size: number) => void;
  setLineHeight: (lh: number) => void;
  setContentWidth: (width: number) => void;
  resetTheme: () => void;

  buildReaderHTML: (entryUrl: string, entryId?: number, bypassCache?: boolean) => Promise<void>;
  buildTranslationHTML: (entryId: number, targetLang: string) => Promise<void>;
  setTranslationHTML: (html: string | null) => void;

  setReadingMode: (mode: ReadingMode) => void;

  // Banner
  setBanner: (message: string | null, type?: string, action?: { label: string; onClick: () => void } | null) => void;

  // Panel
  setActivePanel: (panel: ReaderPanel) => void;
  togglePanel: (panel: ReaderPanel) => void;
  closePanel: () => void;

  // Summary
  setSummaryOpen: (open: boolean) => void;
  setSummaryTargetLanguage: (lang: string) => void;
  setSummaryDetailLevel: (level: string) => void;
  setSummaryAutoEnabled: (enabled: boolean) => void;
  setSummaryText: (text: string) => void;
  setSummaryLoading: (loading: boolean) => void;
  loadSummary: (entryId: number, detailLevel?: string) => Promise<void>;

  // Translation
  setTranslationEnabled: (enabled: boolean) => void;
  setTranslationBilingual: (bilingual: boolean) => void;
  setTranslationTargetLanguage: (lang: string) => void;
  setTranslationConcurrency: (n: number) => void;
  setTranslationPromptStrategy: (strategy: string) => void;
  setTranslationProgress: (progress: { completed: number; total: number } | null) => void;
  loadTranslationSegments: (entryId: number, targetLanguage: string) => Promise<void>;

  // Notes
  setNoteText: (text: string) => void;
  saveNote: (entryId: number) => Promise<void>;

  resetReaderState: () => void;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

/// Load a persisted value from localStorage, returning the default if missing.
function loadPref<T>(key: string, parse: (raw: string) => T, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

const initialState = {
  themePreset: loadPref("mercury-theme-preset", (v) => v as ThemePreset, DEFAULT_THEME_PRESET),
  themeMode: loadPref("mercury-theme-mode", (v) => v as ThemeMode, "auto" as ThemeMode),
  effectiveTheme: "light" as "light" | "dark",
  themeTokens: DEFAULT_THEME_TOKENS[DEFAULT_THEME_PRESET],
  quickStyle: loadPref("mercury-quick-style", (v) => v, "none"),
  fontFamily: loadPref("mercury-font-family", (v) => v, "Georgia, serif"),
  fontSize: loadPref("mercury-font-size", (v) => Number(v) || 16, 16),
  lineHeight: loadPref("mercury-line-height", (v) => Number(v) || 1.8, 1.8),
  contentWidth: loadPref("mercury-content-width", (v) => Number(v) || 720, 720),

  readerHTML: null as string | null,
  readerLoading: false,
  translationHTML: null as string | null,
  entryTitle: null as string | null,
  readingMode: "reader" as ReadingMode,
  readerCache: new Map<string, string>(),

  bannerMessage: null as string | null,
  bannerType: "info" as "info" | "success" | "warning" | "error",
  bannerAction: null as { label: string; onClick: () => void } | null,

  activePanel: null as ReaderPanel,
  summaryOpen: false as boolean,
  summaryResult: null as SummaryResult | null,
  summaryText: "" as string,
  summaryHTML: "" as string,
  summaryTargetLanguage: "zh-CN" as string,
  summaryDetailLevel: "medium" as string,
  summaryAutoEnabled: false as boolean,
  summaryLoading: false,
  summaryError: null as string | null,

  translationEnabled: false as boolean,
  translationBilingual: false as boolean,
  translationTargetLang: "zh-CN",
  translationTargetLanguage: "zh-CN" as string,
  translationConcurrency: 3 as number,
  translationPromptStrategy: "standard" as string,
  translationProgress: null as { completed: number; total: number } | null,
  translationSegments: [] as TranslationSegmentData[],
  translationLoading: false,
  translationError: null as string | null,

  noteText: "",
  noteSaveState: "idle" as "idle" | "saving" | "saved" | "error",

  openPanel: null as ReaderPanel,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useReaderStore = create<ReaderState>()((set, get) => ({
  ...initialState,

  // Theme
  setThemePreset: (preset) => {
    const tokens = DEFAULT_THEME_TOKENS[preset];
    set({ themePreset: preset, themeTokens: tokens });
    // Persist preference
    try { localStorage.setItem("mercury-theme-preset", preset); } catch {}
  },
  setThemeMode: (mode) => {
    set({ themeMode: mode });
    const root = document.documentElement;
    root.classList.remove("force-light", "force-dark", "force-eyecare");
    let resolved = mode;
    if (mode === "auto") {
      const systemDark = getComputedStyle(root).getPropertyValue("--system-is-dark").trim();
      resolved = systemDark === "1" ? "forceDark" : "forceLight";
    }
    if (resolved === "forceDark") root.classList.add("force-dark");
    else if (resolved === "forceLight") root.classList.add("force-light");
    else if (resolved === "eyecare") root.classList.add("force-eyecare");
    try { localStorage.setItem("mercury-theme-mode", mode); } catch {}
  },
  setEffectiveTheme: (theme) => set({ effectiveTheme: theme }),
  setThemeTokens: (tokens) => set({ themeTokens: tokens }),
  setQuickStyle: (style) => {
    set({ quickStyle: style });
    try { localStorage.setItem("mercury-quick-style", style); } catch {}
  },
  setFontFamily: (font) => {
    set({ fontFamily: font });
    try { localStorage.setItem("mercury-font-family", font); } catch {}
  },
  setFontSize: (size) => {
    set({ fontSize: size });
    try { localStorage.setItem("mercury-font-size", String(size)); } catch {}
  },
  setLineHeight: (lh) => {
    set({ lineHeight: lh });
    try { localStorage.setItem("mercury-line-height", String(lh)); } catch {}
  },
  setContentWidth: (width) => {
    set({ contentWidth: width });
    try { localStorage.setItem("mercury-content-width", String(width)); } catch {}
  },
  resetTheme: () => set({
    themePreset: DEFAULT_THEME_PRESET,
    themeTokens: DEFAULT_THEME_TOKENS[DEFAULT_THEME_PRESET],
    quickStyle: "none",
    fontFamily: "Georgia, serif",
    fontSize: 16,
    lineHeight: 1.8,
    contentWidth: 720,
  }),

  // Content
  buildReaderHTML: async (entryUrl, entryId, bypassCache?: boolean) => {
    const cache = get().readerCache;
    // Check cache first — instant for recently viewed articles
    if (!bypassCache) {
      const cached = cache.get(entryUrl);
      if (cached) {
        set({ readerHTML: cached, readerLoading: false });
        return;
      }
    }

    set({ readerLoading: true });
    try {
      // Resolve "auto" mode to actual system preference
      let resolvedMode = get().themeMode;
      if (resolvedMode === "auto") {
        resolvedMode = window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "forceDark"
          : "forceLight";
      }
      const theme = {
        fontFamily: get().fontFamily,
        fontSize: get().fontSize,
        lineHeight: get().lineHeight,
        contentWidth: get().contentWidth,
        quickStyle: get().quickStyle,
        themeMode: resolvedMode,
      };
      const result = await ipc.buildReaderHTML(entryUrl, entryId, theme);
      set({ readerHTML: result.html, readerLoading: false });

      // Cache the result (LRU: evict oldest if over 30 entries)
      const next = new Map(cache);
      next.set(entryUrl, result.html);
      while (next.size > 30) {
        const oldest = next.keys().next().value;
        if (oldest) next.delete(oldest);
      }
      set({ readerCache: next });
    } catch (err) {
      console.error("buildReaderHTML:", err);
      set({ readerLoading: false });
    }
  },
  buildTranslationHTML: async (entryId, targetLang) => {
    try {
      const html = await ipc.buildTranslationHTML(entryId, targetLang);
      set({ translationHTML: html });
    } catch (err) { console.error("buildTranslationHTML:", err); }
  },
  setTranslationHTML: (html) => set({ translationHTML: html }),
  setReadingMode: (mode) => set({ readingMode: mode }),

  // Banner
  setBanner: (message, type, action) => set({
    bannerMessage: message,
    bannerType: (type ?? "info") as "info",
    bannerAction: action ?? null,
  }),

  // Panels
  setActivePanel: (panel) => set({ activePanel: panel, openPanel: panel }),
  togglePanel: (panel) => set((s) => ({
    activePanel: s.activePanel === panel ? null : panel,
    openPanel: s.openPanel === panel ? null : panel,
  })),
  closePanel: () => set({ openPanel: null, activePanel: null }),

  // Summary
  setSummaryOpen: (open) => set({ summaryOpen: open }),
  setSummaryTargetLanguage: (lang) => set({ summaryTargetLanguage: lang }),
  setSummaryDetailLevel: (level) => set({ summaryDetailLevel: level }),
  setSummaryAutoEnabled: (enabled) => set({ summaryAutoEnabled: enabled }),
  setSummaryText: (text) => set({ summaryText: text }),
  setSummaryLoading: (loading) => set({ summaryLoading: loading }),
  loadSummary: async (entryId, detailLevel) => {
    set({ summaryLoading: true, summaryError: null });
    try {
      const result = await ipc.getSummary(entryId);
      if (!result) {
        const generated: any = await ipc.generateSummary(entryId, detailLevel);
        set({ summaryText: generated?.text ?? "", summaryHTML: generated?.html ?? "", summaryLoading: false });
      } else {
        set({ summaryResult: result, summaryText: result.text ?? "", summaryLoading: false });
      }
    } catch (err) {
      set({ summaryError: String(err), summaryLoading: false });
    }
  },

  // Translation
  setTranslationEnabled: (enabled) => set({ translationEnabled: enabled }),
  setTranslationBilingual: (bilingual) => set({ translationBilingual: bilingual }),
  setTranslationTargetLanguage: (lang) => set({ translationTargetLanguage: lang, translationTargetLang: lang }),
  setTranslationConcurrency: (n) => set({ translationConcurrency: n }),
  setTranslationPromptStrategy: (strategy) => set({ translationPromptStrategy: strategy }),
  setTranslationProgress: (progress) => set({ translationProgress: progress }),
  loadTranslationSegments: async (entryId, targetLanguage) => {
    set({ translationLoading: true, translationError: null });
    try {
      const segments = await ipc.getTranslationSegments(entryId, targetLanguage);
      set({ translationSegments: segments, translationTargetLang: targetLanguage, translationLoading: false });
    } catch (err) {
      set({ translationError: String(err), translationLoading: false });
    }
  },

  // Notes
  setNoteText: (text) => set({ noteText: text }),
  saveNote: async (entryId) => {
    set({ noteSaveState: "saving" });
    try { await ipc.saveNote(entryId, get().noteText); set({ noteSaveState: "saved" }); }
    catch (err) { set({ noteSaveState: "error" }); }
  },

  resetReaderState: () => set({
    readerHTML: null, readerLoading: false, entryTitle: null, readingMode: "reader",
    summaryResult: null, summaryText: "", summaryHTML: "", translationSegments: [],
    noteText: "", openPanel: null, activePanel: null,
    bannerMessage: null, bannerAction: null,
  }),
}));

// Listen for system color-scheme changes when in Auto mode.
if (typeof window !== "undefined") {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    const store = useReaderStore.getState();
    if (store.themeMode !== "auto") return;
    // Re-apply with a small delay to let CSS update the --system-is-dark property.
    setTimeout(() => {
      const root = document.documentElement;
      const systemDark = getComputedStyle(root).getPropertyValue("--system-is-dark").trim();
      root.classList.remove("force-light", "force-dark");
      root.classList.add(systemDark === "1" ? "force-dark" : "force-light");
    }, 50);
  });
}
