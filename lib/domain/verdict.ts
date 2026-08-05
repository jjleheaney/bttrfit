import type { LiftStatus } from "./lifts";

/** Below this, a week-average change is not a direction. */
export const WEIGHT_DELTA_THRESHOLD = 0.2;
/** Two of three lifts agreeing is what makes a verdict a verdict. */
export const LIFT_AGREEMENT = 2;

export type VerdictKey =
  | "recomping"
  | "losing_more_than_fat"
  | "recomping_slowly"
  | "holding"
  | "gaining"
  | "off_track"
  | "baseline"
  | "unavailable"
  | "mixed";

export type Verdict = {
  key: VerdictKey;
  label: string;
  message: string;
  /** True for the six verdicts that read the data as a direction. `false` for
   * baseline, unavailable and mixed, which deliberately refuse to. */
  conclusive: boolean;
};

export type VerdictInput = {
  /** Week average against the previous week's, in the user's unit. `null` when
   * either week has no weigh-ins. */
  weeklyDelta: number | null;
  /** One status per lift compared this week. Lifts with nothing to compare
   * against contribute `null` and are ignored. */
  liftStatuses: (LiftStatus | null)[];
};

function verdict(
  key: VerdictKey,
  label: string,
  message: string,
  conclusive = true,
): Verdict {
  return { key, label, message, conclusive };
}

/**
 * The signature output of the product: weekly weight direction crossed with what
 * the bar did. It refuses to answer more often than most apps would, which is
 * the point — a verdict that flatters the user destroys the only thing the
 * product has.
 */
export function recompVerdict({ weeklyDelta, liftStatuses }: VerdictInput): Verdict {
  const statuses = liftStatuses.filter((status): status is LiftStatus => status !== null);

  if (weeklyDelta === null) {
    return verdict(
      "baseline",
      "Baseline week",
      "This is the reference week. There is nothing to compare it against yet, so no verdict.",
      false,
    );
  }

  if (statuses.length < LIFT_AGREEMENT) {
    return verdict(
      "unavailable",
      "Verdict unavailable",
      statuses.length === 0
        ? "No lifts were logged with a previous week to compare against, so whether you held strength is unknown. Weight alone cannot tell you."
        : "Only one lift has a previous week to compare against. Log the other two to get a verdict.",
      false,
    );
  }

  const count = (...of: LiftStatus[]) =>
    statuses.filter((status) => of.includes(status)).length;

  const improved = count("improved");
  const holdingStrength = count("improved", "maintained");
  const declined = count("declined");
  const notImproving = count("maintained", "declined");

  if (weeklyDelta <= -WEIGHT_DELTA_THRESHOLD) {
    if (holdingStrength >= LIFT_AGREEMENT) {
      return verdict(
        "recomping",
        "Recomping",
        "Weight down, strength holding. This is exactly what you are looking for.",
      );
    }
    if (declined >= LIFT_AGREEMENT) {
      return verdict(
        "losing_more_than_fat",
        "Losing more than fat",
        "Weight is falling and strength is going with it. Protein and training frequency are the first places to look.",
      );
    }
  } else if (weeklyDelta >= WEIGHT_DELTA_THRESHOLD) {
    if (improved >= LIFT_AGREEMENT) {
      return verdict(
        "gaining",
        "Gaining",
        "Weight and strength both up. Fine if that is the goal.",
      );
    }
    if (notImproving >= LIFT_AGREEMENT) {
      return verdict(
        "off_track",
        "Off track",
        "Weight up, strength flat. Worth reviewing the week honestly.",
      );
    }
  } else {
    if (improved >= LIFT_AGREEMENT) {
      return verdict(
        "recomping_slowly",
        "Recomping slowly",
        "Scale is flat, strength is climbing. You are almost certainly leaner than last week.",
      );
    }
    if (notImproving >= LIFT_AGREEMENT) {
      return verdict("holding", "Holding", "Nothing moving in either direction.");
    }
  }

  // Reachable only when the lifts split without a majority, e.g. one improved
  // and one declined on a week weight fell. Saying so beats picking a side.
  return verdict(
    "mixed",
    "Mixed signals",
    "The lifts disagree with each other this week, so there is no clear read. Another week of data will settle it.",
    false,
  );
}
