"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  compareLiftWeek,
  formatTopSet,
  liftEntryForWeek,
  parseDecimal,
  parseInteger,
  type LiftWeekComparison,
  type SentinelLift,
  type UnitPreference,
} from "@/lib/domain";
import { Button } from "@/components/ui/button";
import { logLifts } from "../actions";

type Draft = { reps: string; weight: string };
type SavedLift = { name: string; comparison: LiftWeekComparison };

/** Bar weights, not bodyweights: a 20kg press and a 300kg deadlift are both real. */
const BAR_WEIGHT = { min: 1, max: 1000, label: "Weight" };

/**
 * Three lifts, reps and weight each. On save the status against the previous
 * logged week appears immediately: that reinforcement is the whole reason the
 * screen exists, so it is computed locally rather than waiting on a round trip.
 */
export function LiftLog({
  lifts,
  weekNumber,
  unit,
}: {
  lifts: (SentinelLift & { id: string })[];
  weekNumber: number;
  unit: UnitPreference;
}) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(
      lifts.map((lift) => {
        const existing = liftEntryForWeek(lift, weekNumber);
        // Last week's top set is the starting point: most people repeat it or add
        // a little, and nobody wants to retype it.
        const previous = lift.entries.filter((entry) => entry.weekNumber < weekNumber).at(-1);
        const source = existing ?? previous;
        return [
          lift.id,
          {
            reps: existing ? String(existing.reps) : (source ? String(source.reps) : ""),
            weight: existing ? String(existing.weight) : (source ? String(source.weight) : ""),
          },
        ];
      }),
    ),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<SavedLift[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function update(id: string, patch: Partial<Draft>) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  }

  function submit() {
    const fieldErrors: Record<string, string> = {};
    const payload: { sentinelLiftId: string; reps: number; weight: number }[] = [];

    for (const lift of lifts) {
      const draft = drafts[lift.id];
      if (!draft.reps.trim() && !draft.weight.trim()) continue; // Skipped on purpose.

      const reps = parseInteger(draft.reps, { min: 1, max: 30, label: "Reps" });
      const weight = parseDecimal(draft.weight, BAR_WEIGHT);
      if ("error" in reps) {
        fieldErrors[lift.id] = reps.error;
        continue;
      }
      if ("error" in weight) {
        fieldErrors[lift.id] = "Enter the weight on the bar.";
        continue;
      }
      payload.push({ sentinelLiftId: lift.id, reps: reps.value, weight: weight.value });
    }

    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;
    if (payload.length === 0) {
      setFormError("Enter at least one lift.");
      return;
    }
    setFormError(null);

    startTransition(async () => {
      const result = await logLifts(weekNumber, payload);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      // Compare against the same entries the server now holds, with this week's
      // top sets folded in.
      setSaved(
        lifts
          .map((lift) => {
            const entered = payload.find((entry) => entry.sentinelLiftId === lift.id);
            if (!entered) return null;
            const comparison = compareLiftWeek(
              {
                ...lift,
                entries: [
                  ...lift.entries.filter((entry) => entry.weekNumber !== weekNumber),
                  { weekNumber, reps: entered.reps, weight: entered.weight },
                ].sort((a, b) => a.weekNumber - b.weekNumber),
              },
              weekNumber,
            );
            return comparison ? { name: lift.displayName, comparison } : null;
          })
          .filter((entry): entry is SavedLift => entry !== null),
      );
    });
  }

  if (saved) {
    return (
      <div className="flex flex-1 flex-col gap-3">
        <ul className="flex flex-col gap-2">
          {saved.map(({ name, comparison }) => (
            <li
              key={name}
              className="resolve-in rounded-md border border-line bg-surface px-3 py-2"
            >
              <p className="text-body">{name}</p>
              <p className="tabular text-lead">{formatTopSet(comparison.current, unit)}</p>
              <p className="tabular text-caption text-text-muted">
                {comparison.status === null ? (
                  "No earlier week to compare against yet."
                ) : (
                  <>
                    <StatusWord status={comparison.status} />{" "}
                    {comparison.change !== null &&
                      `${comparison.change >= 0 ? "+" : "−"}${Math.abs(comparison.change * 100).toFixed(1)}% e1RM`}
                    {comparison.previous && ` · was ${formatTopSet(comparison.previous, unit)}`}
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
        <p className="text-caption text-text-muted">
          e1RM is an estimate, used only to compare sets across different rep ranges.
        </p>
        <Link href="/" className="mt-auto">
          <Button full>Back to today</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-3">
      <ul className="flex flex-col gap-3">
        {lifts.map((lift) => {
          const previous = lift.entries.filter((entry) => entry.weekNumber < weekNumber).at(-1);
          return (
            <li key={lift.id} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-body">{lift.displayName}</span>
                {previous && (
                  <span className="tabular text-caption text-text-muted">
                    week {previous.weekNumber}: {formatTopSet(previous, unit)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <label className="sr-only" htmlFor={`reps-${lift.id}`}>
                  {lift.displayName} reps
                </label>
                <input
                  id={`reps-${lift.id}`}
                  inputMode="numeric"
                  value={drafts[lift.id].reps}
                  onChange={(event) => update(lift.id, { reps: event.target.value })}
                  className="tabular min-h-tap w-20 rounded-md border border-line bg-field px-3 text-body text-text"
                />
                <span className="text-caption text-text-muted">reps at</span>
                <label className="sr-only" htmlFor={`weight-${lift.id}`}>
                  {lift.displayName} weight
                </label>
                <input
                  id={`weight-${lift.id}`}
                  inputMode="decimal"
                  value={drafts[lift.id].weight}
                  onChange={(event) => update(lift.id, { weight: event.target.value })}
                  className="tabular min-h-tap w-24 rounded-md border border-line bg-field px-3 text-body text-text"
                />
                <span className="text-caption text-text-muted">{unit}</span>
              </div>
              {errors[lift.id] && (
                <p role="alert" className="text-caption text-miss">
                  {errors[lift.id]}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-auto flex flex-col gap-2">
        {formError && (
          <p role="alert" className="text-caption text-miss">
            {formError}
          </p>
        )}
        <Button type="button" full onClick={submit} disabled={pending}>
          {pending ? "Saving…" : `Save week ${weekNumber} lifts`}
        </Button>
        <Link href="/" className="min-h-tap text-center text-caption text-text-muted underline">
          Not now
        </Link>
      </div>
    </div>
  );
}

function StatusWord({ status }: { status: "improved" | "maintained" | "declined" }) {
  const copy = { improved: "Improved", maintained: "Held", declined: "Declined" }[status];
  const tone = {
    improved: "text-hit",
    maintained: "text-text",
    declined: "text-miss",
  }[status];
  return <span className={`font-medium ${tone}`}>{copy}</span>;
}
