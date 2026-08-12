import { addDays, compareDates, daysBetween } from "./dates";
import { DAYS_PER_BLOCK, blockEndDate } from "./weeks";
import type { IsoDate } from "./types";

/**
 * Moving a running block's start date.
 *
 * The start date is not a label: it is the origin every other number is derived
 * from. Which day of the block today is, which week a check-in falls into, the
 * contact sheet, the review's opening and closing weights and whether the block
 * is over are all `start_date` plus an offset. So a move is not an edit of one
 * field, it re-dates the whole block, and the rules below are about what the
 * block is still allowed to be afterwards.
 *
 * Check-ins are the thing that cannot be re-dated with it: `daily_entries` are
 * filed against absolute dates and hold a unique slot per day, so a day left
 * outside the moved block is data the user can neither see nor re-enter. Rather
 * than orphan or delete it, a move that would strand a logged day is refused and
 * names the day that blocks it.
 */

/**
 * How far ahead a block may be pushed.
 *
 * The forward direction exists for one reason: setup now starts every block
 * today, so "I meant to begin on Monday" has nowhere else to go. Two weeks is
 * enough for that intent — the same window creation allows — and past it the
 * honest answer is that the block has not begun and can be started fresh
 * instead of postponed indefinitely while holding the one-active-block slot.
 */
export const MAX_START_DATE_DAYS_AHEAD = 14;

export type StartDateRefusal = { allowed: false; reason: string };
export type StartDateDecision =
  | { allowed: true; startDate: IsoDate; endDate: IsoDate }
  | StartDateRefusal;

export type OtherBlockRange = {
  blockNumber: number;
  startDate: IsoDate;
  endDate: IsoDate;
};

export type StartDateMoveInput = {
  newStartDate: IsoDate;
  today: IsoDate;
  /** Dates of every check-in already logged against this block. */
  loggedDates: IsoDate[];
  /** The user's other blocks, whose days this one must not grow over. */
  otherBlocks?: OtherBlockRange[];
  /** Presentation is injected so the domain stays framework-agnostic. */
  formatDate?: (date: IsoDate) => string;
};

/** Earliest and latest start date a block may currently be moved to. */
export function startDateWindow({
  today,
  loggedDates,
}: {
  today: IsoDate;
  loggedDates: IsoDate[];
}): { earliest: IsoDate; latest: IsoDate } {
  const logged = sorted(loggedDates);
  const first = logged.at(0);
  const last = logged.at(-1);

  // The block has to keep covering today, and keep covering its last logged day.
  const coversToday = addDays(today, -(DAYS_PER_BLOCK - 1));
  const earliest =
    last && compareDates(addDays(last, -(DAYS_PER_BLOCK - 1)), coversToday) > 0
      ? addDays(last, -(DAYS_PER_BLOCK - 1))
      : coversToday;

  const furthestAhead = addDays(today, MAX_START_DATE_DAYS_AHEAD);
  const latest = first && compareDates(first, furthestAhead) < 0 ? first : furthestAhead;

  return { earliest, latest };
}

/**
 * Whether the block may start on `newStartDate`, and the end date that follows.
 *
 * The refusals are deliberately specific. "That date does not work" leaves the
 * user guessing which of their own check-ins is in the way, and the only way to
 * find out would be to try dates one at a time.
 */
export function planStartDateMove({
  newStartDate,
  today,
  loggedDates,
  otherBlocks = [],
  formatDate = (date) => date,
}: StartDateMoveInput): StartDateDecision {
  const endDate = blockEndDate(newStartDate);

  if (daysBetween(today, newStartDate) > MAX_START_DATE_DAYS_AHEAD) {
    return {
      allowed: false,
      reason: `A block can start at most ${MAX_START_DATE_DAYS_AHEAD} days from today, so ${formatDate(
        addDays(today, MAX_START_DATE_DAYS_AHEAD),
      )} is the latest. To begin later than that, let this block run out and start the next one.`,
    };
  }

  // A block whose last day is behind the user is a finished block, and finishing
  // one is a different decision from correcting its date: it settles the review
  // and frees the active slot. It is not something a start-date edit should do
  // on the user's behalf.
  if (compareDates(endDate, today) < 0) {
    return {
      allowed: false,
      reason: `Starting on ${formatDate(newStartDate)} would have ended the block on ${formatDate(
        endDate,
      )}, which is already past. ${formatDate(
        addDays(today, -(DAYS_PER_BLOCK - 1)),
      )} is the earliest start date that leaves the block still running.`,
    };
  }

  const logged = sorted(loggedDates);
  const first = logged.at(0);
  const last = logged.at(-1);

  if (first && compareDates(newStartDate, first) > 0) {
    return {
      allowed: false,
      reason: `You logged a day on ${formatDate(
        first,
      )}, which a block starting on ${formatDate(newStartDate)} would leave outside itself. ${formatDate(
        first,
      )} is the latest start date that keeps every day you have logged inside the block.`,
    };
  }

  if (last && compareDates(endDate, last) < 0) {
    return {
      allowed: false,
      reason: `You logged a day on ${formatDate(last)}, and a block starting on ${formatDate(
        newStartDate,
      )} would end on ${formatDate(endDate)}, before it. ${formatDate(
        addDays(last, -(DAYS_PER_BLOCK - 1)),
      )} is the earliest start date that keeps every day you have logged inside the block.`,
    };
  }

  // Days are unique per user, so two blocks sharing a date means one of them can
  // never record that day: the check-in would land on the other block's row.
  const clash = otherBlocks.find(
    (other) =>
      compareDates(newStartDate, other.endDate) <= 0 && compareDates(endDate, other.startDate) >= 0,
  );
  if (clash) {
    return {
      allowed: false,
      reason: `Those 8 weeks would run over block ${clash.blockNumber}, which ran until ${formatDate(
        clash.endDate,
      )}. Blocks cannot share days. ${formatDate(
        addDays(clash.endDate, 1),
      )} is the earliest start date clear of it.`,
    };
  }

  return { allowed: true, startDate: newStartDate, endDate };
}

function sorted(dates: IsoDate[]): IsoDate[] {
  return [...dates].sort(compareDates);
}
