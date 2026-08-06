"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";

/**
 * Dark is the app's theme; light is the option. The OS preference is deliberately
 * not offered: a phone set to light mode should still open BTTR Fit in the dark.
 */
const OPTIONS = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
] as const;

const noopSubscribe = () => () => {};

/** The stored theme is only known in the browser, so nothing is selected on the server render. */
function useHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const hydrated = useHydrated();

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="inline-flex rounded-md border border-line bg-surface p-1"
    >
      {OPTIONS.map((option) => {
        const selected = hydrated && theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setTheme(option.value)}
            className={`min-h-tap px-4 text-body rounded-sm ${
              selected
                ? "bg-accent text-accent-contrast"
                : "text-text-muted hover:bg-surface-raised hover:text-text"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
