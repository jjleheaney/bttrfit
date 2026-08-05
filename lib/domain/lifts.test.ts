import { describe, expect, it } from "vitest";
import {
  SENTINEL_LIFT_MENU,
  compareLiftWeek,
  compareLiftsForWeek,
  epley1RM,
  formatTopSet,
  liftDisplayName,
  liftStatus,
} from "./lifts";
import { demoSentinelLifts } from "./fixtures";
import type { SentinelLift } from "./types";

describe("sentinel lift menu", () => {
  it("has unique keys", () => {
    const keys = SENTINEL_LIFT_MENU.map((lift) => lift.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("falls back to the raw key when a lift is not on the menu", () => {
    expect(liftDisplayName("back_squat")).toBe("Back squat");
    expect(liftDisplayName("zercher_carry")).toBe("zercher_carry");
  });
});

describe("epley1RM", () => {
  it("matches weight * (1 + reps / 30)", () => {
    expect(epley1RM(6, 80)).toBeCloseTo(96, 5);
    expect(epley1RM(1, 100)).toBeCloseTo(103.33, 2);
    expect(epley1RM(10, 65)).toBeCloseTo(86.67, 2);
  });
});

describe("liftStatus across rep ranges", () => {
  it("sees more reps at less weight as an improvement when the estimate rises", () => {
    // 8 x 75 = 95.0 against 6 x 80 = 96.0: slightly down, not up.
    expect(liftStatus({ weekNumber: 2, reps: 8, weight: 75 }, { weekNumber: 1, reps: 6, weight: 80 })).toBe(
      "declined",
    );
    // 10 x 72.5 = 96.67 against 6 x 80 = 96.0: fewer kilos, more work.
    expect(
      liftStatus({ weekNumber: 2, reps: 10, weight: 72.5 }, { weekNumber: 1, reps: 6, weight: 80 }),
    ).toBe("maintained");
    expect(
      liftStatus({ weekNumber: 2, reps: 12, weight: 72.5 }, { weekNumber: 1, reps: 6, weight: 80 }),
    ).toBe("improved");
  });

  it("holds the 1% threshold at both edges", () => {
    const previous = { weekNumber: 1, reps: 0, weight: 100 }; // e1RM 100.
    expect(liftStatus({ weekNumber: 2, reps: 0, weight: 101 }, previous)).toBe("maintained");
    expect(liftStatus({ weekNumber: 2, reps: 0, weight: 101.001 }, previous)).toBe("improved");
    expect(liftStatus({ weekNumber: 2, reps: 0, weight: 99 }, previous)).toBe("maintained");
    expect(liftStatus({ weekNumber: 2, reps: 0, weight: 98.999 }, previous)).toBe("declined");
  });

  it("calls an identical set maintained", () => {
    expect(
      liftStatus({ weekNumber: 2, reps: 6, weight: 80 }, { weekNumber: 1, reps: 6, weight: 80 }),
    ).toBe("maintained");
  });
});

describe("compareLiftWeek", () => {
  const lift: SentinelLift = {
    slot: 1,
    liftKey: "bench_press",
    displayName: "Bench press",
    entries: [
      { weekNumber: 1, reps: 6, weight: 80 },
      { weekNumber: 4, reps: 6, weight: 85 },
    ],
  };

  it("is null when the week was not logged", () => {
    expect(compareLiftWeek(lift, 2)).toBeNull();
  });

  it("gives no status for the first logged week", () => {
    const first = compareLiftWeek(lift, 1);
    expect(first?.status).toBeNull();
    expect(first?.previous).toBeNull();
    expect(first?.change).toBeNull();
    expect(first?.e1rm).toBeCloseTo(96, 5);
  });

  it("compares against the most recent logged week, skipping the gap", () => {
    const fourth = compareLiftWeek(lift, 4);
    expect(fourth?.previous?.weekNumber).toBe(1);
    expect(fourth?.status).toBe("improved");
    expect(fourth?.change).toBeCloseTo(102 / 96 - 1, 5);
  });
});

describe("compareLiftsForWeek", () => {
  it("returns lifts in slot order and drops unlogged ones", () => {
    const lifts = demoSentinelLifts();
    const week2 = compareLiftsForWeek(lifts, 2);
    expect(week2.map((comparison) => comparison.current.weight)).toEqual([85, 115, 67.5]);
    expect(week2.map((comparison) => comparison.status)).toEqual([
      "improved",
      "improved",
      "declined",
    ]);

    // The row is deliberately missing from week 8.
    expect(compareLiftsForWeek(lifts, 8)).toHaveLength(2);
  });

  it("reads the demo block's mid-block decline", () => {
    const week6 = compareLiftsForWeek(demoSentinelLifts(), 6);
    expect(week6.map((comparison) => comparison.status)).toEqual([
      "declined",
      "maintained",
      "declined",
    ]);
  });
});

describe("formatTopSet", () => {
  it("shows the set the user actually did, which is the primary figure", () => {
    expect(formatTopSet({ weekNumber: 1, reps: 6, weight: 80 })).toBe("6 x 80kg");
    expect(formatTopSet({ weekNumber: 1, reps: 8, weight: 155 }, "lbs")).toBe("8 x 155lbs");
  });
});
