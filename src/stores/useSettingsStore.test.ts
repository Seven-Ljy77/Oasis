import { beforeEach, describe, expect, it, vi } from "vitest";

import * as ipc from "@/lib/ipc";
import type { AppSettings } from "@/lib/types";
import { useSettingsStore } from "./useSettingsStore";

vi.mock("@/lib/ipc", () => ({
  saveSettings: vi.fn(),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function settings(syncConcurrency: number): AppSettings {
  return {
    language: "en",
    sync_concurrency: syncConcurrency,
    usage_retention_months: null,
    ai_tagging_enabled: false,
    digest_export_folder: null,
    digest_template: "customize",
  };
}

describe("useSettingsStore concurrent saves", () => {
  beforeEach(() => {
    vi.mocked(ipc.saveSettings).mockReset();
    useSettingsStore.setState({
      settings: settings(4),
      isSaving: false,
      error: null,
    });
  });

  it("does not let an older response restore stale settings", async () => {
    const older = deferred<void>();
    const newer = deferred<void>();
    vi.mocked(ipc.saveSettings)
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise);

    const olderSave = useSettingsStore.getState().saveSettings(settings(5));
    const newerSave = useSettingsStore.getState().saveSettings(settings(6));

    await Promise.resolve();
    expect(ipc.saveSettings).toHaveBeenCalledTimes(1);
    expect(ipc.saveSettings).toHaveBeenNthCalledWith(1, settings(5));

    older.resolve();
    await olderSave;
    await Promise.resolve();
    expect(ipc.saveSettings).toHaveBeenCalledTimes(2);
    expect(ipc.saveSettings).toHaveBeenNthCalledWith(2, settings(6));

    newer.resolve();
    await newerSave;

    expect(useSettingsStore.getState()).toMatchObject({
      settings: { sync_concurrency: 6 },
      isSaving: false,
      error: null,
    });
  });
});
