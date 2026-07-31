// =============================================================================
// Mercury — Root App component (three-column layout)
// =============================================================================

import React, { useEffect, useState } from "react";
import { I18nProvider } from "@/lib/i18n";
import { useAppStore } from "@/stores/useAppStore";
import { useFeedStore } from "@/stores/useFeedStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useTagStore } from "@/stores/useTagStore";
import { useReaderStore } from "@/stores/useReaderStore";
import { useEntryStore } from "@/stores/useEntryStore";
import { useSidebarStore } from "@/stores/useSidebarStore";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import SidebarView from "@/features/sidebar/SidebarView";
import EntryListView from "@/features/entry-list/EntryListView";
import ReaderDetailView from "@/features/reader/ReaderDetailView";
import AppSettingsView from "@/features/settings/AppSettingsView";
import FeedEditorSheet from "@/features/sidebar/FeedEditorSheet";
import ImportOPMLSheet from "@/features/sidebar/ImportOPMLSheet";
import TagLibrarySheet from "@/features/tags/TagLibrarySheet";
import BatchTaggingSheet from "@/features/tags/BatchTaggingSheet";
import ShareDigestSheet from "@/features/digest/ShareDigestSheet";
import ExportDigestSheet from "@/features/digest/ExportDigestSheet";
import ExportMultipleDigestSheet from "@/features/digest/ExportMultipleDigestSheet";
import TagRenameSheet from "@/features/tags/TagRenameSheet";
import TagMergeSheet from "@/features/tags/TagMergeSheet";
import SearchModal from "@/features/entry-list/SearchModal";
import { useResizableWidth } from "@/hooks/useResizableWidth";

