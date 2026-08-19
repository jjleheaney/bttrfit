import { weeklyCompliance, type MetricCompliance, type WeeklyCompliance } from "./compliance";
import { comparableRates, FOCUS_COPY, FOCUS_PRIORITY, type WeeklyFocus } from "./focus";
import { compareDates } from "./dates";
import {
  compareLiftsForWeek,
  liftE1RM,
  liftEntryForWeek,
  liftStatus,
  type LiftStatus,
} from "./lifts";
import { recompVerdict, type Verdict, type VerdictKey } from "./verdict";
import { blockDayNumber, blockEndDate, weekRange, WEEKS_PER_BLOCK } from "./weeks";
import { weekAverage, weeklyDelta, weightSeries, type WeightPoint } from "./weight";
import type { Block, DailyEntry, IsoDate, LiftEntry, MetricKey, SentinelLift } from "./types";

/**
 * The eight-week view: the same primitives the weekly screen uses, read across a
 * whole block. Nothing here re-derives a rule — a week's verdict on the block
 * screen is the same call the week screen makes, so the two can never disagree.
 */

export type BlockWeek = {
  weekNumber: number;
  startDate: IsoDate;
  endDate: IsoDate;
  /** Has the week begun by `today`. A week that has not is not a gap in the data. */
  started: boolean;
  /** All seven days behind the user. */
  finished: boolean;
  daysLogged: number;
  weightAverage: number | null;
  weeklyDelta: number | null;
  verdict: Verdict;
  compliance: WeeklyCompliance;
  /** How many of the sentinel lifts have a top set for this week. */
  liftsLogged: number;
};

export type LiftProgressPoint = {
  weekNumber: number;
  entry: LiftEntry | null;
  /** `null` on an unlogged week, so a line breaks rather than joining across it. */
  e1rm: number | null;
};

export type LiftProgress = {
  slot: 1 | 2 | 3;
  liftKey: string;
  displayName: string;
  /** One point per block week, in week order, logged or not. */
  points: LiftProgressPoint[];
  /** The first and last weeks actually logged, which are rarely weeks 1 and 8. */
  first: LiftEntry | null;
  last: LiftEntry | null;
  /** Fractional e1RM change from first to last logged week. */
  change: number | null;
  /** `null` until there are two logged weeks to compare. */
  status: LiftStatus | null;
};

export type BlockCompliance = {
  /** Days with at least one metric answered, across the whole block. */
  daysLogged: number;
  /** Days of the block that have happened, 0-56: the honest denominator for
   * "how much of this block did you actually log". */
  daysElapsed: number;
  protein: MetricCompliance;
  sleep: MetricCompliance;
  steps: MetricCompliance;
  workoutsCompleted: number;
  workoutsAnswered: number;
  totalDrinks: number;
  /** The weekly target multiplied by the weeks that have started. */
  drinksAllowance: number;
};

export type BlockSummary = {
  /** Weeks that have started, 1-8, or 0 before the block begins. */
  weeksElapsed: number;
  daysElapsed: number;
  /** True once all 56 days are behind the user: what triggers the review. */
  finished: boolean;
  startingWeight: number;
  /** The average of the last week that has any weigh-ins. */
  latestWeekAverage: number | null;
  /**
   * Which week `latestWeekAverage` came from. Not always the last week of the
   * block: someone who stops weighing in at week 5 still has a closing figure,
   * and calling it week 8's would misdate their own result.
   */
  latestWeekNumber: number | null;
  /** `latestWeekAverage` against the starting weight: the block's headline. */
  weightChange: number | null;
  /** Raw weigh-ins and the trailing mean for every block day up to `today`. */
  trend: WeightPoint[];
  weeks: BlockWeek[];
  lifts: LiftProgress[];
  compliance: BlockCompliance;
  verdictCounts: Record<VerdictKey, number>;
  /** Weeks that earned the verdict the product exists to deliver. */
  recompingWeeks: number;
  /** Weeks with a conclusive verdict of any kind: the denominator that stops
   * "2 recomping weeks" reading as a failure when only 3 weeks could be judged. */
  judgedWeeks: number;
  /** The metric that let the user down most consistently, with the standard
   * copy. `null` for a block with nothing logged. */
  weakestMetric: WeeklyFocus | null;
};

