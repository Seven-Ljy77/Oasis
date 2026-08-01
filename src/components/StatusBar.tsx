// =============================================================================
// Mercury — StatusBar component (bottom bar)
// =============================================================================

import React from "react";
import { useAppStore } from "@/stores/useAppStore";
import { useAgentStore } from "@/stores/useAgentStore";
import { relativeTime, formatNumber } from "@/lib/format";

/**
 * Bottom status bar showing sync progress, agent task progress,
 * and summary statistics.
 */
export const StatusBar: React.FC = () => {
  const syncState = useAppStore((s) => s.syncState);
  const agentState = useAgentStore((s) => s.agentState);
  const totalUnread = useAppStore((s) => s.totalUnread);
  const feedCount = useAppStore((s) => s.feedCount);
  const entryCount = useAppStore((s) => s.entryCount);
  const lastSyncAt = useAppStore((s) => s.lastSyncAt);
  const selectedEntryId = useAppStore((s) => s.selectedEntryId);
  const sidebarSection = useAppStore((s) => s.sidebarSection);

  const activeRuns = agentState.active_runs ?? [];
  const waitingCount = agentState.waiting_count ?? 0;

  // Compute overall agent progress
  const agentTotal = activeRuns.reduce(
    (sum, r) => sum + (r.progress?.total ?? 0),
    0,
  );
  const agentCompleted = activeRuns.reduce(
    (sum, r) => sum + (r.progress?.completed ?? 0),
    0,
  );
  const hasAgentActivity = activeRuns.length > 0 || waitingCount > 0;

  return (
    <footer className="flex h-7 flex-shrink-0 items-center gap-3 border-t border-border bg-surface-secondary px-3 text-[11px] text-slate-500">
      {/* Sync status */}
      <span className="flex items-center gap-1.5">
        {syncState.phase === "syncing" && (
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
        )}
        {syncState.phase === "idle" && (
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
        )}
        {syncState.phase === "error" && (
          <span className="inline-block h-2 w-2 rounded-full bg-red-400" />
        )}
        {syncState.phase === "syncing"
          ? syncState.message ?? "Syncing..."
          : "Ready"}
      </span>

      <span className="text-slate-300">|</span>

      {/* Navigation context */}
      <span>
        {sidebarSection === "feeds" ? "Feeds" : "Tags"}
        {selectedEntryId ? ` · Article #${selectedEntryId}` : ""}
      </span>

      {/* Spacer */}
      <span className="flex-1" />

      {/* Agent task progress bar */}
      {hasAgentActivity && (
        <>
          <span className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-purple-400" />
            <span>
              AI:{" "}
              {activeRuns.length > 0
                ? `${agentCompleted}/${agentTotal}`
                : `Waiting (${waitingCount})`}
            </span>
          </span>
          {/* Mini progress bar */}
          {agentTotal > 0 && (
            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-accent transition-all duration-500"
                style={{
                  width: `${Math.round((agentCompleted / agentTotal) * 100)}%`,
                }}
              />
            </div>
          )}
          <span className="text-slate-300">|</span>
        </>
      )}

      {/* Stats summary */}
      <span className="tabular-nums">
        {formatNumber(feedCount)} feeds
      </span>
      <span className="text-slate-300">·</span>
      <span className="tabular-nums">
        {formatNumber(entryCount)} entries
      </span>
      <span className="text-slate-300">·</span>
      <span className="tabular-nums">
        {formatNumber(totalUnread)} unread
      </span>

      {lastSyncAt && (
        <>
          <span className="text-slate-300">·</span>
          <span>Last sync: {relativeTime(lastSyncAt)}</span>
        </>
      )}
    </footer>
  );
};
