import { beforeEach, describe, expect, it, vi } from "vitest";

import * as ipc from "@/lib/ipc";
import { DEFAULT_THEME_PRESET, DEFAULT_THEME_TOKENS } from "@/lib/constants";
import type { SummaryResult } from "@/lib/types";
import { useReaderStore } from "./useReaderStore";

vi.mock("@/lib/ipc", () => ({
  getSummary: vi.fn(),
  generateSummary: vi.fn(),
  buildReaderHTML: vi.fn(),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function summary(text: string): SummaryResult {
  return {
    id: 1,
    task_run_id: null,
    entry_id: 1,
    target_language: "en",
    detail_level: "medium",
    text,
    created_at: "2026-01-01 00:00:00",
  };
}

describe("useReaderStore summary request isolation", () => {
  beforeEach(() => {
    vi.mocked(ipc.getSummary).mockReset();
    vi.mocked(ipc.generateSummary).mockReset();
    vi.mocked(ipc.buildReaderHTML).mockReset();
    useReaderStore.setState({
      readerHTML: null,
      readerLoading: false,
      readerCache: new Map(),
      summaryEntryId: null,
      summaryRequestId: null,
      summaryTargetLanguage: "en",
      summaryDetailLevel: "medium",
      summaryResult: null,
      summaryText: "",
      summaryHTML: "",
      summaryLoading: false,
      summaryError: null,
    });
  });

  it("does not let an older request overwrite the same slot", async () => {
    const older = deferred<SummaryResult | null>();
    const newer = deferred<SummaryResult | null>();
    vi.mocked(ipc.getSummary)
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise);

    const olderRun = useReaderStore.getState().loadSummary(1, "en", "medium");
    const newerRun = useReaderStore.getState().loadSummary(1, "en", "medium");

    newer.resolve(summary("new"));
    await newerRun;
    older.resolve(summary("old"));
    await olderRun;

    expect(useReaderStore.getState().summaryText).toBe("new");
    expect(useReaderStore.getState().summaryError).toBeNull();
  });

  it("passes a unique request id to generated summary events", async () => {
    vi.mocked(ipc.getSummary).mockResolvedValue(null);
    vi.mocked(ipc.generateSummary).mockResolvedValue({
      task_id: "task",
      text: "generated",
      html: "<p>generated</p>",
    });

    await useReaderStore.getState().loadSummary(1, "en", "medium");

    const requestId = vi.mocked(ipc.generateSummary).mock.calls[0][3];
    expect(requestId).toMatch(/^summary-\d+$/);
    expect(useReaderStore.getState().summaryRequestId).toBe(requestId);
  });

  it("uses cached summary HTML unless regeneration is forced", async () => {
    vi.mocked(ipc.getSummary).mockResolvedValue({
      ...summary("- **Cached** summary"),
      html: "<ul><li><strong>Cached</strong> summary</li></ul>",
    });

    await useReaderStore.getState().loadSummary(1, "en", "medium");

    expect(ipc.getSummary).toHaveBeenCalledWith(1, "en", "medium");
    expect(ipc.generateSummary).not.toHaveBeenCalled();
    expect(useReaderStore.getState()).toMatchObject({
      summaryText: "- **Cached** summary",
      summaryHTML: "<ul><li><strong>Cached</strong> summary</li></ul>",
      summaryResult: { created_at: "2026-01-01 00:00:00" },
    });
  });

  it("skips cached lookup and forwards force for manual regeneration", async () => {
    const fresh = summary("Fresh summary");
    vi.mocked(ipc.generateSummary).mockResolvedValue({
      task_id: "task",
      text: fresh.text,
      html: "<p>Fresh summary</p>",
      result: fresh,
    });

    await useReaderStore.getState().loadSummary(1, "en", "medium", true);

    expect(ipc.getSummary).not.toHaveBeenCalled();
    expect(ipc.generateSummary).toHaveBeenCalledWith(
      1,
      "en",
      "medium",
      expect.stringMatching(/^summary-\d+$/),
      true,
    );
    expect(useReaderStore.getState()).toMatchObject({
      summaryText: "Fresh summary",
      summaryHTML: "<p>Fresh summary</p>",
      summaryResult: fresh,
    });
  });

  it("invalidates a summary when its configured slot changes", () => {
    useReaderStore.setState({
      summaryEntryId: 1,
      summaryRequestId: "summary-active",
      summaryText: "English summary",
      summaryLoading: true,
    });

    useReaderStore.getState().setSummaryTargetLanguage("ja");

    expect(useReaderStore.getState()).toMatchObject({
      summaryTargetLanguage: "ja",
      summaryEntryId: null,
      summaryRequestId: null,
      summaryText: "",
      summaryLoading: false,
    });
  });

  it("invalidates translation state when the target language changes", () => {
    useReaderStore.setState({
      translationTargetLanguage: "en",
      translationTargetLang: "en",
      translationRequestId: "translation-active",
      translationSegments: [
        {
          segment_id: "p-0",
          source_text: "Hello",
          translated_text: "Bonjour",
          order_index: 0,
          status: "completed",
        },
      ],
      translationLoading: true,
    });

    useReaderStore.getState().setTranslationTargetLanguage("fr");

    expect(useReaderStore.getState()).toMatchObject({
      translationTargetLanguage: "fr",
      translationTargetLang: "fr",
      translationRequestId: null,
      translationSegments: [],
      translationLoading: false,
    });
  });

  it("prevents an invalidated reader request from restoring stale content", async () => {
    const pending = deferred<{ html: string; theme_fingerprint: string }>();
    vi.mocked(ipc.buildReaderHTML).mockReturnValue(pending.promise);

    const build = useReaderStore
      .getState()
      .buildReaderHTML("https://example.com/old", 1);
    useReaderStore.getState().invalidateReaderContent();
    pending.resolve({ html: "<p>Old article</p>", theme_fingerprint: "old" });
    await build;

    expect(useReaderStore.getState().readerHTML).toBeNull();
    expect(useReaderStore.getState().readerLoading).toBe(false);
  });

  it("passes the preset and resolved system appearance to the reader", async () => {
    vi.mocked(ipc.buildReaderHTML).mockResolvedValue({
      html: "<p>Article</p>",
      theme_fingerprint: "paper-dark",
    });
    useReaderStore.setState({
      themePreset: "paper",
      themeMode: "auto",
      effectiveTheme: "dark",
    });

    await useReaderStore
      .getState()
      .buildReaderHTML("https://example.com/article", 2);

    expect(vi.mocked(ipc.buildReaderHTML).mock.calls[0][2]).toMatchObject({
      themePreset: "paper",
      themeMode: "forceDark",
    });
  });

  it("resets theme fields to the preset defaults and persists them", () => {
    const setItem = vi.fn();
    vi.stubGlobal("localStorage", { setItem });
    const tokens = DEFAULT_THEME_TOKENS[DEFAULT_THEME_PRESET];

    useReaderStore.setState({
      themePreset: "paper",
      quickStyle: "warm",
      fontFamily: "Custom Font",
      fontSize: 24,
      lineHeight: 2.2,
      contentWidth: 1000,
    });
    useReaderStore.getState().resetTheme();

    expect(useReaderStore.getState()).toMatchObject({
      themePreset: DEFAULT_THEME_PRESET,
      themeTokens: tokens,
      quickStyle: "none",
      fontFamily: tokens.fontFamily,
      fontSize: tokens.fontSize,
      lineHeight: tokens.lineHeight,
      contentWidth: tokens.contentMaxWidth,
    });
    expect(setItem).toHaveBeenCalledWith(
      "mercury-theme-preset",
      DEFAULT_THEME_PRESET,
    );
    expect(setItem).toHaveBeenCalledWith("mercury-font-size", String(tokens.fontSize));
    expect(setItem).toHaveBeenCalledWith(
      "mercury-content-width",
      String(tokens.contentMaxWidth),
    );
    vi.unstubAllGlobals();
  });
});
