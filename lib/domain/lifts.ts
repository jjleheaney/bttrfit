import type { LiftEntry, SentinelLift } from "./types";

/**
 * The fixed sentinel lift menu. Deliberately short: the point is a stable
 * strength reference across a block, not programme design.
 */
export const SENTINEL_LIFT_MENU = [
  { key: "bench_press", displayName: "Bench press" },
  { key: "overhead_press", displayName: "Overhead press" },
  { key: "row", displayName: "Barbell or chest-supported row" },
  { key: "back_squat", displayName: "Back squat" },
  { key: "deadlift", displayName: "Deadlift" },
  { key: "pull_up", displayName: "Weighted pull-up or lat pulldown" },
  { key: "dip", displayName: "Dip" },
  { key: "hip_hinge", displayName: "Hip thrust or Romanian deadlift" },
] as const;

export type SentinelLiftKey = (typeof SENTINEL_LIFT_MENU)[number]["key"];

export function liftDisplayName(key: string): string {
  return SENTINEL_LIFT_MENU.find((lift) => lift.key === key)?.displayName ?? key;
}

export const SENTINEL_LIFT_SLOTS = 3;
/** Either side of this counts as a real change rather than day-to-day variance. */
export const LIFT_STATUS_THRESHOLD = 0.01;

export type LiftStatus = "improved" | "maintained" | "declined";

/**
 * Epley estimated one-rep max. Users change rep ranges between weeks, so
 * "6 x 80kg" and "8 x 75kg" are only comparable once normalised. The estimate is
 * never the headline figure: it exists to decide a status.
 */
export function epley1RM(reps: number, weight: number): number {
  return weight * (1 + reps / 30);
}

export function liftE1RM(entry: LiftEntry): number {
  return epley1RM(entry.reps, entry.weight);
}

export function liftStatus(current: LiftEntry, previous: LiftEntry): LiftStatus {
  const change = liftE1RM(current) / liftE1RM(previous) - 1;
  // A change of exactly 1% is "within +/- 1%", so the tolerance keeps binary
  // floating point from reading 101/100 as 1.0000000000000009%.
  if (change > LIFT_STATUS_THRESHOLD + Number.EPSILON) return "improved";
  if (change < -LIFT_STATUS_THRESHOLD - Number.EPSILON) return "declined";
  return "maintained";
}

export type LiftWeekComparison = {
  weekNumber: number;
  current: LiftEntry;
  e1rm: number;
  /** The most recent *logged* week before this one, which need not be n-1: users
   * skip weeks, and comparing against a gap is still a valid comparison. */
  previous: LiftEntry | null;
  previousE1rm: number | null;
  /** Fractional change in e1RM, e.g. 0.023 for +2.3%. */
  change: number | null;
  /** `null` when there is nothing earlier to compare against. */
  status: LiftStatus | null;
};

export function liftEntryForWeek(lift: SentinelLift, weekNumber: number): LiftEntry | null {
  return lift.entries.find((entry) => entry.weekNumber === weekNumber) ?? null;
}

function previousLoggedEntry(lift: SentinelLift, weekNumber: number): LiftEntry | null {
  return (
    lift.entries
      .filter((entry) => entry.weekNumber < weekNumber)
      .sort((a, b) => a.weekNumber - b.weekNumber)
      .at(-1) ?? null
  );
}

export function compareLiftWeek(
  lift: SentinelLift,
  weekNumber: number,
): LiftWeekComparison | null {
  const current = liftEntryForWeek(lift, weekNumber);
  if (!current) return null;

  const previous = previousLoggedEntry(lift, weekNumber);
  const e1rm = liftE1RM(current);

  if (!previous) {
    return {
      weekNumber,
      current,
      e1rm,
      previous: null,
      previousE1rm: null,
      change: null,
      status: null,
    };
  }

  const previousE1rm = liftE1RM(previous);
  return {
    weekNumber,
    current,
    e1rm,
    previous,
    previousE1rm,
    change: e1rm / previousE1rm - 1,
    status: liftStatus(current, previous),
  };
}

export function compareLiftsForWeek(
  lifts: SentinelLift[],
  weekNumber: number,
): LiftWeekComparison[] {
  return lifts
    .slice()
    .sort((a, b) => a.slot - b.slot)
    .map((lift) => compareLiftWeek(lift, weekNumber))
    .filter((comparison): comparison is LiftWeekComparison => comparison !== null);
}

/** The top set as the user entered it: the primary figure on screen. */
export function formatTopSet(entry: LiftEntry, unit: "kg" | "lbs" = "kg"): string {
  return `${entry.reps} x ${entry.weight}${unit}`;
}
