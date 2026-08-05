import { entriesForWeek } from "./weeks";
import type { Block, DailyEntry, IsoDate } from "./types";

export type MetricCompliance = {
  /** Days the metric was answered yes. */
  days: number;
  /** `days / daysLogged`, or `null` when nothing has been logged yet. */
  rate: number | null;
};

export type WeeklyCompliance = {
  weekNumber: number;
  /** Days with at least one metric answered. The denominator for every rate, so
   * a day that has not happened yet never counts against the user. */
  daysLogged: number;
  protein: MetricCompliance;
  sleep: MetricCompliance;
  steps: MetricCompliance;
  /** A count, not a rate: there is no fixed weekly workout target. */
  workoutsCompleted: number;
  totalDrinks: number;
  weeklyDrinksTarget: number;
  drinksTargetMet: boolean;
};

/** A day counts as logged once any single metric has been answered. Notes alone
 * do not count: they are not a metric. */
export function isAnswered(entry: DailyEntry): boolean {
  return (
    entry.weight !== null ||
    entry.proteinHit !== null ||
    entry.workoutDone !== null ||
    entry.sleepHit !== null ||
    entry.stepsHit !== null ||
    entry.drinks !== null
  );
}

/** All six metrics answered. This is what a streak day requires. */
export function isComplete(entry: DailyEntry): boolean {
  return (
    entry.weight !== null &&
    entry.proteinHit !== null &&
    entry.workoutDone !== null &&
    entry.sleepHit !== null &&
    entry.stepsHit !== null &&
    entry.drinks !== null
  );
}

export function answeredMetricCount(entry: DailyEntry): number {
  return [
    entry.weight,
    entry.proteinHit,
    entry.workoutDone,
    entry.sleepHit,
    entry.stepsHit,
    entry.drinks,
  ].filter((value) => value !== null).length;
}

function metric(days: number, daysLogged: number): MetricCompliance {
  return { days, rate: daysLogged === 0 ? null : days / daysLogged };
}

export function weeklyCompliance(
  entries: DailyEntry[],
  block: Block,
  weekNumber: number,
): WeeklyCompliance {
  const weekEntries = entriesForWeek(entries, block.startDate, weekNumber);
  const logged = weekEntries.filter(isAnswered);
  const daysLogged = logged.length;

  const count = (predicate: (entry: DailyEntry) => boolean) => logged.filter(predicate).length;
  const totalDrinks = logged.reduce((total, entry) => total + (entry.drinks ?? 0), 0);

  return {
    weekNumber,
    daysLogged,
    protein: metric(count((entry) => entry.proteinHit === true), daysLogged),
    sleep: metric(count((entry) => entry.sleepHit === true), daysLogged),
    steps: metric(count((entry) => entry.stepsHit === true), daysLogged),
    workoutsCompleted: count((entry) => entry.workoutDone === true),
    totalDrinks,
    weeklyDrinksTarget: block.weeklyDrinksTarget,
    drinksTargetMet: totalDrinks <= block.weeklyDrinksTarget,
  };
}

export function daysLoggedBetween(
  entries: DailyEntry[],
  from: IsoDate,
  to: IsoDate,
): number {
  return entries.filter(
    (entry) => isAnswered(entry) && entry.entryDate >= from && entry.entryDate <= to,
  ).length;
}
