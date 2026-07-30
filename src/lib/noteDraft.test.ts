import { describe, expect, it, vi } from "vitest";

import {
  flushPendingNoteDraft,
  LatestValueSaveQueue,
  registerNoteDraftFlusher,
} from "./noteDraft";

describe("note draft flushing", () => {
  it("waits for the active note save", async () => {
    let resolveSave!: () => void;
    const save = new Promise<void>((resolve) => {
      resolveSave = resolve;
    });
    const flusher = vi.fn(() => save);
    const unregister = registerNoteDraftFlusher(1, flusher);
    let completed = false;

    const flush = flushPendingNoteDraft().then(() => {
      completed = true;
    });
    await Promise.resolve();
    expect(completed).toBe(false);

    resolveSave();
    await flush;
    expect(flusher).toHaveBeenCalledOnce();
    unregister();
  });

  it("does not let an older cleanup unregister a newer panel", async () => {
    const first = vi.fn(async () => undefined);
    const second = vi.fn(async () => undefined);
    const unregisterFirst = registerNoteDraftFlusher(2, first);
    const unregisterSecond = registerNoteDraftFlusher(3, second);

    unregisterFirst();
    await flushPendingNoteDraft();

    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
    unregisterSecond();
  });

  it("queues a return to the persisted value behind an in-flight change", async () => {
    let resolveNew!: () => void;
    let resolveOld!: () => void;
    const newSave = new Promise<void>((resolve) => {
      resolveNew = resolve;
    });
    const oldSave = new Promise<void>((resolve) => {
      resolveOld = resolve;
    });
    const writer = vi.fn((value: string) =>
      value === "new" ? newSave : oldSave,
    );
    const queue = new LatestValueSaveQueue("old");

    const first = queue.save("new", writer);
    const second = queue.save("old", writer);
    const duplicateFlush = queue.save("old", writer);
    let finalFlushCompleted = false;
    void duplicateFlush.promise.then(() => {
      finalFlushCompleted = true;
    });

    await Promise.resolve();
    expect(writer).toHaveBeenCalledTimes(2);
    expect(writer).toHaveBeenNthCalledWith(1, "new");
    expect(writer).toHaveBeenNthCalledWith(2, "old");

    resolveNew();
    await first.promise;
    expect(finalFlushCompleted).toBe(false);

    resolveOld();
    await second.promise;
    await duplicateFlush.promise;
    expect(finalFlushCompleted).toBe(true);
    expect(writer).toHaveBeenCalledTimes(2);
  });

  it("keeps an unmounted save failure visible to later digest flushes", async () => {
    const failure = new Error("note save failed");
    const unregisterFailed = registerNoteDraftFlusher(4, async () => {
      throw failure;
    });
    unregisterFailed();

    await expect(flushPendingNoteDraft([4])).rejects.toThrow(
      "note save failed",
    );

    const unregisterRecovered = registerNoteDraftFlusher(4, async () => {});
    await flushPendingNoteDraft([4]);
    unregisterRecovered();
    await flushPendingNoteDraft([4]);
  });
});
