import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ReaderState } from "@/stores/useReaderStore";
import ReaderTranslationPanel from "./ReaderTranslationPanel";

const mocks = vi.hoisted(() => {
  const readerState = {
    translationEnabled: true,
    translationBilingual: false,
    translationTargetLanguage: "en",
    translationConcurrency: 3,
    translationRequestId: null,
    translationLoading: false,
    translationError: null,
    translationSegments: [],
    setTranslationEnabled: vi.fn(),
    setTranslationBilingual: vi.fn(),
    setTranslationTargetLanguage: vi.fn(),
    setTranslationConcurrency: vi.fn(),
    setTranslationProgress: vi.fn(),
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
      translation: {
        title: "Translation",
        failed: "Failed",
        translating: "Translating",
        completed: "Completed",
        ready: "Ready",
        start: "Start",
        targetLanguage: "Target language",
        bilingual: "Bilingual",
        concurrency: "Concurrency",
      },
    },
  }),
}));

describe("ReaderTranslationPanel persisted state", () => {
  beforeEach(() => {
    mocks.readerState.translationRequestId = null;
    mocks.readerState.translationLoading = false;
    mocks.readerState.translationError = null;
    mocks.readerState.translationSegments = [];
  });

  it("shows completed segments on a fresh mount", () => {
    mocks.readerState.translationSegments = [
      {
        segment_id: "p-0",
        source_text: "Hello",
        translated_text: "Bonjour",
        order_index: 0,
        status: "completed",
      },
    ];

    const html = renderToStaticMarkup(<ReaderTranslationPanel />);

    expect(html).toContain("Completed: 1 segments");
    expect(html).not.toContain(">Ready<");
  });

  it("shows a persisted failure on a fresh mount", () => {
    mocks.readerState.translationError = "Provider unavailable";

    const html = renderToStaticMarkup(<ReaderTranslationPanel />);

    expect(html).toContain("Failed");
    expect(html).toContain("Provider unavailable");
  });

  it("keeps partial segments in the translating state after remount", () => {
    mocks.readerState.translationRequestId = "translation-active";
    mocks.readerState.translationLoading = true;
    mocks.readerState.translationSegments = [
      {
        segment_id: "p-0",
        source_text: "Hello",
        translated_text: "Bonjour",
        order_index: 0,
        status: "completed",
      },
    ];

    const html = renderToStaticMarkup(<ReaderTranslationPanel />);

    expect(html).toContain("Translating (1 segments)");
    expect(html).not.toContain("Completed: 1 segments");
  });
});