const AppShell: React.FC = () => {
  // ---- Bootstrap ----
  const bootstrap = useAppStore((s) => s.bootstrap);
  const isReady = useAppStore((s) => s.isReady);
  const loadFeeds = useFeedStore((s) => s.loadFeeds);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const loadTags = useTagStore((s) => s.loadTags);
  const loadCounts = useSidebarStore((s) => s.loadCounts);
  const tagStoreTags = useTagStore((s) => s.tags);

  useEffect(() => {
    // Apply initial theme class immediately on mount.
    // Use CSS custom property fallback for system dark detection (more reliable
    // than matchMedia in WebView2).
    const mode = useReaderStore.getState().themeMode;
    const root = document.documentElement;
    root.classList.remove("force-light", "force-dark", "force-eyecare");
    if (mode === "auto") {
      const systemDark = getComputedStyle(root).getPropertyValue("--system-is-dark").trim();
      root.classList.add(systemDark === "1" ? "force-dark" : "force-light");
    } else if (mode === "forceDark") {
      root.classList.add("force-dark");
    } else if (mode === "forceLight") {
      root.classList.add("force-light");
    } else if (mode === "eyecare") {
      root.classList.add("force-eyecare");
    }

    const doBootstrap = async () => {
      try {
        await loadSettings();
        await Promise.all([loadFeeds(), loadTags()]);
        await loadCounts();
        bootstrap();
      } catch (err) {
        console.error("Bootstrap failed:", err);
      }
    };
    doBootstrap();
  }, []);

  // ---- Global keyboard shortcuts ----
  useKeyboardShortcuts();

  // ---- Sheet management ----
  const activeSheet = useAppStore((s) => s.activeSheet);
  const closeSheet = useAppStore((s) => s.closeSheet);

  // ---- Font scaling ----
  const fontScale = useAppStore((s) => s.fontScale);

  // ---- Status bar info ----
  const sidebarSection = useAppStore((s) => s.sidebarSection);
  const selectedEntryId = useAppStore((s) => s.selectedEntryId);

  // ---- Tag rename sheet props ----
  const renameTargetTagId = useAppStore((s) => s.renameTargetTagId);
  const renameTargetTagName = useAppStore((s) => s.renameTargetTagName);

  // ---- Tag merge sheet props ----
  const mergeSourceTagId = useAppStore((s) => s.mergeSourceTagId);
  const mergeSourceTagName = useAppStore((s) => s.mergeSourceTagName);

  // Draggable column widths
  const { panelRef: sidebarRef, dragHandle: sidebarDrag } = useResizableWidth("left", "sidebar-v2", 240, 180, 360);
  const { panelRef: entryListRef, dragHandle: centerDrag } = useResizableWidth("left", "entrylist-v2", 340, 250, 550);

  // Column collapse state — when both collapsed, reader takes full screen
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [entriesCollapsed, setEntriesCollapsed] = useState(false);

  const saveAndCollapse = (
    panelRef: React.RefObject<HTMLDivElement | null>,
    storageKey: string,
    setCollapsed: (v: boolean) => void,
  ) => {
    if (panelRef.current) {
      const w = panelRef.current.offsetWidth;
      if (w > 0) {
        try { localStorage.setItem(`panel-width-${storageKey}`, String(w)); } catch {}
      }
    }
    setCollapsed(true);
  };

  const expand = (
    panelRef: React.RefObject<HTMLDivElement | null>,
    storageKey: string,
    defaultW: number,
    setCollapsed: (v: boolean) => void,
  ) => {
    const el = panelRef.current;
    if (el) {
      let w = defaultW;
      try {
        const raw = localStorage.getItem(`panel-width-${storageKey}`);
        if (raw) {
          const parsed = parseInt(raw);
          if (!isNaN(parsed) && parsed > 0) w = parsed;
        }
      } catch {}
      el.style.width = `${w}px`;
    }
    setCollapsed(false);
  };

  const renderSheet = () => {
    switch (activeSheet) {
      case "appSettings":
        return <AppSettingsView open onClose={closeSheet} />;
      case "feedEditor":
        return <FeedEditorSheet open onClose={closeSheet} />;
      case "importOPML":
        return <ImportOPMLSheet open onClose={closeSheet} />;
      case "tagLibrary":
        return <TagLibrarySheet open onClose={closeSheet} />;
      case "batchTagging":
        return <BatchTaggingSheet open onClose={closeSheet} />;
      case "shareDigest":
        return <ShareDigestSheet open onClose={closeSheet} />;
      case "exportDigest":
        return <ExportDigestSheet open onClose={closeSheet} />;
      case "exportMultipleDigest":
        return <ExportMultipleDigestSheet open onClose={closeSheet} />;
      case "tagRename":
        return (
          <TagRenameSheet
            open
            onClose={closeSheet}
            tagId={renameTargetTagId ?? 0}
            currentName={renameTargetTagName ?? ""}
          />
        );
      case "tagMerge":
        return (
          <TagMergeSheet
            open
            onClose={closeSheet}
            sourceTagId={mergeSourceTagId}
            sourceTagName={mergeSourceTagName ?? ""}
            tags={tagStoreTags}
          />
        );
      default:
        return null;
    }
  };

  if (!isReady) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-surface text-slate-500">
        <div className="flex flex-col items-center gap-3">
          <svg
            className="animate-spin h-8 w-8 text-accent"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span className="text-sm">Loading Oasis...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-screen w-screen bg-surface text-slate-900 overflow-hidden"
      style={{ fontSize: `${fontScale * 100}%` }}
    >
      {/* ---- Search modal ---- */}
      <SearchModal />

      {/* ---- Three-column layout ---- */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: sidebar — always mounted, hidden when collapsed */}
        {sidebarCollapsed && (
          <div
            onClick={() => expand(sidebarRef, "sidebar-v2", 240, setSidebarCollapsed)}
            className="flex-shrink-0 w-9 border-r border-border bg-surface-secondary flex flex-col items-center pt-2 cursor-pointer hover:bg-surface-tertiary transition-colors"
            title="Show sidebar"
          >
            <svg className="w-4 h-4 text-slate-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        )}
        <aside ref={sidebarRef as any} className={`flex-shrink-0 border-r border-border bg-surface-secondary overflow-hidden flex flex-col ${sidebarCollapsed ? "!w-0 !border-r-0 !overflow-hidden" : ""}`}>
          <div className="flex items-center justify-end px-2 py-0.5 border-b border-border/50 bg-surface-tertiary/50 flex-shrink-0">
            <button
              onClick={() => saveAndCollapse(sidebarRef, "sidebar-v2", setSidebarCollapsed)}
              className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-surface-tertiary active:bg-surface-tertiary/70 transition-colors"
              title="Hide sidebar"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <SidebarView />
          </div>
        </aside>
        {!sidebarCollapsed && sidebarDrag}

        {/* Center: entry list — always mounted, hidden when collapsed */}
        {entriesCollapsed && (
          <div
            onClick={() => expand(entryListRef, "entrylist-v2", 340, setEntriesCollapsed)}
            className="flex-shrink-0 w-9 border-r border-border bg-surface-secondary flex flex-col items-center pt-2 cursor-pointer hover:bg-surface-tertiary transition-colors"
            title="Show entry list"
          >
            <svg className="w-4 h-4 text-slate-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        )}
        <div ref={entryListRef as any} className={`flex-shrink-0 h-full overflow-hidden border-r border-border flex flex-col ${entriesCollapsed ? "!w-0 !border-r-0 !overflow-hidden" : ""}`}>
          <div className="flex items-center justify-end px-2 py-0.5 border-b border-border/50 bg-surface-tertiary/50 flex-shrink-0">
            <button
              onClick={() => saveAndCollapse(entryListRef, "entrylist-v2", setEntriesCollapsed)}
              className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-surface-tertiary active:bg-surface-tertiary/70 transition-colors"
              title="Hide entry list"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <EntryListView />
          </div>
        </div>
        {!entriesCollapsed && centerDrag}

        {/* Right: reader */}
        <div className="flex-1 h-full overflow-hidden">
          <ReaderDetailView />
        </div>
      </div>

      {/* ---- Status bar ---- */}
      <footer className="h-7 flex-shrink-0 border-t border-border bg-surface-secondary px-3 flex items-center text-xs text-slate-500 gap-3">
        <span>
          {sidebarSection === "feeds" ? "Feeds" : "Tags"}
          {selectedEntryId ? ` | Article #${selectedEntryId}` : " | No selection"}
        </span>
        <span className="flex-1" />
        <span>Oasis v0.1.0</span>
      </footer>

      {/* ---- Overlay sheets ---- */}
      {renderSheet()}
    </div>
  );
};

export const App: React.FC = () => (
  <I18nProvider>
    <AppShell />
  </I18nProvider>
);
