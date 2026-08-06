"use client";

import { useEffect } from "react";

/**
 * Registers the offline shell. Production only: in development the worker would
 * serve stale build assets from a previous `next dev` run, which looks like a
 * bug in whatever you were editing.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  }, []);

  return null;
}
