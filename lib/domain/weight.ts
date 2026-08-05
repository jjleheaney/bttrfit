import { addDays, compareDates } from "./dates";
import { entriesForWeek, weekRange } from "./weeks";
import type { Block, DailyEntry, IsoDate } from "./types";

export const ROLLING_WINDOW_DAYS = 7;
/** Below this, a trailing mean is noise dressed up as a trend. */
export const MIN_POINTS_FOR_ROLLING_AVERAGE = 4;

function mean(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function weightsBetween(entries: DailyEntry[], from: IsoDate, to: IsoDate): number[] {
  return entries
    .filter(
      (entry) =>
        entry.weight !== null &&
        compareDates(entry.entryDate, from) >= 0 &&
        compareDates(entry.entryDate, to) <= 0,
    )
    .map((entry) => entry.weight as number);
}

/**
 * Trailing 7-day mean ending on `onDate` inclusive. Returns `null` rather than a
 * misleading figure when the window holds fewer than four weigh-ins.
 */
export function rollingAverage7(entries: DailyEntry[], onDate: IsoDate): number | null {
  const from = addDays(onDate, -(ROLLING_WINDOW_DAYS - 1));
  const weights = weightsBetween(entries, from, onDate);
  if (weights.length < MIN_POINTS_FOR_ROLLING_AVERAGE) return null;
  return mean(weights);
}

export type WeightPoint = {
  date: IsoDate;
  /** The raw weigh-in, plotted small: the evidence. */
  weight: number | null;
  /** The trailing mean, plotted bold: the story. */
  rollingAverage: number | null;
};

export function weightSeries(entries: DailyEntry[], dates: IsoDate[]): WeightPoint[] {
  const byDate = new Map(entries.map((entry) => [entry.entryDate, entry]));
  return dates.map((date) => ({
    date,
    weight: byDate.get(date)?.weight ?? null,
    rollingAverage: rollingAverage7(entries, date),
  }));
}

export function weekAverage(
  entries: DailyEntry[],
  blockStart: IsoDate,
  weekNumber: number,
): number | null {
  const weights = entriesForWeek(entries, blockStart, weekNumber)
    .map((entry) => entry.weight)
    .filter((weight): weight is number => weight !== null);
  if (weights.length === 0) return null;
  return mean(weights);
}

/**
 * Week n's average against week n-1's. `null` for week 1, or when either week
 * has no weigh-ins: there is no honest comparison to make.
 */
export function weeklyDelta(
  entries: DailyEntry[],
  blockStart: IsoDate,
  weekNumber: number,
): number | null {
  if (weekNumber <= 1) return null;
  const current = weekAverage(entries, blockStart, weekNumber);
  const previous = weekAverage(entries, blockStart, weekNumber - 1);
  if (current === null || previous === null) return null;
  return current - previous;
}

export function blockDelta(
  entries: DailyEntry[],
  block: Block,
  weekNumber: number,
): number | null {
  const current = weekAverage(entries, block.startDate, weekNumber);
  if (current === null) return null;
  return current - block.startingWeight;
}

/** Weights are recorded and displayed to one decimal. */
export function roundWeight(weight: number): number {
  return Math.round(weight * 10) / 10;
}

/** The last weight recorded on or before `onDate`, for prefilling the check-in
 * so a normal day is an adjustment rather than typing from scratch. */
export function lastRecordedWeight(entries: DailyEntry[], onDate: IsoDate): number | null {
  const candidates = entries
    .filter((entry) => entry.weight !== null && compareDates(entry.entryDate, onDate) <= 0)
    .sort((a, b) => compareDates(a.entryDate, b.entryDate));
  return candidates.at(-1)?.weight ?? null;
}

export function weekDates(blockStart: IsoDate, weekNumber: number): IsoDate[] {
  return weekRange(blockStart, weekNumber).dates;
}
