import { weeklyCompliance, type WeeklyCompliance } from "./compliance";
import { compareLiftsForWeek, type LiftWeekComparison } from "./lifts";
import { recompVerdict, type Verdict } from "./verdict";
import { weeklyFocus, type WeeklyFocus } from "./focus";
import { blockDelta, weekAverage, weeklyDelta, weightSeries, type WeightPoint } from "./weight";
import { daysElapsedInWeek, weekRange } from "./weeks";
import type { Block, DailyEntry, IsoDate, SentinelLift } from "./types";

export type WeekSummary = {
  weekNumber: number;
  startDate: IsoDate;
  endDate: IsoDate;
  /** 0-7. Shown next to compliance so a partial week reads as partial. */
  daysElapsed: number;
  compliance: WeeklyCompliance;
  weightAverage: number | null;
  previousWeightAverage: number | null;
  weeklyDelta: number | null;
  blockDelta: number | null;
  weight: WeightPoint[];
  lifts: LiftWeekComparison[];
  verdict: Verdict;
  /** The single thing to fix next week. `null` for an empty week. */
  focus: WeeklyFocus | null;
  notes: { date: IsoDate; note: string }[];
};

/**
 * Everything the This week screen and the deferred LLM export need for one week,
 * composed from the primitives rather than recomputed by callers.
 */
export function weekSummary(
  block: Block,
  entries: DailyEntry[],
  lifts: SentinelLift[],
  weekNumber: number,
  today: IsoDate,
): WeekSummary {
  const { startDate, endDate, dates } = weekRange(block.startDate, weekNumber);
  const compliance = weeklyCompliance(entries, block, weekNumber);
  const liftComparisons = compareLiftsForWeek(lifts, weekNumber);

  const delta = weeklyDelta(entries, block.startDate, weekNumber);

  return {
    weekNumber,
    startDate,
    endDate,
    daysElapsed: daysElapsedInWeek(block.startDate, weekNumber, today),
    compliance,
    weightAverage: weekAverage(entries, block.startDate, weekNumber),
    previousWeightAverage:
      weekNumber > 1 ? weekAverage(entries, block.startDate, weekNumber - 1) : null,
    weeklyDelta: delta,
    blockDelta: blockDelta(entries, block, weekNumber),
    weight: weightSeries(entries, dates),
    lifts: liftComparisons,
    verdict: recompVerdict({
      weeklyDelta: delta,
      liftStatuses: liftComparisons.map((comparison) => comparison.status),
    }),
    focus: weeklyFocus(compliance),
    notes: entries
      .filter((entry) => entry.entryDate >= startDate && entry.entryDate <= endDate)
      .filter((entry) => Boolean(entry.notes?.trim()))
      .map((entry) => ({ date: entry.entryDate, note: entry.notes as string })),
  };
}
