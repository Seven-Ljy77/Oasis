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
  readerCache: Map<string, string>;  // entry + theme -> rendered HTML, max 30 entries

  // Banner
  bannerMessage: string | null;
  bannerType: "info" | "success" | "warning" | "error";
  bannerAction: { label: string; onClick: () => void } | null;

  // Summary panel
  activePanel: ReaderPanel;
  summaryOpen: boolean;
  summaryResult: SummaryResult | null;
  summaryEntryId: number | null;
  summaryRequestId: string | null;
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
  translationRequestId: string | null;
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
  invalidateReaderContent: () => void;
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
  clearSummary: () => void;
  loadSummary: (
    entryId: number,
    targetLanguage: string,
    detailLevel: string,
    force?: boolean,
  ) => Promise<void>;

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

function getSystemTheme(): "light" | "dark" {
  return typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

const initialThemePreset = loadPref(
  "mercury-theme-preset",
  (value) => value as ThemePreset,
  DEFAULT_THEME_PRESET,
);

const initialState = {
  themePreset: initialThemePreset,
  themeMode: loadPref("mercury-theme-mode", (v) => v as ThemeMode, "auto" as ThemeMode),
  effectiveTheme: getSystemTheme(),
  themeTokens: DEFAULT_THEME_TOKENS[initialThemePreset],
  quickStyle: loadPref("mercury-quick-style", (v) => v, "none"),
  fontFamily: loadPref(
    "mercury-font-family",
    (v) => v,
    DEFAULT_THEME_TOKENS[initialThemePreset].fontFamily,
  ),
  fontSize: loadPref(
    "mercury-font-size",
    (v) => Number(v) || DEFAULT_THEME_TOKENS[initialThemePreset].fontSize,
    DEFAULT_THEME_TOKENS[initialThemePreset].fontSize,
  ),
  lineHeight: loadPref(
    "mercury-line-height",
    (v) => Number(v) || DEFAULT_THEME_TOKENS[initialThemePreset].lineHeight,
    DEFAULT_THEME_TOKENS[initialThemePreset].lineHeight,
  ),
  contentWidth: loadPref(
    "mercury-content-width",
    (v) => Number(v) || DEFAULT_THEME_TOKENS[initialThemePreset].contentMaxWidth,
    DEFAULT_THEME_TOKENS[initialThemePreset].contentMaxWidth,
  ),

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
  summaryEntryId: null as number | null,
  summaryRequestId: null as string | null,
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
  translationRequestId: null as string | null,
  translationLoading: false,
  translationError: null as string | null,

  noteText: "",
  noteSaveState: "idle" as "idle" | "saving" | "saved" | "error",

  openPanel: null as ReaderPanel,
};

let latestReaderRequestId = 0;
let latestSummaryRequestId = 0;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useReaderStore = create<ReaderState>()((set, get) => ({
  ...initialState,

  // Theme
  setThemePreset: (preset) => {
    const tokens = DEFAULT_THEME_TOKENS[preset];
    set({
      themePreset: preset,
      themeTokens: tokens,
      fontFamily: tokens.fontFamily,
      fontSize: tokens.fontSize,
      lineHeight: tokens.lineHeight,
      contentWidth: tokens.contentMaxWidth,
    });
    try {
      localStorage.setItem("mercury-theme-preset", preset);
      localStorage.setItem("mercury-font-family", tokens.fontFamily);
      localStorage.setItem("mercury-font-size", String(tokens.fontSize));
      localStorage.setItem("mercury-line-height", String(tokens.lineHeight));
      localStorage.setItem("mercury-content-width", String(tokens.contentMaxWidth));
    } catch {}
  },
  setThemeMode: (mode) => {
    const effectiveTheme =
      mode === "forceDark"
        ? "dark"
        : mode === "auto"
          ? getSystemTheme()
          : "light";
    set({ themeMode: mode, effectiveTheme });
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      root.classList.remove("force-light", "force-dark", "force-eyecare");
      const resolved =
        mode === "auto"
          ? effectiveTheme === "dark"
            ? "forceDark"
            : "forceLight"
          : mode;
      if (resolved === "forceDark") root.classList.add("force-dark");
      else if (resolved === "forceLight") root.classList.add("force-light");
      else if (resolved === "eyecare") root.classList.add("force-eyecare");
    }
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
  resetTheme: () => {
    const tokens = DEFAULT_THEME_TOKENS[DEFAULT_THEME_PRESET];
    set({
      themePreset: DEFAULT_THEME_PRESET,
      themeTokens: tokens,
      quickStyle: "none",
      fontFamily: tokens.fontFamily,
      fontSize: tokens.fontSize,
      lineHeight: tokens.lineHeight,
      contentWidth: tokens.contentMaxWidth,
    });
    try {
      localStorage.setItem("mercury-theme-preset", DEFAULT_THEME_PRESET);
      localStorage.setItem("mercury-quick-style", "none");
      localStorage.setItem("mercury-font-family", tokens.fontFamily);
      localStorage.setItem("mercury-font-size", String(tokens.fontSize));
      localStorage.setItem("mercury-line-height", String(tokens.lineHeight));
      localStorage.setItem("mercury-content-width", String(tokens.contentMaxWidth));
    } catch {}
  },

  // Content
  buildReaderHTML: async (entryUrl, entryId, bypassCache?: boolean) => {
    const requestId = ++latestReaderRequestId;
    const state = get();
    let resolvedMode = state.themeMode;
    if (resolvedMode === "auto") {
      resolvedMode = state.effectiveTheme === "dark"
        ? "forceDark"
        : "forceLight";
    }
    const theme = {
      themePreset: state.themePreset,
      fontFamily: state.fontFamily,
      fontSize: state.fontSize,
      lineHeight: state.lineHeight,
      contentWidth: state.contentWidth,
      quickStyle: state.quickStyle,
      themeMode: resolvedMode,
    };
    const cacheKey = JSON.stringify([entryId ?? entryUrl, theme]);
    const cache = state.readerCache;

    if (!bypassCache) {
      const cached = cache.get(cacheKey);
      if (cached) {
        set({ readerHTML: cached, readerLoading: false });
        return;
      }
    }

    set({ readerLoading: true });
    try {
      const result = await ipc.buildReaderHTML(entryUrl, entryId, theme);
      if (requestId === latestReaderRequestId) {
        set({ readerHTML: result.html, readerLoading: false });
      }

      // Cache the result (LRU: evict oldest if over 30 entries)
      set((current) => {
        const next = new Map(current.readerCache);
        next.delete(cacheKey);
        next.set(cacheKey, result.html);
        while (next.size > 30) {
          const oldest = next.keys().next().value;
          if (oldest) next.delete(oldest);
        }
        return { readerCache: next };
      });
    } catch (err) {
      console.error("buildReaderHTML:", err);
      if (requestId === latestReaderRequestId) {
        set({ readerLoading: false });
      }
    }
  },
  invalidateReaderContent: () => {
    latestReaderRequestId += 1;
    set({ readerHTML: null, readerLoading: false });
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
  setSummaryTargetLanguage: (lang) =>
    set((state) =>
      state.summaryTargetLanguage === lang
        ? {}
        : {
            summaryTargetLanguage: lang,
            summaryResult: null,
            summaryEntryId: null,
            summaryRequestId: null,
            summaryText: "",
            summaryHTML: "",
            summaryLoading: false,
            summaryError: null,
          },
    ),
  setSummaryDetailLevel: (level) =>
    set((state) =>
      state.summaryDetailLevel === level
        ? {}
        : {
            summaryDetailLevel: level,
            summaryResult: null,
            summaryEntryId: null,
            summaryRequestId: null,
            summaryText: "",
            summaryHTML: "",
            summaryLoading: false,
            summaryError: null,
          },
    ),
  setSummaryAutoEnabled: (enabled) => set({ summaryAutoEnabled: enabled }),
  setSummaryText: (text) => set({ summaryText: text }),
  setSummaryLoading: (loading) => set({ summaryLoading: loading }),
  clearSummary: () =>
    set({
      summaryResult: null,
      summaryEntryId: null,
      summaryRequestId: null,
      summaryText: "",
      summaryHTML: "",
      summaryLoading: false,
      summaryError: null,
    }),
  loadSummary: async (entryId, targetLanguage, detailLevel, force = false) => {
    const requestId = "summary-" + ++latestSummaryRequestId;
    set({
      summaryLoading: true,
      summaryError: null,
      summaryEntryId: entryId,
      summaryRequestId: requestId,
      summaryResult: null,
      summaryText: "",
      summaryHTML: "",
    });
    const isCurrentRequest = () => {
      const current = get();
      return (
        current.summaryRequestId === requestId &&
        current.summaryEntryId === entryId &&
        current.summaryTargetLanguage === targetLanguage &&
        current.summaryDetailLevel === detailLevel
      );
    };
    try {
      const result = force
        ? null
        : await ipc.getSummary(entryId, targetLanguage, detailLevel);
      if (!isCurrentRequest()) return;
      if (!result) {
        const generated = await ipc.generateSummary(
          entryId,
          targetLanguage,
          detailLevel,
          requestId,
          force,
        );
        if (!isCurrentRequest()) return;
        set({
          summaryResult: generated.result ?? null,
          summaryText: generated.text ?? "",
          summaryHTML: generated.html ?? "",
          summaryLoading: false,
        });
      } else {
        if (!isCurrentRequest()) return;
        set({
          summaryResult: result,
          summaryText: result.text ?? "",
          summaryHTML: result.html ?? "",
          summaryLoading: false,
        });
      }
    } catch (err) {
      if (isCurrentRequest()) {
        set({ summaryError: String(err), summaryLoading: false });
      }
    }
  },

  // Translation
  setTranslationEnabled: (enabled) => set({ translationEnabled: enabled }),
  setTranslationBilingual: (bilingual) => set({ translationBilingual: bilingual }),
  setTranslationTargetLanguage: (lang) =>
    set((state) =>
      state.translationTargetLanguage === lang
        ? {}
        : {
            translationTargetLanguage: lang,
            translationTargetLang: lang,
            translationHTML: null,
            translationSegments: [],
            translationRequestId: null,
            translationProgress: null,
            translationLoading: false,
            translationError: null,
          },
    ),
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

  resetReaderState: () => {
    latestReaderRequestId += 1;
    set({
      readerHTML: null, readerLoading: false, entryTitle: null, readingMode: "reader",
      summaryResult: null, summaryEntryId: null, summaryRequestId: null,
      summaryText: "", summaryHTML: "", summaryLoading: false, summaryError: null,
      translationSegments: [], translationRequestId: null,
      translationProgress: null, translationLoading: false, translationError: null,
      noteText: "", openPanel: null, activePanel: null,
      bannerMessage: null, bannerAction: null,
    });
  },
}));

// Listen for system color-scheme changes when in Auto mode.
if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (event) => {
    const store = useReaderStore.getState();
    if (store.themeMode !== "auto") return;
    const effectiveTheme = event.matches ? "dark" : "light";
    useReaderStore.setState({ effectiveTheme });
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      root.classList.remove("force-light", "force-dark");
      root.classList.add(event.matches ? "force-dark" : "force-light");
    }
  });
}
