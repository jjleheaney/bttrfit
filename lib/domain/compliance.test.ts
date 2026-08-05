import { describe, expect, it } from "vitest";
import { answeredMetricCount, isAnswered, isComplete, weeklyCompliance } from "./compliance";
import { DEMO_BLOCK, demoDailyEntries, midWeekOneEntries } from "./fixtures";
import type { Block, DailyEntry } from "./types";

const BLOCK: Block = {
  startDate: "2026-01-05",
  startingWeight: 95.8,
  proteinTargetG: 170,
  weeklyDrinksTarget: 3,
};

function entry(overrides: Partial<DailyEntry> & { entryDate: string }): DailyEntry {
  return {
    weight: null,
    proteinHit: null,
    workoutDone: null,
    sleepHit: null,
    stepsHit: null,
    drinks: null,
    ...overrides,
  };
}

describe("answered and complete", () => {
  it("treats a day with any one metric as logged", () => {
    expect(isAnswered(entry({ entryDate: "2026-01-05" }))).toBe(false);
    expect(isAnswered(entry({ entryDate: "2026-01-05", drinks: 0 }))).toBe(true);
    expect(isAnswered(entry({ entryDate: "2026-01-05", proteinHit: false }))).toBe(true);
  });

  it("does not count notes as a metric", () => {
    expect(isAnswered(entry({ entryDate: "2026-01-05", notes: "felt rough" }))).toBe(false);
  });

  it("requires all six metrics for a complete day, and zero counts as an answer", () => {
    const answered = entry({
      entryDate: "2026-01-05",
      weight: 95.8,
      proteinHit: false,
      workoutDone: false,
      sleepHit: false,
      stepsHit: false,
      drinks: 0,
    });
    expect(isComplete(answered)).toBe(true);
    expect(answeredMetricCount(answered)).toBe(6);
    expect(isComplete({ ...answered, drinks: null })).toBe(false);
    expect(answeredMetricCount({ ...answered, drinks: null, weight: null })).toBe(4);
  });
});

describe("weeklyCompliance", () => {
  it("uses days logged as the denominator, not seven", () => {
    const entries = [
      entry({ entryDate: "2026-01-05", proteinHit: true, drinks: 0 }),
      entry({ entryDate: "2026-01-06", proteinHit: true, drinks: 0 }),
    ];
    const week = weeklyCompliance(entries, BLOCK, 1);
    expect(week.daysLogged).toBe(2);
    expect(week.protein.rate).toBe(1);
    expect(week.protein.days).toBe(2);
  });

  it("returns null rates for an untouched week rather than zero", () => {
    const week = weeklyCompliance([], BLOCK, 4);
    expect(week.daysLogged).toBe(0);
    expect(week.protein.rate).toBeNull();
    expect(week.steps.rate).toBeNull();
    expect(week.sleep.rate).toBeNull();
    expect(week.workoutsCompleted).toBe(0);
  });

  it("counts only yes for a metric: unanswered is not a miss", () => {
    const entries = [
      entry({ entryDate: "2026-01-05", proteinHit: true, sleepHit: null }),
      entry({ entryDate: "2026-01-06", proteinHit: false, sleepHit: null }),
      entry({ entryDate: "2026-01-07", proteinHit: null, sleepHit: true }),
    ];
    const week = weeklyCompliance(entries, BLOCK, 1);
    expect(week.daysLogged).toBe(3);
    expect(week.protein.days).toBe(1);
    expect(week.sleep.days).toBe(1);
  });

  it("counts workouts rather than rating them", () => {
    const entries = [1, 2, 3, 4].map((day) =>
      entry({ entryDate: `2026-01-0${4 + day}`, workoutDone: day <= 3 }),
    );
    const week = weeklyCompliance(entries, BLOCK, 1);
    expect(week.workoutsCompleted).toBe(3);
    expect(week).not.toHaveProperty("workoutRate");
  });

  it("sums drinks and compares them with the block target", () => {
    const entries = [
      entry({ entryDate: "2026-01-05", drinks: 2 }),
      entry({ entryDate: "2026-01-06", drinks: 1 }),
    ];
    expect(weeklyCompliance(entries, BLOCK, 1).drinksTargetMet).toBe(true);
    expect(
      weeklyCompliance([...entries, entry({ entryDate: "2026-01-07", drinks: 1 })], BLOCK, 1)
        .drinksTargetMet,
    ).toBe(false);
  });

  it("reads the demo block's heavy week as heavy", () => {
    const week6 = weeklyCompliance(demoDailyEntries(), DEMO_BLOCK, 6);
    expect(week6.daysLogged).toBe(7);
    expect(week6.totalDrinks).toBe(8);
    expect(week6.drinksTargetMet).toBe(false);
    expect(week6.protein.rate).toBeCloseTo(3 / 7, 5);
  });

  it("handles a user two days into week 1", () => {
    const week1 = weeklyCompliance(midWeekOneEntries(), DEMO_BLOCK, 1);
    expect(week1.daysLogged).toBe(2);
    expect(week1.protein.rate).toBe(1);
    expect(week1.steps.rate).toBe(0.5);
    expect(week1.workoutsCompleted).toBe(1);
  });

  it("keeps the demo block's protein compliance around 80%", () => {
    const entries = demoDailyEntries();
    const proteinDays = Array.from({ length: 8 }, (_, index) =>
      weeklyCompliance(entries, DEMO_BLOCK, index + 1).protein.days,
    ).reduce((total, days) => total + days, 0);
    expect(proteinDays / 56).toBeGreaterThan(0.75);
    expect(proteinDays / 56).toBeLessThan(0.9);
  });
});
