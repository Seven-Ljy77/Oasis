import { beforeEach, describe, expect, it, vi } from "vitest";

import * as ipc from "@/lib/ipc";
import type { EntryListItem } from "@/lib/types";
import { useEntryStore } from "./useEntryStore";

vi.mock("@/lib/ipc", () => ({
  markRead: vi.fn(),
  markStarred: vi.fn(),
}));

vi.mock("./useSidebarStore", () => ({
  useSidebarStore: {
    getState: () => ({ loadCounts: vi.fn() }),
  },
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

function entry(): EntryListItem {
  return {
    id: 1,
    feed_id: 1,
    title: "Entry",
    author: null,
    url: "https://example.com/entry",
    published_at: null,
    summary: null,
    is_read: false,
    is_starred: false,
    feed_title: "Feed",
    created_at: "2026-01-01 00:00:00",
  };
}

describe("useEntryStore optimistic updates", () => {
  beforeEach(() => {
    vi.mocked(ipc.markRead).mockReset();
    vi.mocked(ipc.markStarred).mockReset();
    useEntryStore.setState({
      entries: [entry()],
      error: null,
    });
  });

  it("does not let an older read failure undo a newer success", async () => {
    const older = deferred<void>();
    const newer = deferred<void>();
    vi.mocked(ipc.markRead)
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise);

    const olderRun = useEntryStore.getState().markRead([1], true);
    const newerRun = useEntryStore.getState().markRead([1], true);

    older.reject(new Error("stale failure"));
    await olderRun;
    newer.resolve();
    await newerRun;

    expect(useEntryStore.getState().entries[0].is_read).toBe(true);
    expect(useEntryStore.getState().error).toBeNull();
  });

  it("does not let an older star failure undo a newer success", async () => {
    const older = deferred<void>();
    const newer = deferred<void>();
    vi.mocked(ipc.markStarred)
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise);

    const olderRun = useEntryStore.getState().markStarred(1, true);
    const newerRun = useEntryStore.getState().markStarred(1, true);

    older.reject(new Error("stale failure"));
    await olderRun;
    newer.resolve();
    await newerRun;

    expect(useEntryStore.getState().entries[0].is_starred).toBe(true);
    expect(useEntryStore.getState().error).toBeNull();
  });

  it("returns to the confirmed value when opposite star operations fail", async () => {
    vi.mocked(ipc.markStarred).mockRejectedValue(new Error("failed"));

    const star = useEntryStore.getState().markStarred(1, true);
    const unstar = useEntryStore.getState().markStarred(1, false);
    await Promise.all([star, unstar]);

    expect(useEntryStore.getState().entries[0].is_starred).toBe(false);
  });

  it("returns to the confirmed value when opposite read operations fail", async () => {
    vi.mocked(ipc.markRead).mockRejectedValue(new Error("failed"));

    const markRead = useEntryStore.getState().markRead([1], true);
    const markUnread = useEntryStore.getState().markRead([1], false);
    await Promise.all([markRead, markUnread]);

    expect(useEntryStore.getState().entries[0].is_read).toBe(false);
  });
});
