// =============================================================================
// Mercury — LogsSettings (Developer Tools panel)
//
// Diagnostic log viewer with Upload / Clear buttons, level filtering, and
// click-to-expand detail rows.
// =============================================================================

import React, { useEffect, useState, useCallback } from "react";
import * as ipc from "@/lib/ipc";
import type { LogEntry, UploadLogsResponse } from "@/lib/types";
import { useI18n } from "@/lib/i18n";

type LevelFilter = "ALL" | "INFO" | "WARN" | "ERROR";

const FILTER_OPTIONS: LevelFilter[] = ["ALL", "INFO", "WARN", "ERROR"];

const LogsSettings: React.FC = () => {
  const { t } = useI18n();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("ALL");
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const entries = await ipc.getLogs();
      setLogs(entries.reverse());
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleUpload = async () => {
    setUploading(true);
    setUploadResult(null);
    setUploadError(null);
    try {
      const result: UploadLogsResponse = await ipc.uploadLogs();
      setUploadResult(
        t.logs.uploadedMsg.replace("{n}", String(result.uploaded)),
      );
      await fetchLogs();
    } catch (err) {
      setUploadError(`${t.logs.uploadFailed}: ${String(err)}`);
    } finally {
      setUploading(false);
    }
  };

  const handleClear = async () => {
    setClearing(true);
    setUploadResult(null);
    setUploadError(null);
    setError(null);
    try {
      await ipc.clearLogs();
      await fetchLogs();
    } catch (err) {
      setError(String(err));
    } finally {
      setClearing(false);
    }
  };

  const toggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  const filteredLogs =
    levelFilter === "ALL"
      ? logs
      : logs.filter((e) => e.level === levelFilter);

  const levelBadge = (level: string) => {
    const colors: Record<string, string> = {
      INFO: "bg-blue-100 text-blue-700",
      WARN: "bg-amber-100 text-amber-700",
      ERROR: "bg-red-100 text-red-700",
    };
    return (
      <span
        className={`inline-block w-12 text-center text-xs font-medium rounded-full px-2 py-0.5 ${
          colors[level] ?? "bg-gray-100 text-gray-600"
        }`}
      >
        {level}
      </span>
    );
  };

  const filterBadge = (label: LevelFilter) => {
    const counts: Record<LevelFilter, number> = {
      ALL: logs.length,
      INFO: logs.filter((e) => e.level === "INFO").length,
      WARN: logs.filter((e) => e.level === "WARN").length,
      ERROR: logs.filter((e) => e.level === "ERROR").length,
    };
    return counts[label];
  };

  const formatTime = (ts: string) =>
    ts.replace("T", " ").replace(/[Z+].*/, "").slice(0, 19);

  const formatKey = (key: string): string => {
    const acronyms: Record<string, string> = { url: "URL", uri: "URI", id: "ID" };
    const word = key.replace(/_/g, " ");
    return acronyms[key] ?? (word.charAt(0).toUpperCase() + word.slice(1));
  };

  return (
    <div className="p-4 space-y-4">
      {/* ---- Section header ---- */}
      <div>
        <h3 className="text-sm font-semibold text-content-primary">{t.logs.title}</h3>
        <p className="text-xs text-content-muted mt-1">
          {t.logs.description}
        </p>
      </div>

      {/* ---- Action buttons ---- */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={handleUpload}
          disabled={uploading}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-accent text-white hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {uploading ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {t.logs.uploading}
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              {t.logs.uploadLogs}
            </>
          )}
        </button>
        <button
          onClick={handleClear}
          disabled={clearing}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {clearing ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {t.logs.clearing}
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              {t.logs.clearLogs}
            </>
          )}
        </button>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="px-3 py-2 text-sm text-content-secondary hover:text-content-primary border border-border rounded-md transition-colors"
        >
          {t.logs.refresh}
        </button>
      </div>

      {/* ---- Upload success / error ---- */}
      {uploadResult && (
        <div className="px-3 py-2 text-sm rounded-md bg-green-50 text-green-700 border border-green-200">
          {uploadResult}
        </div>
      )}
      {uploadError && (
        <div className="px-3 py-2 text-sm rounded-md bg-red-50 text-red-700 border border-red-200">
          {uploadError}
        </div>
      )}
      {error && (
        <div className="px-3 py-2 text-sm rounded-md bg-red-50 text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {/* ---- Level filter pills ---- */}
      <div className="flex items-center gap-1">
        {FILTER_OPTIONS.map((level) => {
          const active = levelFilter === level;
          return (
            <button
              key={level}
              onClick={() => setLevelFilter(level)}
              className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${
                active
                  ? "bg-surface-secondary border-border text-content-primary"
                  : "border-transparent text-content-muted hover:text-content-secondary"
              }`}
            >
              {level}
              <span className="ml-1 opacity-50">{filterBadge(level)}</span>
            </button>
          );
        })}
      </div>

      {/* ---- Log table ---- */}
      <div>
        <h4 className="text-xs font-medium text-content-secondary mb-2">
          {t.logs.showing} {filteredLogs.length} {t.logs.of} {logs.length} {t.logs.entries}
        </h4>
        {loading ? (
          <p className="text-xs text-content-muted">{t.logs.loading}</p>
        ) : filteredLogs.length === 0 ? (
          <p className="text-xs text-content-muted">{t.logs.noEntries}</p>
        ) : (
          <div className="border border-border rounded-md overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-surface-secondary">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-content-secondary w-44">
                    {t.logs.timestamp}
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-content-secondary w-16">
                    {t.logs.level}
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-content-secondary w-40">
                    {t.logs.event}
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-content-secondary">
                    {t.logs.message}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredLogs.map((entry, i) => {
                  const isExpanded = expandedIndex === i;
                  return (
                    <React.Fragment key={i}>
                      <tr
                        onClick={() => toggleExpand(i)}
                        className={`cursor-pointer transition-colors ${
                          isExpanded
                            ? "bg-accent-muted/10"
                            : "hover:bg-surface-secondary"
                        }`}
                      >
                        <td className="px-3 py-1.5 text-content-muted font-mono whitespace-nowrap">
                          {formatTime(entry.timestamp)}
                        </td>
                        <td className="px-3 py-1.5">{levelBadge(entry.level)}</td>
                        <td className="px-3 py-1.5 font-medium text-content-primary">
                          {entry.event}
                        </td>
                        <td className="px-3 py-1.5 text-content-secondary truncate max-w-xs">
                          {entry.message}
                        </td>
                      </tr>
                      {/* ---- Expanded detail card ---- */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={4} className="px-3 py-2 bg-surface-secondary border-b border-border">
                            <div className="bg-surface rounded-md border border-border p-3">
                              <h4 className="text-xs font-semibold text-content-primary mb-2">
                                {t.logs.logDetails}
                              </h4>
                              <dl className="space-y-1.5 text-xs">
                                <div className="flex gap-3">
                                  <dt className="font-medium text-content-secondary w-20 flex-shrink-0">{t.logs.timestamp}</dt>
                                  <dd className="text-content-primary font-mono">
                                    {formatTime(entry.timestamp)}
                                  </dd>
                                </div>
                                <div className="flex gap-3">
                                  <dt className="font-medium text-content-secondary w-20 flex-shrink-0" />
                                  <dd className="text-content-muted text-[11px]">
                                    {t.logs.timezone}
                                  </dd>
                                </div>
                                <div className="flex gap-3">
                                  <dt className="font-medium text-content-secondary w-20 flex-shrink-0">{t.logs.event}</dt>
                                  <dd className="text-content-primary">{entry.event}</dd>
                                </div>
                                <div className="flex gap-3">
                                  <dt className="font-medium text-content-secondary w-20 flex-shrink-0">{t.logs.message}</dt>
                                  <dd className="text-content-primary">{entry.message}</dd>
                                </div>
                              </dl>

                              {entry.extra && Object.keys(entry.extra).length > 0 && (
                                <div className="mt-3 pt-2 border-t border-border">
                                  <h5 className="text-xs font-medium text-content-secondary mb-1.5">
                                    {t.logs.additionalInfo}
                                  </h5>
                                  <dl className="space-y-1 text-xs">
                                    {Object.entries(entry.extra).map(([key, value]) => (
                                      <div key={key} className="flex gap-3">
                                        <dt className="font-medium text-content-secondary w-20 flex-shrink-0">
                                          {formatKey(key)}
                                        </dt>
                                        <dd className="text-content-primary font-mono">
                                          {typeof value === "string" ? value : JSON.stringify(value)}
                                        </dd>
                                      </div>
                                    ))}
                                  </dl>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default LogsSettings;
