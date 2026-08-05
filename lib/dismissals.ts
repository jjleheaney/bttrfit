"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * "Later" that survives a reload, kept in localStorage rather than the database:
 * dismissing a prompt is not data about the user's training, and a row for it
 * would have to be cleaned up for the rest of time.
 *
 * Read through `useSyncExternalStore` so the server render and the first client
 * render agree (nothing is dismissed until the browser says otherwise).
 */
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function dismiss(key: string): void {
  window.localStorage.setItem(key, "1");
  for (const listener of listeners) listener();
}

export function useDismissed(key: string): [boolean, () => void] {
  const isDismissed = useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(key) === "1",
    () => false,
  );
  return [isDismissed, useCallback(() => dismiss(key), [key])];
}
