import { describe, expect, it } from "vitest";
import {
  blockDelta,
  lastRecordedWeight,
  rollingAverage7,
  roundWeight,
  weekAverage,
  weeklyDelta,
  weightSeries,
} from "./weight";
import { DEMO_BLOCK, DEMO_BLOCK_START, demoDailyEntries } from "./fixtures";
import { addDays } from "./dates";
import type { DailyEntry } from "./types";

const START = "2026-01-05";

function weights(values: (number | null)[], from = START): DailyEntry[] {
  return values.map((weight, index) => ({
    entryDate: addDays(from, index),
    weight,
    proteinHit: null,
    workoutDone: null,
    sleepHit: null,
    stepsHit: null,
    drinks: null,
  }));
}

describe("rollingAverage7", () => {
  it("returns null below four points in the window", () => {
    const entries = weights([95.8, 95.6, 95.9]);
    expect(rollingAverage7(entries, "2026-01-07")).toBeNull();
  });

  it("averages as soon as the fourth point lands", () => {
    const entries = weights([95.8, 95.6, 96.0, 95.4]);
    expect(rollingAverage7(entries, "2026-01-08")).toBeCloseTo(95.7, 5);
  });

  it("counts points in the window, not days: three weigh-ins in seven days is still null", () => {
    const entries = weights([95.8, null, null, 95.6, null, null, 96.0]);
    expect(rollingAverage7(entries, "2026-01-11")).toBeNull();
  });

  it("is trailing and inclusive, so it drops the eighth day back", () => {
    // 95.0 on day 1 leaves the window once the cursor reaches day 8.
    const entries = weights([95.0, 94.0, 94.0, 94.0, 94.0, 94.0, 94.0, 94.0]);
    expect(rollingAverage7(entries, "2026-01-11")).toBeCloseTo((95 + 94 * 6) / 7, 5);
    expect(rollingAverage7(entries, "2026-01-12")).toBeCloseTo(94, 5);
  });

  it("ignores days with no weigh-in rather than treating them as zero", () => {
    const entries = weights([94, null, 94, 94, null, 94]);
    expect(rollingAverage7(entries, "2026-01-10")).toBeCloseTo(94, 5);
  });
});

describe("weightSeries", () => {
  it("pairs each day with its raw weight and the average, both nullable", () => {
    const entries = weights([95.8, 95.6, 96.0, 95.4]);
    const series = weightSeries(entries, [
      "2026-01-05",
      "2026-01-06",
      "2026-01-07",
      "2026-01-08",
      "2026-01-09",
    ]);
    expect(series[0]).toEqual({ date: "2026-01-05", weight: 95.8, rollingAverage: null });
    expect(series[3].rollingAverage).toBeCloseTo(95.7, 5);
    expect(series[4].weight).toBeNull();
  });
});

describe("weekAverage and deltas", () => {
  it("averages only the days with a weigh-in", () => {
    const entries = weights([95.0, null, 94.0, null, null, null, null]);
    expect(weekAverage(entries, START, 1)).toBeCloseTo(94.5, 5);
  });

  it("is null for a week with no weigh-ins", () => {
    expect(weekAverage([], START, 3)).toBeNull();
  });

  it("has no weekly delta for week 1: there is nothing before it", () => {
    expect(weeklyDelta(demoDailyEntries(), DEMO_BLOCK_START, 1)).toBeNull();
  });

  it("refuses a delta when either week is empty", () => {
    const week2Only = weights(Array(7).fill(94), "2026-01-12");
    expect(weeklyDelta(week2Only, START, 2)).toBeNull();
  });

  it("compares week averages, not last day against last day", () => {
    const entries = [
      ...weights([95, 95, 95, 95, 95, 95, 90]),
      ...weights(Array(7).fill(94), "2026-01-12"),
    ];
    // Day-over-day would read -4.0; the honest figure is the average difference.
    expect(weeklyDelta(entries, START, 2)).toBeCloseTo(94 - (95 * 6 + 90) / 7, 5);
  });

  it("measures the block against its recorded starting weight", () => {
    const entries = demoDailyEntries();
    expect(blockDelta(entries, DEMO_BLOCK, 1)).toBeCloseTo(95.6 - 95.8, 5);
    expect(blockDelta(entries, DEMO_BLOCK, 8)).toBeCloseTo(93.0 - 95.8, 5);
  });

  it("walks the demo block down with two flat weeks and one rise", () => {
    const entries = demoDailyEntries();
    const deltas = [2, 3, 4, 5, 6, 7, 8].map((week) =>
      weeklyDelta(entries, DEMO_BLOCK_START, week),
    );
    expect(deltas.map((delta) => roundWeight(delta as number))).toEqual([
      -1, -1, 0, 0.4, 0.3, 0, -1.3,
    ]);
  });
});

describe("lastRecordedWeight", () => {
  it("prefills from the most recent weigh-in on or before the day", () => {
    const entries = weights([95.8, null, 95.4]);
    expect(lastRecordedWeight(entries, "2026-01-07")).toBe(95.4);
    expect(lastRecordedWeight(entries, "2026-01-06")).toBe(95.8);
    expect(lastRecordedWeight(entries, "2026-01-04")).toBeNull();
  });
});

describe("roundWeight", () => {
  it("keeps one decimal, the precision the input accepts", () => {
    expect(roundWeight(95.749)).toBe(95.7);
    expect(roundWeight(95.75)).toBe(95.8);
  });
});