function emptyVerdictCounts(): Record<VerdictKey, number> {
  return {
    recomping: 0,
    losing_more_than_fat: 0,
    recomping_slowly: 0,
    holding: 0,
    gaining: 0,
    off_track: 0,
    baseline: 0,
    unavailable: 0,
    mixed: 0,
  };
}

/** 0-8: how many block weeks have begun by `today`. */
export function weeksStarted(blockStart: IsoDate, today: IsoDate): number {
  const day = blockDayNumber(blockStart, today);
  if (day !== null) return Math.floor((day - 1) / 7) + 1;
  return compareDates(today, blockStart) < 0 ? 0 : WEEKS_PER_BLOCK;
}

function liftProgress(lift: SentinelLift): LiftProgress {
  const points = Array.from({ length: WEEKS_PER_BLOCK }, (_, index) => {
    const weekNumber = index + 1;
    const entry = liftEntryForWeek(lift, weekNumber);
    return { weekNumber, entry, e1rm: entry ? liftE1RM(entry) : null };
  });

  const logged = points.filter((point) => point.entry !== null);
  const first = logged[0]?.entry ?? null;
  const last = logged.at(-1)?.entry ?? null;
  // One logged week is a start, not a comparison: first and last being the same
  // entry must not read as "maintained".
  const comparable = first !== null && last !== null && logged.length > 1;

  return {
    slot: lift.slot,
    liftKey: lift.liftKey,
    displayName: lift.displayName,
    points,
    first,
    last,
    change: comparable ? liftE1RM(last) / liftE1RM(first) - 1 : null,
    status: comparable ? liftStatus(last, first) : null,
  };
}

/** Every figure here is a sum of the weekly compliance the week screen already
 * showed, so the two agree by construction rather than by coincidence. */
function blockCompliance(weeks: BlockWeek[], block: Block, today: IsoDate): BlockCompliance {
  const started = weeks.filter((week) => week.started);
  const daysLogged = started.reduce((total, week) => total + week.compliance.daysLogged, 0);
  const day = blockDayNumber(block.startDate, today);
  const daysElapsed =
    day ?? (compareDates(today, block.startDate) < 0 ? 0 : weeks.length * 7);

  const sum = (read: (compliance: WeeklyCompliance) => MetricCompliance): MetricCompliance => {
    const days = started.reduce((total, week) => total + read(week.compliance).days, 0);
    const answered = started.reduce((total, week) => total + read(week.compliance).answered, 0);
    return {
      days,
      answered,
      rate: daysLogged === 0 ? null : days / daysLogged,
      answeredRate: answered === 0 ? null : days / answered,
    };
  };

  return {
    daysLogged,
    daysElapsed,
    protein: sum((compliance) => compliance.protein),
    sleep: sum((compliance) => compliance.sleep),
    steps: sum((compliance) => compliance.steps),
    workoutsCompleted: started.reduce(
      (total, week) => total + week.compliance.workoutsCompleted,
      0,
    ),
    workoutsAnswered: started.reduce(
      (total, week) => total + week.compliance.workoutsAnswered,
      0,
    ),
    totalDrinks: started.reduce((total, week) => total + week.compliance.totalDrinks, 0),
    drinksAllowance: started.length * block.weeklyDrinksTarget,
  };
}

/**
 * The metric that let the user down most consistently: the mean of each metric's
 * comparable rate across the weeks that were logged, lowest wins.
 *
 * Averaging the weeks rather than pooling the days is the point of the word
 * "consistently" — one catastrophic week should not outweigh seven decent ones,
 * and a metric that was quietly missed every single week should win even though
 * no single week looks alarming.
 */
/** The block-length counterpart to `HOLD_COPY`: eight weeks with nothing missed. */
export const BLOCK_HOLD_COPY =
  "Nothing let you down. Every metric you answered landed in every week you logged, which is rarer than the numbers above make it look.";

