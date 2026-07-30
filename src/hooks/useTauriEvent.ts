// =============================================================================
// Mercury — Tauri event listener hook
//
// Subscribes to a Tauri event, calls a callback on each payload, and
// automatically cleans up on unmount. Falls back to a custom EventTarget
// when outside Tauri (dev in browser).
// =============================================================================

import { useEffect, useRef } from "react";

/**
 * Listen for a Tauri event.
 *
 * In a Tauri context this uses `@tauri-apps/api/event`. When running in a
 * plain browser (vite dev without Tauri) we use a shared custom EventTarget
 * so the app can still function during UI-only development.
 *
 * @param eventName  The Tauri event name (e.g. "sync-progress")
 * @param callback   Called with the event payload
 */
export function useTauriEvent<T = unknown>(
  eventName: string,
  callback: (payload: T) => void,
): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let disposed = false;

    const setup = async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        const dispose = await listen<T>(eventName, (event) => {
          callbackRef.current(event.payload);
        });
        if (disposed) {
          dispose();
        } else {
          unlisten = dispose;
        }
      } catch {
        if (disposed) {
          return;
        }
        const handler = (event: Event) => {
          callbackRef.current((event as CustomEvent<T>).detail);
        };
        window.addEventListener(`oasis:${eventName}`, handler);
        unlisten = () =>
          window.removeEventListener(`oasis:${eventName}`, handler);
      }
    };

    void setup();

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [eventName]);
}
