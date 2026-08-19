import { compareDates } from "./dates";
import { weekRange } from "./weeks";
import type { Block, DailyEntry, IsoDate } from "./types";

/**
 * The week grid: six metrics by seven days. Kept in the domain layer rather than
 * the component because it is the screen the product is remembered for, it has
 * real rules, and the React Native port should render the same cells.
 */

export type CellState =
  /** Answered yes, or a measured row with a value to show. */
  | "hit"
  /** Answered no. */
  | "miss"
  /**
   * Answered, and past the point where the answer is still within the block's
   * own target. Only drinks can reach it: nothing else has a weekly allowance.
   */
  | "over"
  /** The day has happened and this question was left blank. */
  | "unanswered"
  /** The day has not happened yet. Never a miss. */
  | "future";

export type SheetCell = {
  date: IsoDate;
  state: CellState;
  /**
   * The number to print in the square, for the rows that carry one rather than a
   * yes or a no, and `null` for the binary rows. Formatted here so the grid, the
   * React Native port and the screen reader all say the same thing.
   */
  value: string | null;
  /** Read out to screen readers, so it has to say the value, not the colour. */
  label: string;
};

export type SheetRowKey = "weight" | "protein" | "workouts" | "sleep" | "steps" | "drinks";

export type SheetRow = {
  key: SheetRowKey;
  label: string;
  cells: SheetCell[];
};

const BINARY_ROWS: { key: SheetRowKey; label: string; of: (entry: DailyEntry) => boolean | null }[] =
  [
    { key: "protein", label: "Protein", of: (entry) => entry.proteinHit },
    { key: "workouts", label: "Training", of: (entry) => entry.workoutDone },
    { key: "sleep", label: "Sleep", of: (entry) => entry.sleepHit },
    { key: "steps", label: "Steps", of: (entry) => entry.stepsHit },
  ];

function binaryCell(
  date: IsoDate,
  label: string,
  value: boolean | null | undefined,
  future: boolean,
): SheetCell {
  if (future) return { date, state: "future", value: null, label: `${label} not yet` };
  if (value === true) return { date, state: "hit", value: null, label: `${label} hit` };
  if (value === false) return { date, state: "miss", value: null, label: `${label} missed` };
  return { date, state: "unanswered", value: null, label: `${label} not answered` };
}

export function contactSheet(
  entries: DailyEntry[],
  block: Block,
  weekNumber: number,
  today: IsoDate,
): SheetRow[] {
  const { dates } = weekRange(block.startDate, weekNumber);
  const byDate = new Map(entries.map((entry) => [entry.entryDate, entry]));
  const isFuture = (date: IsoDate) => compareDates(date, today) > 0;

  const weightRow: SheetRow = {
    key: "weight",
    label: "Weight",
    cells: dates.map((date) => {
      const weight = byDate.get(date)?.weight ?? null;
      if (isFuture(date)) return { date, state: "future", value: null, label: "Not yet" };
      if (weight === null)
        return { date, state: "unanswered", value: null, label: "Not weighed" };
      // The day's own figure, so the row reads as a week of weights rather than a
      // shape whose meaning has to be remembered.
      return { date, state: "hit", value: weight.toFixed(1), label: `${weight.toFixed(1)}` };
    }),
  };

  // Running total, not the day in isolation: it is the week that has an
  // allowance, so the day it is spent and every day after it are over target,
  // and one heavy Friday does not go quietly because Saturday was dry.
  let drinksSoFar = 0;

  const drinksRow: SheetRow = {
    key: "drinks",
    label: "Drinks",
    cells: dates.map((date) => {
      const drinks = byDate.get(date)?.drinks ?? null;
      if (isFuture(date)) return { date, state: "future", value: null, label: "Not yet" };
      if (drinks === null)
        return { date, state: "unanswered", value: null, label: "Drinks not answered" };

      drinksSoFar += drinks;
      const over = drinksSoFar > block.weeklyDrinksTarget;
      const counted = drinks === 1 ? "1 drink" : `${drinks} drinks`;

      // A logged zero is an answer and reads as one. Its own state is the week's,
      // so a dry day after the target is spent is not scored as back inside it.
      return {
        date,
        state: over ? "over" : "hit",
        value: String(drinks),
        label: over
          ? `${counted}, ${drinksSoFar} of ${block.weeklyDrinksTarget} this week: over`
          : `${counted}, ${drinksSoFar} of ${block.weeklyDrinksTarget} this week`,
      };
    }),
  };

  return [
    weightRow,
    ...BINARY_ROWS.map(({ key, label, of }) => ({
      key,
      label,
      cells: dates.map((date) => {
        const entry = byDate.get(date);
        return binaryCell(date, label, entry ? of(entry) : null, isFuture(date));
      }),
    })),
    drinksRow,
  ];
}
