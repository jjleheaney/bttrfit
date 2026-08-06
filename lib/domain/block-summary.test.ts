import { describe, expect, it } from "vitest";
import { blockSummary, weakestMetric, weeksStarted } from "./block-summary";
import {
  DEMO_BLOCK,
  DEMO_BLOCK_START,
  demoDailyEntries,
  demoSentinelLifts,
  midWeekOneEntries,
} from "./fixtures";
import { addDays, compareDates } from "./dates";
import { WEEKS_PER_BLOCK, blockEndDate, weekRange } from "./weeks";

const AFTER_BLOCK = "2026-03-02";
const MID_WEEK_ONE = addDays(DEMO_BLOCK_START, 1);

function complete(today = AFTER_BLOCK) {
  return blockSummary(DEMO_BLOCK, demoDailyEntries(), demoSentinelLifts(), today);
}

describe("weeksStarted", () => {
  it("is 0 before the block begins and 8 once it is over", () => {
    expect(weeksStarted(DEMO_BLOCK_START, addDays(DEMO_BLOCK_START, -1))).toBe(0);
    expect(weeksStarted(DEMO_BLOCK_START, DEMO_BLOCK_START)).toBe(1);
    expect(weeksStarted(DEMO_BLOCK_START, addDays(DEMO_BLOCK_START, 6))).toBe(1);
    expect(weeksStarted(DEMO_BLOCK_START, addDays(DEMO_BLOCK_START, 7))).toBe(2);
    expect(weeksStarted(DEMO_BLOCK_START, blockEndDate(DEMO_BLOCK_START))).toBe(8);
    expect(weeksStarted(DEMO_BLOCK_START, AFTER_BLOCK)).toBe(8);
  });
});

