import Link from "next/link";

/**
 * Next's built-in not-found page ships its own stylesheet whose dark variant is
 * keyed on the OS preference, so without this the app's forced dark theme is
 * broken by any mistyped URL on a light-set device.
 */
export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col justify-center gap-4 px-5 py-10">
      <h1 className="font-display text-display uppercase tracking-tight">Not found</h1>
      <p className="text-body text-text-muted">
        That page does not exist. Everything lives behind the four tabs.
      </p>
      <Link
        href="/"
        className="inline-flex min-h-tap w-full items-center justify-center rounded-md bg-accent px-5 text-body font-medium text-accent-contrast hover:opacity-90"
      >
        Go to today
      </Link>
    </main>
  );
}
