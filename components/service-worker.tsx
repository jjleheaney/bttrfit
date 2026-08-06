"use client";

import { useEffect } from "react";

/**
 * Registers the offline shell. Production only: in development the worker would
 * serve stale build assets from a previous `next dev` run, which looks like a
 * bug in whatever you were editing.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      // Skipping registration is not enough: a worker installed by an earlier
      // `npm start` on this origin stays active and keeps answering `next dev`
      // with that build's assets.
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => registrations.map((registration) => registration.unregister()));
      return;
    }

    void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  }, []);

  return null;
}
