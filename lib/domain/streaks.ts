import { isAnswered, isComplete } from "./compliance";
import { addDays, compareDates, daysBetween } from "./dates";
import { blockDayNumber } from "./weeks";
import type { DailyEntry, IsoDate } from "./types";

export const LAPSE_WINDOW_DAYS = 7;
/** Fewer than this many logged days in the window and the habit is slipping. */
export const LAPSE_MIN_DAYS_LOGGED = 5;
/** Drop-off risk peaks in week 1, but nagging on day 1 is just noise. */
export const BACKDATE_PROMPT_FROM_BLOCK_DAY = 3;

function completeDates(entries: DailyEntry[]): Set<IsoDate> {
  return new Set(entries.filter(isComplete).map((entry) => entry.entryDate));
}

/**
 * Consecutive fully completed days ending today or yesterday. Yesterday counts
 * because today is usually still in progress: a user who has not weighed in yet
 * at 9am has not broken anything.
 */
export function currentStreak(entries: DailyEntry[], today: IsoDate): number {
  const complete = completeDates(entries);
  const endsOn = complete.has(today)
    ? today
    : complete.has(addDays(today, -1))
      ? addDays(today, -1)
      : null;
  if (endsOn === null) return 0;

  let streak = 0;
  let cursor = endsOn;
  while (complete.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** The longest run of fully completed days anywhere in the given entries. */
export function longestStreak(entries: DailyEntry[]): number {
  const dates = [...completeDates(entries)].sort();
  let longest = 0;
  let run = 0;
  let previous: IsoDate | null = null;

  for (const date of dates) {
    run = previous !== null && daysBetween(previous, date) === 1 ? run + 1 : 1;
    previous = date;
    longest = Math.max(longest, run);
  }
  return longest;
}

/**
 * Fewer than five of the last seven days logged. Drives one quiet prompt offering
 * to backdate — not a warning, and never phrased as one.
 */
export function isLapsing(entries: DailyEntry[], today: IsoDate): boolean {
  const from = addDays(today, -(LAPSE_WINDOW_DAYS - 1));
  const logged = entries.filter(
    (entry) =>
      isAnswered(entry) &&
      compareDates(entry.entryDate, from) >= 0 &&
      compareDates(entry.entryDate, today) <= 0,
  ).length;
  return logged < LAPSE_MIN_DAYS_LOGGED;
}

/** Days in the last week with nothing answered, oldest first: exactly what the
 * backdate prompt offers to fill in. */
export function missingDates(
  entries: DailyEntry[],
  blockStart: IsoDate,
  today: IsoDate,
): IsoDate[] {
  const answered = new Set(entries.filter(isAnswered).map((entry) => entry.entryDate));
  const from = addDays(today, -(LAPSE_WINDOW_DAYS - 1));
  return Array.from({ length: LAPSE_WINDOW_DAYS }, (_, index) => addDays(from, index)).filter(
    (date) => blockDayNumber(blockStart, date) !== null && !answered.has(date),
  );
}

export function shouldPromptBackdate(
  entries: DailyEntry[],
  blockStart: IsoDate,
  today: IsoDate,
): boolean {
  const day = blockDayNumber(blockStart, today);
  if (day === null || day < BACKDATE_PROMPT_FROM_BLOCK_DAY) return false;
  return isLapsing(entries, today) && missingDates(entries, blockStart, today).length > 0;
}
