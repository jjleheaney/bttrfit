"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { parseWeight, type UnitPreference } from "@/lib/domain";

/**
 * Prefilled with the last weight recorded, so the normal morning is one tap on
 * the tick or the steppers rather than typing a number from scratch. The prefill
 * is styled as unanswered until it is actually recorded: showing yesterday's
 * figure as though it were today's would be a lie the whole app rests on.
 */
export function WeightField({
  value,
  prefill,
  unit,
  onCommit,
}: {
  value: number | null;
  prefill: number | null;
  unit: UnitPreference;
  onCommit: (weight: number) => void;
}) {
  const shown = value ?? prefill;
  const [draft, setDraft] = useState<string>(shown === null ? "" : shown.toFixed(1));
  const [error, setError] = useState<string | null>(null);

  function commit(raw: string) {
    if (raw.trim() === "") {
      setError(null);
      return;
    }
    const parsed = parseWeight(raw, unit);
    if ("error" in parsed) {
      setError(parsed.error);
      return;
    }
    setError(null);
    setDraft(parsed.value.toFixed(1));
    onCommit(parsed.value);
  }

  function step(by: number) {
    const base = Number(draft) || shown || 0;
    const next = Math.round((base + by) * 10) / 10;
    setDraft(next.toFixed(1));
    setError(null);
    onCommit(next);
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 rounded-md border px-3 py-2",
        value === null ? "border-dashed border-attention" : "border-line",
      )}
    >
      <div className="flex items-baseline gap-1">
        <label htmlFor="weight" className="sr-only">
          Weight in {unit}
        </label>
        <input
          id="weight"
          name="weight"
          inputMode="decimal"
          autoComplete="off"
          value={draft}
          placeholder="—"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit(draft);
              event.currentTarget.blur();
            }
          }}
          className={cn(
            "tabular w-24 bg-transparent text-hero leading-none outline-none",
            value === null && "text-text-muted",
          )}
        />
        <span className="text-caption text-text-muted">{unit}</span>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label="Down 0.1"
          onClick={() => step(-0.1)}
          className="min-h-tap w-12 rounded-md border border-line bg-surface text-lead"
        >
          −
        </button>
        <button
          type="button"
          aria-label="Up 0.1"
          onClick={() => step(0.1)}
          className="min-h-tap w-12 rounded-md border border-line bg-surface text-lead"
        >
          +
        </button>
        {value === null && draft !== "" && (
          <button
            type="button"
            aria-label={`Record ${draft}${unit}`}
            onClick={() => commit(draft)}
            className="min-h-tap w-12 rounded-md border border-accent bg-accent text-lead text-accent-contrast"
          >
            ✓
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="basis-full text-caption text-miss">
          {error}
        </p>
      )}
    </div>
  );
}
