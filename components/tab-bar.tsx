"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Block arrives with the eight-week view; a tab that leads to an empty screen
 * teaches the user not to press tabs.
 */
const TABS = [
  { href: "/", label: "Today" },
  { href: "/week", label: "Week" },
  { href: "/settings", label: "Settings" },
] as const;

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Sections"
      className="sticky bottom-0 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-md">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-tap items-center justify-center text-caption uppercase tracking-wide",
                  active ? "text-text font-medium" : "text-text-muted",
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
