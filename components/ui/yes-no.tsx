"use client";

import { cn } from "@/lib/utils";

/**
 * A pair of buttons rather than a checkbox, because unanswered has to be visibly
 * its own state: an unticked box says No, and the app must never claim a user
 * failed at something they simply have not answered yet.
 */
export function YesNo({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (value: boolean | null) => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-md border px-3 py-1.5",
        value === null ? "border-dashed border-attention" : "border-line",
      )}
      role="group"
      aria-label={label}
    >
      <span className="text-body">{label}</span>
      <div className="flex gap-1.5">
        <Choice
          selected={value === true}
          tone="hit"
          label={`Yes, ${label.toLowerCase()}`}
          // Tapping the selected answer clears it: a mistyped Yes must be
          // correctable back to unanswered, not only to No.
          onClick={() => onChange(value === true ? null : true)}
        >
          Yes
        </Choice>
        <Choice
          selected={value === false}
          tone="miss"
          label={`No, ${label.toLowerCase()}`}
          onClick={() => onChange(value === false ? null : false)}
        >
          No
        </Choice>
      </div>
    </div>
  );
}

function Choice({
  selected,
  tone,
  label,
  onClick,
  children,
}: {
  selected: boolean;
  tone: "hit" | "miss";
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "min-h-tap w-16 rounded-md border text-body font-medium",
        selected
          ? tone === "hit"
            ? "border-hit bg-hit text-white"
            : "border-miss bg-miss text-white"
          : "border-line bg-surface text-text-muted",
      )}
    >
      {children}
    </button>
  );
}
