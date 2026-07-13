// =============================================================================
// Mercury — Generic Tauri command hook
//
// Wraps `invoke()` or any async function with { data, error, loading, execute }.
// =============================================================================

import { useCallback, useRef, useState } from "react";

export interface UseTauriCommandState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

export interface UseTauriCommandReturn<T, Args extends unknown[] = []> {
  data: T | null;
  error: string | null;
  loading: boolean;
  execute: (...args: Args) => Promise<T | null>;
  reset: () => void;
}

/**
 * Generic hook for executing async commands (Tauri invoke or otherwise).
 *
 * @param fn  The async function to wrap
 * @returns   { data, error, loading, execute, reset }
 *
 * @example
 * const { data, loading, execute } = useTauriCommand(syncFeeds);
 * await execute(4);
 */
export function useTauriCommand<T, Args extends unknown[] = []>(
  fn: (...args: Args) => Promise<T>,
): UseTauriCommandReturn<T, Args> {
  const [state, setState] = useState<UseTauriCommandState<T>>({
    data: null,
    error: null,
    loading: false,
  });

  const abortRef = useRef<AbortController | null>(null);

  const execute = useCallback(
    async (...args: Args): Promise<T | null> => {
      // Cancel any in-flight request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setState({ data: null, error: null, loading: true });

      try {
        const result = await fn(...args);
        if (!controller.signal.aborted) {
          setState({ data: result, error: null, loading: false });
        }
        return result;
      } catch (err) {
        if (!controller.signal.aborted) {
          const message = err instanceof Error ? err.message : String(err);
          setState({ data: null, error: message, loading: false });
        }
        return null;
      }
    },
    [fn],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState({ data: null, error: null, loading: false });
  }, []);

  return { ...state, execute, reset };
}
