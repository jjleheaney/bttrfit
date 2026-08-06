import { compareDates } from "./dates";
import { weekRange } from "./weeks";
import type { Block, DailyEntry, IsoDate } from "./types";

/**
 * The week grid: six metrics by seven days. Kept in the domain layer rather than
 * the component because it is the screen the product is remembered for, it has
 * real rules, and the React Native port should render the same cells.
 */

export type CellState =
  /** Answered yes, or a proportional row with something to show. */
  | "hit"
  /** Answered no. */
  | "miss"
  /** The day has happened and this question was left blank. */
  | "unanswered"
  /** The day has not happened yet. Never a miss. */
  | "future";

export type SheetCell = {
  date: IsoDate;
  state: CellState;
  /**
   * 0-1 for the two rows the brief specifies as proportional rather than binary,
   * `null` everywhere else. A `hit` cell with a fill is drawn part-filled.
   */
  fill: number | null;
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
  if (future) return { date, state: "future", fill: null, label: `${label} not yet` };
  if (value === true) return { date, state: "hit", fill: null, label: `${label} hit` };
  if (value === false) return { date, state: "miss", fill: null, label: `${label} missed` };
  return { date, state: "unanswered", fill: null, label: `${label} not answered` };
}

/**
 * Weight is relative to the week's own spread: the lightest day of the week fills
 * the square, the heaviest leaves it nearly empty. It is a shape, not a score —
 * the trend line above the sheet is where the actual number lives. A week with a
 * single weigh-in has no spread, so that day reads as full.
 */
function weightFill(weight: number, lightest: number, heaviest: number): number {
  if (heaviest - lightest < 0.05) return 1;
  return (heaviest - weight) / (heaviest - lightest);
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

  const weights = dates
    .map((date) => byDate.get(date)?.weight)
    .filter((weight): weight is number => typeof weight === "number");
  const lightest = Math.min(...weights);
  const heaviest = Math.max(...weights);

  const weightRow: SheetRow = {
    key: "weight",
    label: "Weight",
    cells: dates.map((date) => {
      const weight = byDate.get(date)?.weight ?? null;
      if (isFuture(date)) return { date, state: "future", fill: null, label: "Not yet" };
      if (weight === null)
        return { date, state: "unanswered", fill: null, label: "Not weighed" };
      return {
        date,
        state: "hit",
        fill: weightFill(weight, lightest, heaviest),
        label: `${weight.toFixed(1)}`,
      };
    }),
  };

  const drinksRow: SheetRow = {
    key: "drinks",
    label: "Drinks",
    cells: dates.map((date) => {
      const drinks = byDate.get(date)?.drinks ?? null;
      if (isFuture(date)) return { date, state: "future", fill: null, label: "Not yet" };
      if (drinks === null)
        return { date, state: "unanswered", fill: null, label: "Drinks not answered" };
      // Filled by the share of the week's whole allowance the day used, so one
      // heavy night reads as heavy. Zero is an empty square, not a miss.
      const target = block.weeklyDrinksTarget;
      const fill = target <= 0 ? (drinks > 0 ? 1 : 0) : Math.min(1, drinks / target);
      return {
        date,
        state: "hit",
        fill,
        label: drinks === 1 ? "1 drink" : `${drinks} drinks`,
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
