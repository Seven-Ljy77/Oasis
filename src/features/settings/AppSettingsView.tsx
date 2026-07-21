// =============================================================================
// Mercury — AppSettingsView (settings sheet with tabs)
// =============================================================================

import React from "react";
import GeneralSettings from "./GeneralSettings";
import ReaderSettings from "./ReaderSettings";
import AgentSettingsView from "./AgentSettings/AgentSettingsView";
import DigestSettings from "./DigestSettings";
import UsageReportView from "@/features/usage/UsageReportView";

export interface AppSettingsViewProps {
  open?: boolean;
  /** Currently active tab */
  activeTab?: "general" | "reader" | "agents" | "digest" | "usage";
  /** Called when tab changes */
  onTabChange?: (tab: "general" | "reader" | "agents" | "digest" | "usage") => void;
  /** Called when settings sheet is closed */
  onClose?: () => void;
  className?: string;
}

interface TabDef {
  id: "general" | "reader" | "agents" | "digest" | "usage";
  label: string;
  icon: React.ReactNode;
}

const tabs: TabDef[] = [
  {
    id: "general",
    label: "General",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    ),
  },
  {
    id: "reader",
    label: "Reader",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
        />
      </svg>
    ),
  },
  {
    id: "agents",
    label: "Agents",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 10V3L4 14h7v7l9-11h-7z"
        />
      </svg>
    ),
  },
  {
    id: "digest",
    label: "Digest",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
        />
      </svg>
    ),
  },
  {
    id: "usage",
    label: "Usage",
    icon: (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
];

const AppSettingsView: React.FC<AppSettingsViewProps> = ({
  activeTab: externalTab,
  onTabChange,
  onClose,
  className = "",
}) => {
  const [internalTab, setInternalTab] = React.useState<"general" | "reader" | "agents" | "digest" | "usage">("general");
  const activeTab = externalTab ?? internalTab;

  const handleTabChange = (tab: "general" | "reader" | "agents" | "digest" | "usage") => {
    setInternalTab(tab);
    onTabChange?.(tab);
  };

  // TODO: implement settings persistence via useSettingsStore

  return (
    <div
      data-component="AppSettingsView"
      className={`flex flex-col h-full bg-surface ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-secondary">
        <h2 className="text-base font-semibold text-slate-900">Settings</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-surface-tertiary transition-colors"
            aria-label="Close settings"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-border bg-surface-secondary px-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-accent text-accent"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "general" && <GeneralSettings />}
        {activeTab === "reader" && <ReaderSettings />}
        {activeTab === "agents" && <AgentSettingsView />}
        {activeTab === "digest" && <DigestSettings />}
        {activeTab === "usage" && (
          <div className="p-4">
            <UsageReportView title="Token Usage" subtitle="LLM API token consumption" />
          </div>
        )}
      </div>
    </div>
  );
};

export default AppSettingsView;
