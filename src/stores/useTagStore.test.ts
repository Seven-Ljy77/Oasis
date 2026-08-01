import { beforeEach, describe, expect, it, vi } from "vitest";

import * as ipc from "@/lib/ipc";
import type { TagInfo } from "@/lib/types";
import { useTagStore } from "./useTagStore";

vi.mock("@/lib/ipc", () => ({
  assignTag: vi.fn(),
  removeTag: vi.fn(),
  renameTag: vi.fn(),
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

function tag(id: number, name: string): TagInfo {
  return {
    id,
    name,
    normalized_name: name.toLowerCase(),
    is_provisional: false,
    usage_count: 0,
  };
}

describe("useTagStore optimistic updates", () => {
  beforeEach(() => {
    vi.mocked(ipc.assignTag).mockReset();
    vi.mocked(ipc.removeTag).mockReset();
    vi.mocked(ipc.renameTag).mockReset();
    useTagStore.setState({
      tags: [tag(1, "One"), tag(2, "Two")],
      tagUsageMap: {},
      error: null,
    });
  });

  it("rolls back only the failed tag when another assignment succeeds", async () => {
    const first = deferred<void>();
    const second = deferred<void>();
    vi.mocked(ipc.assignTag).mockImplementation((_entryId, tagId) =>
      tagId === 1 ? first.promise : second.promise,
    );

    const failedAssignment = useTagStore.getState().assignTag(10, 1);
    const successfulAssignment = useTagStore.getState().assignTag(10, 2);

    second.resolve();
    await successfulAssignment;
    first.reject(new Error("failed"));
    await failedAssignment;

    expect(
      useTagStore.getState().tagUsageMap[10].map((item) => item.id),
    ).toEqual([2]);
  });

  it("removes an optimistic tag when repeated assignments both fail", async () => {
    vi.mocked(ipc.assignTag).mockRejectedValue(new Error("failed"));

    const first = useTagStore.getState().assignTag(10, 1);
    const second = useTagStore.getState().assignTag(10, 1);
    await Promise.all([first, second]);

    expect(useTagStore.getState().tagUsageMap[10]).toEqual([]);
  });

  it("returns to the confirmed state when opposite operations both fail", async () => {
    vi.mocked(ipc.assignTag).mockRejectedValue(new Error("failed"));
    vi.mocked(ipc.removeTag).mockRejectedValue(new Error("failed"));

    const assign = useTagStore.getState().assignTag(10, 1);
    const remove = useTagStore.getState().removeTag(10, 1);
    await Promise.all([assign, remove]);

    expect(useTagStore.getState().tagUsageMap[10]).toEqual([]);
  });

  it("returns to the confirmed name when consecutive renames fail", async () => {
    vi.mocked(ipc.renameTag).mockRejectedValue(new Error("failed"));

    const first = useTagStore.getState().renameTag(1, "First");
    const second = useTagStore.getState().renameTag(1, "Second");
    await Promise.all([first, second]);

    expect(useTagStore.getState().tags[0].name).toBe("One");
  });

  it("keeps the last confirmed name when a later rename fails", async () => {
    vi.mocked(ipc.renameTag)
      .mockResolvedValueOnce(tag(1, "First"))
      .mockRejectedValueOnce(new Error("failed"));

    const first = useTagStore.getState().renameTag(1, "First");
    const second = useTagStore.getState().renameTag(1, "Second");
    await Promise.all([first, second]);

    expect(useTagStore.getState().tags[0].name).toBe("First");
  });
});
