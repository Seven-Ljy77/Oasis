import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ReaderState } from "@/stores/useReaderStore";
import ReaderSummaryPanel from "./ReaderSummaryPanel";

const mocks = vi.hoisted(() => {
  const readerState = {
    summaryOpen: true,
    summaryTargetLanguage: "en",
    summaryDetailLevel: "medium",
    summaryAutoEnabled: false,
    summaryText: "",
    summaryHTML: "",
    summaryResult: null,
    summaryError: null,
    summaryLoading: false,
    setSummaryOpen: vi.fn(),
    setSummaryTargetLanguage: vi.fn(),
    setSummaryDetailLevel: vi.fn(),
    setSummaryAutoEnabled: vi.fn(),
    clearSummary: vi.fn(),
    setSummaryText: vi.fn(),
    setSummaryLoading: vi.fn(),
    loadSummary: vi.fn(),
  } as unknown as ReaderState;

  const useReaderStore = Object.assign(
    (selector: (state: ReaderState) => unknown) => selector(readerState),
    {
      getState: () => readerState,
      setState: vi.fn(),
    },
  );

  const entryState = { selectedEntryId: 1 };
  const useEntryStore = Object.assign(
    (selector: (state: typeof entryState) => unknown) => selector(entryState),
    { getState: () => entryState },
  );

  return { readerState, useReaderStore, useEntryStore };
});

vi.mock("@/stores/useReaderStore", () => ({
  useReaderStore: mocks.useReaderStore,
}));

vi.mock("@/stores/useEntryStore", () => ({
  useEntryStore: mocks.useEntryStore,
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
}));

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({
    t: {
      common: { clear: "Clear" },
      summary: {
        title: "Summary",
        targetLanguage: "Target language",
        detailLevel: "Detail level",
        short: "Short",
        medium: "Medium",
        detailed: "Detailed",
        autoSummary: "Auto summary",
        generate: "Generate",
        copy: "Copy",
        clear: "Clear",
        generating: "Generating",
        ready: "Ready",
      },
    },
  }),
}));

describe("ReaderSummaryPanel output", () => {
  beforeEach(() => {
    mocks.readerState.summaryOpen = true;
    mocks.readerState.summaryText = "";
    mocks.readerState.summaryHTML = "";
    mocks.readerState.summaryResult = null;
    mocks.readerState.summaryError = null;
    mocks.readerState.summaryLoading = false;
  });

  it("shows partial summary text while streaming", () => {
    mocks.readerState.summaryLoading = true;
    mocks.readerState.summaryText = "Partial streamed summary";

    const html = renderToStaticMarkup(<ReaderSummaryPanel />);

    expect(html).toContain("Partial streamed summary");
    expect(html).not.toContain(">Generating<");
  });

  it("renders cached Markdown HTML and the persisted creation time", () => {
    const createdAt = "2026-01-01 00:00:00";
    mocks.readerState.summaryText = "- **Cached** summary";
    mocks.readerState.summaryHTML =
      "<ul><li><strong>Cached</strong> summary</li></ul>";
    mocks.readerState.summaryResult = {
      id: 1,
      task_run_id: null,
      entry_id: 1,
      target_language: "en",
      detail_level: "medium",
      text: mocks.readerState.summaryText,
      created_at: createdAt,
    };

    const html = renderToStaticMarkup(<ReaderSummaryPanel />);
    const expectedTime = new Date("2026-01-01T00:00:00Z").toLocaleTimeString();

    expect(html).toContain("<strong>Cached</strong>");
    expect(html).toContain(`Generated: ${expectedTime}`);
  });
});
