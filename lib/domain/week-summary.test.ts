import { describe, expect, it } from "vitest";
import { weekSummary } from "./week-summary";
import {
  DEMO_BLOCK,
  DEMO_BLOCK_START,
  demoDailyEntries,
  demoSentinelLifts,
  midWeekOneEntries,
} from "./fixtures";
import { blockEndDate } from "./weeks";

const AFTER_BLOCK = "2026-03-02";

function summaryFor(week: number, today = AFTER_BLOCK) {
  return weekSummary(DEMO_BLOCK, demoDailyEntries(), demoSentinelLifts(), week, today);
}

describe("the seeded eight week block", () => {
  it("walks every row of the verdict table in order", () => {
    const verdicts = Array.from({ length: 8 }, (_, index) => summaryFor(index + 1).verdict.key);
    expect(verdicts).toEqual([
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

  it("holds the lagging result the product exists to show: weight down, bar up", () => {
    const first = summaryFor(1);
    const last = summaryFor(8);
    expect(last.weightAverage as number).toBeLessThan(first.weightAverage as number);
    expect(last.blockDelta as number).toBeLessThan(-2);
    // Bench and squat both finish above where they started.
    expect(last.lifts[0].e1rm).toBeGreaterThan(first.lifts[0].e1rm);
    expect(last.lifts[1].e1rm).toBeGreaterThan(first.lifts[1].e1rm);
  });

  it("includes a week where strength went backwards, so the data is not flattered", () => {
    expect(summaryFor(3).lifts.map((lift) => lift.status)).toEqual([
      "declined",
      "declined",
      "maintained",
    ]);
  });

  it("reports the week the drinking happened as over target", () => {
    const week6 = summaryFor(6);
    expect(week6.compliance.totalDrinks).toBe(8);
    expect(week6.compliance.drinksTargetMet).toBe(false);
    expect(week6.notes).toEqual([
      { date: "2026-02-11", note: "Wedding weekend. Wrote it down honestly." },
    ]);
  });

  it("dates each week from the block start and ends on the block's last day", () => {
    expect(summaryFor(1).startDate).toBe(DEMO_BLOCK_START);
    expect(summaryFor(8).endDate).toBe(blockEndDate(DEMO_BLOCK_START));
  });

  it("plots seven daily points per week with the average following behind", () => {
    const week2 = summaryFor(2);
    expect(week2.weight).toHaveLength(7);
    expect(week2.weight.every((point) => point.weight !== null)).toBe(true);
    expect(week2.weight.every((point) => point.rollingAverage !== null)).toBe(true);
    // Week 1 cannot have an average until its fourth weigh-in.
    expect(summaryFor(1).weight[2].rollingAverage).toBeNull();
    expect(summaryFor(1).weight[3].rollingAverage).not.toBeNull();
  });

  it("names one focus per week and nothing more", () => {
    const focuses = Array.from({ length: 8 }, (_, index) => summaryFor(index + 1).focus);
    expect(focuses.every((focus) => focus !== null)).toBe(true);
    expect(new Set(focuses.map((focus) => focus?.metric)).size).toBeGreaterThan(1);
  });
});

describe("a partial week", () => {
  const summary = weekSummary(
    DEMO_BLOCK,
    midWeekOneEntries(),
    demoSentinelLifts(),
    1,
    "2026-01-06",
  );

  it("reports two days elapsed and two logged, not a seven-day week", () => {
    expect(summary.daysElapsed).toBe(2);
    expect(summary.compliance.daysLogged).toBe(2);
    expect(summary.compliance.protein.rate).toBe(1);
  });

  it("gives no verdict and no weekly delta from a first week", () => {
    expect(summary.verdict.key).toBe("baseline");
    expect(summary.weeklyDelta).toBeNull();
    expect(summary.previousWeightAverage).toBeNull();
  });

  it("has no rolling average yet: two weigh-ins are not a trend", () => {
    expect(summary.weight.every((point) => point.rollingAverage === null)).toBe(true);
  });

  it("still measures the block delta, which only needs the starting weight", () => {
    expect(summary.blockDelta).toBeCloseTo((95.8 + 95.6) / 2 - 95.8, 5);
  });

  it("leaves the days that have not happened empty rather than missed", () => {
    expect(summary.weight.slice(2).every((point) => point.weight === null)).toBe(true);
  });
});

describe("a week with weight but no lifts", () => {
  it("says the verdict is unavailable instead of falling back to weight", () => {
    const summary = weekSummary(DEMO_BLOCK, demoDailyEntries(), [], 4, AFTER_BLOCK);
    expect(summary.weeklyDelta).not.toBeNull();
    expect(summary.verdict.key).toBe("unavailable");
    expect(summary.lifts).toEqual([]);
  });
});