export function weakestMetric(weeks: BlockWeek[]): WeeklyFocus | null {
  const logged = weeks.filter((week) => week.compliance.daysLogged > 0);
  if (logged.length === 0) return null;

  const means = {} as Record<MetricKey, number>;
  for (const metric of FOCUS_PRIORITY) {
    means[metric] =
      logged.reduce((total, week) => total + comparableRates(week.compliance)[metric], 0) /
      logged.length;
  }

  if (FOCUS_PRIORITY.every((key) => means[key] >= 1)) {
    return { kind: "hold", metric: null, rate: 1, copy: BLOCK_HOLD_COPY };
  }

  const metric = FOCUS_PRIORITY.reduce((lowest, candidate) =>
    means[candidate] < means[lowest] ? candidate : lowest,
  );

  return { kind: "fix", metric, rate: means[metric], copy: FOCUS_COPY[metric] };
}

/**
 * Everything the block progress screen and the block review need. One pass over
 * the block, so the review is a presentation of the same numbers the user has
 * been reading weekly rather than a second opinion.
 */
export function blockSummary(
  block: Block,
  entries: DailyEntry[],
  lifts: SentinelLift[],
  today: IsoDate,
): BlockSummary {
  const elapsed = weeksStarted(block.startDate, today);

  const weeks: BlockWeek[] = Array.from({ length: WEEKS_PER_BLOCK }, (_, index) => {
    const weekNumber = index + 1;
    const { startDate, endDate } = weekRange(block.startDate, weekNumber);
    const compliance = weeklyCompliance(entries, block, weekNumber);
    const delta = weeklyDelta(entries, block.startDate, weekNumber);

    return {
      weekNumber,
      startDate,
      endDate,
      started: compareDates(startDate, today) <= 0,
      finished: compareDates(endDate, today) < 0,
      daysLogged: compliance.daysLogged,
      weightAverage: weekAverage(entries, block.startDate, weekNumber),
      weeklyDelta: delta,
      verdict: recompVerdict({
        weeklyDelta: delta,
        // The same call the week screen makes, so a week cannot carry one verdict
        // here and another there.
        liftStatuses: compareLiftsForWeek(lifts, weekNumber).map(
          (comparison) => comparison.status,
        ),
      }),
      compliance,
      liftsLogged: lifts.filter((lift) => liftEntryForWeek(lift, weekNumber) !== null).length,
    };
  });

  const verdictCounts = emptyVerdictCounts();
  for (const week of weeks) {
    // Only weeks that have started can have earned anything. A future week's
    // verdict is a "baseline"-shaped artefact of empty data, not a result.
    if (week.started) verdictCounts[week.verdict.key] += 1;
  }

  const withWeight = weeks.filter((week) => week.started && week.weightAverage !== null);
  const latestWeek = withWeight.at(-1) ?? null;
  const latestWeekAverage = latestWeek?.weightAverage ?? null;

  return {
    weeksElapsed: elapsed,
    daysElapsed: blockDayNumber(block.startDate, today) ?? (elapsed === 0 ? 0 : elapsed * 7),
    finished: compareDates(today, blockEndDate(block.startDate)) > 0,
    startingWeight: block.startingWeight,
    latestWeekAverage,
    latestWeekNumber: latestWeek?.weekNumber ?? null,
    weightChange: latestWeekAverage === null ? null : latestWeekAverage - block.startingWeight,
    trend: weightSeries(
      entries,
      // Clipped at today: a trailing mean still returns a figure for tomorrow,
      // computed from a window sliding off the end of the data.
      weeks
        .flatMap((week) => weekRange(block.startDate, week.weekNumber).dates)
        .filter((date) => compareDates(date, today) <= 0),
    ),
    weeks,
    lifts: lifts
      .slice()
      .sort((a, b) => a.slot - b.slot)
      .map(liftProgress),
    compliance: blockCompliance(weeks, block, today),
    verdictCounts,
    recompingWeeks: verdictCounts.recomping,
    judgedWeeks: weeks.filter((week) => week.started && week.verdict.conclusive).length,
    weakestMetric: weakestMetric(weeks),
  };
}
