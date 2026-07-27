// =============================================================================
// Mercury — Tauri event listener hook
//
// Subscribes to a Tauri event, calls a callback on each payload, and
// automatically cleans up on unmount. Falls back to a custom EventTarget
// when outside Tauri (dev in browser).
// =============================================================================

import { useEffect, useRef } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EventPayload = any;

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
export function useTauriEvent(
  eventName: string,
  callback: (payload: EventPayload) => void,
): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setup = async () => {
      // TODO: dynamically import @tauri-apps/api/event and subscribe
      // For now, use a DOM-like fallback so the hook compiles and runs in
      // a browser dev setup.
      //
      // try {
      //   const { listen } = await import('@tauri-apps/api/event');
      //   const unlistenFn = await listen(eventName, (event) => {
      //     callbackRef.current(event.payload);
      //   });
      //   unlisten = unlistenFn;
      // } catch {
      //   // Not in Tauri — set up a custom event listener for dev
      // }

      const handler = (e: Event) => {
        const customEvent = e as CustomEvent;
        callbackRef.current(customEvent.detail);
      };

      window.addEventListener(`oasis:${eventName}`, handler);
      unlisten = () =>
        window.removeEventListener(`oasis:${eventName}`, handler);
    };

    setup();

    return () => {
      unlisten?.();
    };
  }, [eventName]);
}
