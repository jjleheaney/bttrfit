import type { Metadata } from "next";

export const metadata: Metadata = { title: "Offline — BTTR Fit" };

/**
 * What the service worker shows in place of a navigation it cannot make. It has
 * to be static and self-contained: it is served from the cache with no network
 * and no session, so it can render no user data.
 */
export default function OfflinePage() {
  return (
    <main className="flex flex-1 flex-col justify-center gap-4 px-5 py-10">
      <h1 className="font-display text-display uppercase tracking-tight">Offline</h1>
      <p className="text-body text-text-muted">
        Your check-in needs a connection to save. Nothing has been lost — reconnect and open the
        app again.
      </p>
    </main>
  );
}