describe("the finished demo block", () => {
  it("carries one row per week, in order, all started and finished", () => {
    const summary = complete();
    expect(summary.weeks.map((week) => week.weekNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(summary.weeks.every((week) => week.started && week.finished)).toBe(true);
    expect(summary.finished).toBe(true);
    expect(summary.weeksElapsed).toBe(8);
  });

  it("repeats the weekly verdicts rather than forming a second opinion", () => {
    expect(complete().weeks.map((week) => week.verdict.key)).toEqual([
      "baseline",
      "recomping",
      "losing_more_than_fat",
      "recomping_slowly",
      "gaining",
      "off_track",
      "holding",
      "recomping",
    ]);
  });

  it("counts the recomping weeks against the weeks that could be judged", () => {
    const summary = complete();
    expect(summary.recompingWeeks).toBe(2);
    expect(summary.verdictCounts.baseline).toBe(1);
    // Every week except the baseline reached a conclusion.
    expect(summary.judgedWeeks).toBe(7);
  });

  it("reports the block's weight change from the starting weight", () => {
    const summary = complete();
    expect(summary.startingWeight).toBe(95.8);
    expect(summary.latestWeekAverage).toBeCloseTo(93.0, 5);
    expect(summary.latestWeekNumber).toBe(WEEKS_PER_BLOCK);
    expect(summary.weightChange).toBeCloseTo(-2.8, 5);
  });

  it("shows the lagging result: bodyweight down while the bar holds or climbs", () => {
    const summary = complete();
    expect(summary.weightChange as number).toBeLessThan(0);

    const [bench, squat] = summary.lifts;
    expect(bench.status).toBe("improved");
    expect(squat.status).toBe("improved");
    expect(bench.first).toEqual({ weekNumber: 1, reps: 6, weight: 80 });
    expect(bench.last).toEqual({ weekNumber: 8, reps: 5, weight: 90 });
    expect(bench.change as number).toBeGreaterThan(0.05);
  });

  it("compares each lift's first logged week against its last, not week 1 to week 8", () => {
    // The row is not logged in week 8, so its finish is week 7.
    const row = complete().lifts[2];
    expect(row.first?.weekNumber).toBe(1);
    expect(row.last?.weekNumber).toBe(7);
    expect(row.points).toHaveLength(8);
    expect(row.points[7].entry).toBeNull();
    expect(row.points[7].e1rm).toBeNull();
  });

  it("keeps the lifts in slot order", () => {
    expect(complete().lifts.map((lift) => lift.slot)).toEqual([1, 2, 3]);
  });

  it("counts how many lifts each week has logged", () => {
    const summary = complete();
    expect(summary.weeks[0].liftsLogged).toBe(3);
    expect(summary.weeks[7].liftsLogged).toBe(2);
  });

  it("sums compliance across the block against the days actually logged", () => {
    const summary = complete();
    expect(summary.compliance.daysLogged).toBe(56);
    expect(summary.compliance.daysElapsed).toBe(56);
    expect(summary.compliance.protein.days).toBe(46);
    expect(summary.compliance.protein.rate as number).toBeCloseTo(46 / 56, 5);
    expect(summary.compliance.workoutsCompleted).toBe(30);
    expect(summary.compliance.drinksAllowance).toBe(8 * DEMO_BLOCK.weeklyDrinksTarget);
    expect(summary.compliance.totalDrinks).toBe(24);
  });

  it("names steps as the metric that let the block down most consistently", () => {
    // Steps run ~50% every week; the drinking is one bad week, which is exactly
    // the difference between "worst week" and "most consistent failure".
    expect(complete().weakestMetric?.metric).toBe("steps");
  });

  it("dates the closing weight to the last week weighed in, not to week 8", () => {
    // Someone who stops weighing in at week 5 still has a closing figure. It is
    // week 5's, and the review has to be able to say so.
    const lastWeighIn = weekRange(DEMO_BLOCK_START, 5).endDate;
    const entries = demoDailyEntries().map((entry) =>
      compareDates(entry.entryDate, lastWeighIn) > 0 ? { ...entry, weight: null } : entry,
    );
    const summary = blockSummary(DEMO_BLOCK, entries, demoSentinelLifts(), AFTER_BLOCK);
    expect(summary.latestWeekNumber).toBe(5);
    expect(summary.latestWeekAverage).toBe(summary.weeks[4].weightAverage);
  });

  it("plots every block day once the block is over", () => {
    const trend = complete().trend;
    expect(trend).toHaveLength(56);
    expect(trend[0].date).toBe(DEMO_BLOCK_START);
    expect(trend.at(-1)?.date).toBe(blockEndDate(DEMO_BLOCK_START));
  });
});

describe("a block in progress", () => {
  it("stops the trend at today rather than plotting a trailing mean into the future", () => {
    const summary = blockSummary(
      DEMO_BLOCK,
      demoDailyEntries(),
      demoSentinelLifts(),
      addDays(DEMO_BLOCK_START, 20),
    );
    expect(summary.trend).toHaveLength(21);
    expect(summary.trend.at(-1)?.date).toBe(addDays(DEMO_BLOCK_START, 20));
    expect(summary.finished).toBe(false);
    expect(summary.weeksElapsed).toBe(3);
  });

  it("marks unstarted weeks as unstarted and keeps their verdicts out of the counts", () => {
    const summary = blockSummary(DEMO_BLOCK, midWeekOneEntries(), demoSentinelLifts(), MID_WEEK_ONE);
    expect(summary.weeks[0].started).toBe(true);
    expect(summary.weeks[0].finished).toBe(false);
    expect(summary.weeks.filter((week) => week.started)).toHaveLength(1);
    // Only week 1 counts, and week 1 is the baseline: nothing has been earned yet.
    expect(summary.judgedWeeks).toBe(0);
    expect(summary.recompingWeeks).toBe(0);
    expect(summary.verdictCounts.baseline).toBe(1);
  });

  it("uses the days elapsed, not seven days a week, as the block denominator", () => {
    const summary = blockSummary(DEMO_BLOCK, midWeekOneEntries(), demoSentinelLifts(), MID_WEEK_ONE);
    expect(summary.compliance.daysElapsed).toBe(2);
    expect(summary.compliance.daysLogged).toBe(2);
    expect(summary.compliance.drinksAllowance).toBe(DEMO_BLOCK.weeklyDrinksTarget);
  });

  it("refuses a weight change until a week has a weigh-in", () => {
    const summary = blockSummary(DEMO_BLOCK, [], demoSentinelLifts(), MID_WEEK_ONE);
    expect(summary.latestWeekAverage).toBeNull();
    expect(summary.latestWeekNumber).toBeNull();
    expect(summary.weightChange).toBeNull();
    expect(summary.weakestMetric).toBeNull();
    expect(summary.compliance.protein.rate).toBeNull();
  });

  it("holds nothing before the block starts", () => {
    const summary = blockSummary(
      DEMO_BLOCK,
      [],
      demoSentinelLifts(),
      addDays(DEMO_BLOCK_START, -3),
    );
    expect(summary.weeksElapsed).toBe(0);
    expect(summary.daysElapsed).toBe(0);
    expect(summary.trend).toHaveLength(0);
    expect(summary.compliance.daysElapsed).toBe(0);
    expect(summary.compliance.drinksAllowance).toBe(0);
    expect(summary.finished).toBe(false);
  });
});

describe("a lift with one logged week", () => {
  it("is a start, not a comparison", () => {
    const summary = blockSummary(
      DEMO_BLOCK,
      demoDailyEntries(),
      [
        {
          slot: 1,
          liftKey: "bench_press",
          displayName: "Bench press",
          entries: [{ weekNumber: 1, reps: 6, weight: 80 }],
        },
      ],
      AFTER_BLOCK,
    );

    const [bench] = summary.lifts;
    expect(bench.first).toEqual(bench.last);
    expect(bench.change).toBeNull();
    expect(bench.status).toBeNull();
  });
});

describe("weakestMetric", () => {
  it("prefers a metric missed every week over one catastrophic week", () => {
    const summary = complete();
    const consistent = weakestMetric(summary.weeks);
    expect(consistent?.metric).toBe("steps");
    expect(consistent?.rate as number).toBeLessThan(1);
    expect(consistent?.copy).toContain("Steps");
  });

  it("is null when no week has anything logged", () => {
    expect(weakestMetric(blockSummary(DEMO_BLOCK, [], [], AFTER_BLOCK).weeks)).toBeNull();
  });
});
