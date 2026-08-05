import { entriesForWeek } from "./weeks";
import type { Block, DailyEntry, IsoDate } from "./types";

export type MetricCompliance = {
  /** Days the metric was answered yes. */
  days: number;
  /** Days the metric was answered either way. At most `daysLogged`: a day can be
   * logged without this particular question being answered. */
  answered: number;
  /** `days / daysLogged`, the figure the brief specifies for display, or `null`
   * when nothing has been logged yet. */
  rate: number | null;
  /** `days / answered`: the metric judged only on the days it was answered, and
   * `null` when it never was. Ranking uses this so a half-answered metric is not
   * scored as though the blanks were misses. */
  answeredRate: number | null;
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
  /** Days the training question was answered either way. */
  workoutsAnswered: number;
  totalDrinks: number;
  weeklyDrinksTarget: number;
  /** `null` for a week with nothing logged: such a week has not met the target,
   * and it has not missed it either. */
  drinksTargetMet: boolean | null;
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

function metric(days: number, answered: number, daysLogged: number): MetricCompliance {
  return {
    days,
    answered,
    rate: daysLogged === 0 ? null : days / daysLogged,
    answeredRate: answered === 0 ? null : days / answered,
  };
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
  const boolMetric = (read: (entry: DailyEntry) => boolean | null) =>
    metric(
      count((entry) => read(entry) === true),
      count((entry) => read(entry) !== null),
      daysLogged,
    );

  return {
    weekNumber,
    daysLogged,
    protein: boolMetric((entry) => entry.proteinHit),
    sleep: boolMetric((entry) => entry.sleepHit),
    steps: boolMetric((entry) => entry.stepsHit),
    workoutsCompleted: count((entry) => entry.workoutDone === true),
    workoutsAnswered: count((entry) => entry.workoutDone !== null),
    totalDrinks,
    weeklyDrinksTarget: block.weeklyDrinksTarget,
    drinksTargetMet: daysLogged === 0 ? null : totalDrinks <= block.weeklyDrinksTarget,
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
