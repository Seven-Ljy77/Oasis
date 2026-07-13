import React from "react";
import { useAppStore } from "@/stores/useAppStore";
import { useSidebarStore } from "@/stores/useSidebarStore";
import FeedList from "./FeedList";
import TagFilter from "./TagFilter";

const SidebarView: React.FC = () => {
  const sidebarSection = useAppStore((s) => s.sidebarSection);
  const switchSection = useAppStore((s) => s.switchSection);
  const syncState = useSidebarStore((s) => s.syncState);

  return (
    <div className="flex flex-col h-full">
      {/* ---- Section toggle (pill/tab) ---- */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex bg-surface-tertiary rounded-lg p-0.5">
          <button
            onClick={() => switchSection("feeds")}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
              sidebarSection === "feeds"
                ? "bg-surface text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Feeds
          </button>
          <button
            onClick={() => switchSection("tags")}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
              sidebarSection === "tags"
                ? "bg-surface text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Tags
          </button>
        </div>
      </div>

      {/* ---- Active section content ---- */}
      <div className="flex-1 overflow-hidden">
        {sidebarSection === "feeds" ? <FeedList /> : <TagFilter />}
      </div>

      {/* ---- Status bar ---- */}
      <div className="px-3 py-1.5 border-t border-border text-xs text-slate-400 flex items-center gap-2">
        {syncState?.phase === "syncing" && (
          <>
            <svg
              className="animate-spin w-3 h-3"
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
            <span>{syncState.message ?? "Syncing..."}</span>
          </>
        )}
        {syncState?.phase !== "syncing" && (
          <span>
            {useSidebarStore.getState().totalUnread} unread
          </span>
        )}
      </div>
    </div>
  );
};

export default SidebarView;
