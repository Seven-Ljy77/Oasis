type NoteDraftFlusher = () => Promise<void>;

interface RegisteredFlusher {
  entryId: number;
  flusher: NoteDraftFlusher;
}

interface PendingFlush {
  entryId: number;
  promise: Promise<void>;
}

let activeFlusher: RegisteredFlusher | null = null;
let noteSaveTail: Promise<void> = Promise.resolve();
const pendingFlushes = new Set<PendingFlush>();
const failedFlushes = new Map<number, unknown>();

export class LatestValueSaveQueue<T> {
  private persistedValue: T;
  private desiredValue: T;
  private latestPromise: Promise<void> | null = null;
  private version = 0;

  constructor(initialValue: T) {
    this.persistedValue = initialValue;
    this.desiredValue = initialValue;
  }

  reset(value: T): void {
    this.version += 1;
    this.persistedValue = value;
    this.desiredValue = value;
    this.latestPromise = null;
  }

  save(
    value: T,
    writer: (value: T) => Promise<void>,
  ): { promise: Promise<void>; enqueued: boolean } {
    if (Object.is(value, this.desiredValue)) {
      return {
        promise: this.latestPromise ?? Promise.resolve(),
        enqueued: false,
      };
    }

    const version = ++this.version;
    this.desiredValue = value;
    const operation = Promise.resolve().then(() => writer(value));
    const tracked = operation
      .then(() => {
        this.persistedValue = value;
      })
      .catch((error) => {
        if (version === this.version) {
          this.desiredValue = this.persistedValue;
        }
        throw error;
      })
      .finally(() => {
        if (version === this.version) {
          this.latestPromise = null;
        }
      });
    this.latestPromise = tracked;
    return { promise: tracked, enqueued: true };
  }
}

export function enqueueNoteSave(
  entryId: number,
  operation: () => Promise<void>,
): Promise<void> {
  const save = noteSaveTail
    .catch(() => undefined)
    .then(operation);
  const tracked = save
    .then(() => {
      failedFlushes.delete(entryId);
    })
    .catch((error) => {
      failedFlushes.set(entryId, error);
      throw error;
    });
  noteSaveTail = tracked.catch(() => undefined);
  return tracked;
}

function trackPendingFlush(
  entryId: number,
  flusher: NoteDraftFlusher,
): Promise<void> {
  const pending = {} as PendingFlush;
  const promise = Promise.resolve()
    .then(flusher)
    .then(() => {
      failedFlushes.delete(entryId);
    })
    .catch((error) => {
      failedFlushes.set(entryId, error);
      throw error;
    })
    .finally(() => pendingFlushes.delete(pending));
  pending.entryId = entryId;
  pending.promise = promise;
  pendingFlushes.add(pending);
  return promise;
}

export function registerNoteDraftFlusher(
  entryId: number,
  flusher: NoteDraftFlusher,
): () => void {
  const registration = { entryId, flusher };
  activeFlusher = registration;
  return () => {
    if (activeFlusher === registration) activeFlusher = null;
    void trackPendingFlush(entryId, flusher).catch(() => undefined);
  };
}

export async function flushPendingNoteDraft(
  entryIds?: readonly number[],
): Promise<void> {
  const included = entryIds ? new Set(entryIds) : null;
  const shouldInclude = (entryId: number) =>
    included === null || included.has(entryId);

  const operations = [...pendingFlushes]
    .filter((pending) => shouldInclude(pending.entryId))
    .map((pending) => pending.promise);
  if (activeFlusher && shouldInclude(activeFlusher.entryId)) {
    operations.push(
      trackPendingFlush(activeFlusher.entryId, activeFlusher.flusher),
    );
  }

  await Promise.allSettled(operations);
  for (const [entryId, error] of failedFlushes) {
    if (shouldInclude(entryId)) {
      throw error instanceof Error ? error : new Error(String(error));
    }
  }
}
