import { addDays, compareDates, daysBetween } from "./dates";
import type { DailyEntry, IsoDate } from "./types";

export const DAYS_PER_WEEK = 7;
export const WEEKS_PER_BLOCK = 8;
export const DAYS_PER_BLOCK = DAYS_PER_WEEK * WEEKS_PER_BLOCK;

export type WeekRange = {
  weekNumber: number;
  startDate: IsoDate;
  endDate: IsoDate;
  dates: IsoDate[];
};

function assertWeekNumber(weekNumber: number): void {
  if (!Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > WEEKS_PER_BLOCK) {
    throw new RangeError(`Week number must be an integer 1-${WEEKS_PER_BLOCK}, received ${weekNumber}`);
  }
}

/** The last day of the block: 56 days long, so start + 55. */
export function blockEndDate(blockStart: IsoDate): IsoDate {
  return addDays(blockStart, DAYS_PER_BLOCK - 1);
}

/**
 * Weeks are anchored to the block start date, not to calendar Mondays: week n
 * runs from `start + (n-1)*7` for seven days.
 */
export function weekRange(blockStart: IsoDate, weekNumber: number): WeekRange {
  assertWeekNumber(weekNumber);
  const startDate = addDays(blockStart, (weekNumber - 1) * DAYS_PER_WEEK);
  return {
    weekNumber,
    startDate,
    endDate: addDays(startDate, DAYS_PER_WEEK - 1),
    dates: Array.from({ length: DAYS_PER_WEEK }, (_, index) => addDays(startDate, index)),
  };
}

/** `null` for any date outside the block's 56 days. */
export function weekNumberFor(blockStart: IsoDate, date: IsoDate): number | null {
  const offset = daysBetween(blockStart, date);
  if (offset < 0 || offset >= DAYS_PER_BLOCK) return null;
  return Math.floor(offset / DAYS_PER_WEEK) + 1;
}

/** 1-56 within the block, or `null` outside it. */
export function blockDayNumber(blockStart: IsoDate, date: IsoDate): number | null {
  const offset = daysBetween(blockStart, date);
  if (offset < 0 || offset >= DAYS_PER_BLOCK) return null;
  return offset + 1;
}

/** 1-7 within the block week, or `null` outside the block. */
export function dayOfWeekNumber(blockStart: IsoDate, date: IsoDate): number | null {
  const day = blockDayNumber(blockStart, date);
  if (day === null) return null;
  return ((day - 1) % DAYS_PER_WEEK) + 1;
}

export function entriesForWeek(
  entries: DailyEntry[],
  blockStart: IsoDate,
  weekNumber: number,
): DailyEntry[] {
  const { startDate, endDate } = weekRange(blockStart, weekNumber);
  return entries
    .filter(
      (entry) =>
        compareDates(entry.entryDate, startDate) >= 0 &&
        compareDates(entry.entryDate, endDate) <= 0,
    )
    .sort((a, b) => compareDates(a.entryDate, b.entryDate));
}

/**
 * How many days of the week have actually happened by `today`, 0-7. Used as
 * context alongside compliance so a partial week reads as partial.
 */
export function daysElapsedInWeek(
  blockStart: IsoDate,
  weekNumber: number,
  today: IsoDate,
): number {
  const { startDate } = weekRange(blockStart, weekNumber);
  const elapsed = daysBetween(startDate, today) + 1;
  if (elapsed < 0) return 0;
  return Math.min(elapsed, DAYS_PER_WEEK);
}

export function isBlockComplete(blockStart: IsoDate, today: IsoDate): boolean {
  return daysBetween(blockStart, today) >= DAYS_PER_BLOCK;
}
