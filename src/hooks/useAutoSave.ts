// =============================================================================
// Mercury — Debounced auto-save hook
//
// Watches a value and invokes `saveFn(value)` after `delay` ms of inactivity.
// Cleans up the timer on unmount.
// =============================================================================

import { useEffect, useRef } from "react";

/**
 * Auto-save a value with debounce.
 *
 * @param value   The value to monitor
 * @param delay   Debounce delay in milliseconds
 * @param saveFn  Called with the value after the delay
 *
 * @example
 * useAutoSave(settings, 800, async (s) => {
 *   await ipc.saveSettings(s);
 * });
 */
export function useAutoSave<T>(
  value: T,
  delay: number,
  saveFn: (value: T) => void | Promise<void>,
): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveFnRef = useRef(saveFn);
  saveFnRef.current = saveFn;

  // Track the initial value so we don't save on first mount
  const initialRef = useRef(true);

  useEffect(() => {
    if (initialRef.current) {
      initialRef.current = false;
      return;
    }

    // Clear any pending save
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      saveFnRef.current(value);
    }, delay);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, delay]);
}
