import type { WeeklyCompliance } from "./compliance";
import type { MetricKey } from "./types";

/**
 * Tie-break order, and it is not arbitrary: protein and steps are both the most
 * commonly missed and the most directly causal, so they win ties.
 */
export const FOCUS_PRIORITY: MetricKey[] = ["protein", "steps", "sleep", "workouts", "alcohol"];

/**
 * Workouts are a count, not a rate, so ranking them against percentages needs a
 * reference. Four sessions a week is used for ranking only — the app still takes
 * no view on what the user does in the gym and never shows a workout percentage.
 */
export const WORKOUT_RANKING_BASELINE_PER_WEEK = 4;

/** Fixed copy per metric. No dynamic generation in v1. */
export const FOCUS_COPY: Record<MetricKey, string> = {
  protein: "Protein is the one to fix next week. Decide the first two meals before the day starts and the target stops depending on the evening.",
  steps: "Steps are the one to fix next week. One deliberate walk, same time each day, is easier to protect than finding the volume by accident.",
  sleep: "Sleep is the one to fix next week. Set the wind-down time rather than the wake time and the other five metrics get easier.",
  workouts: "Training frequency is the one to fix next week. Book the sessions in the diary now, and keep them short rather than skipping them.",
  alcohol: "Drinks are the one to fix next week. Pick which nights before the week starts, rather than deciding each evening.",
};

export type WeeklyFocus = {
  metric: MetricKey;
  /** 0-1, the comparable rate the ranking used. */
  rate: number;
  copy: string;
};

/**
 * Alcohol is scored against the block's target rather than as a per-day rate: at
 * or under target is full marks, and overshooting scales down by how far.
 */
function alcoholRate(compliance: WeeklyCompliance): number {
  if (compliance.drinksTargetMet !== false) return 1;
  if (compliance.weeklyDrinksTarget <= 0) return 0;
  return Math.max(0, Math.min(1, compliance.weeklyDrinksTarget / compliance.totalDrinks));
}

function workoutRate(compliance: WeeklyCompliance): number {
  const expected = (WORKOUT_RANKING_BASELINE_PER_WEEK * compliance.workoutsAnswered) / 7;
  if (expected <= 0) return 1;
  return Math.min(1, compliance.workoutsCompleted / expected);
}

/**
 * Ranking is done on `answeredRate`, not the displayed rate: a metric is judged on
 * the days it was answered, so leaving a question blank neither counts as a miss
 * nor, once it is answered on any day, hides the misses. A metric never answered
 * scores full marks, because there is nothing to fix that the user has admitted to.
 */
export function comparableRates(compliance: WeeklyCompliance): Record<MetricKey, number> {
  return {
    protein: compliance.protein.answeredRate ?? 1,
    steps: compliance.steps.answeredRate ?? 1,
    sleep: compliance.sleep.answeredRate ?? 1,
    workouts: workoutRate(compliance),
    alcohol: alcoholRate(compliance),
  };
}

/**
 * Exactly one recommendation per week. Presenting all the gaps at once reliably
 * produces zero change. `null` only when the week is empty, where there is
 * nothing to recommend from.
 */
export function weeklyFocus(compliance: WeeklyCompliance): WeeklyFocus | null {
  if (compliance.daysLogged === 0) return null;

  const rates = comparableRates(compliance);
  const metric = FOCUS_PRIORITY.reduce((lowest, candidate) =>
    rates[candidate] < rates[lowest] ? candidate : lowest,
  );

  return { metric, rate: rates[metric], copy: FOCUS_COPY[metric] };
}
