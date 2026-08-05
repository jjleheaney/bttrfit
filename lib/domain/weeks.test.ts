import { describe, expect, it } from "vitest";
import {
  blockDayNumber,
  blockEndDate,
  dayOfWeekNumber,
  daysElapsedInWeek,
  entriesForWeek,
  isBlockComplete,
  weekNumberFor,
  weekRange,
} from "./weeks";
import { demoDailyEntries, DEMO_BLOCK_START } from "./fixtures";
import type { DailyEntry } from "./types";

const START = "2026-01-05"; // A Monday.

function entry(entryDate: string): DailyEntry {
  return {
    entryDate,
    weight: 90,
    proteinHit: null,
    workoutDone: null,
    sleepHit: null,
    stepsHit: null,
    drinks: null,
  };
}

describe("block boundaries", () => {
  it("is 56 days long, so the last day is start + 55", () => {
    expect(blockEndDate(START)).toBe("2026-03-01");
    expect(blockDayNumber(START, "2026-03-01")).toBe(56);
    expect(blockDayNumber(START, "2026-03-02")).toBeNull();
    expect(blockDayNumber(START, "2026-01-04")).toBeNull();
  });

  it("treats the start date as day 1, not day 0", () => {
    expect(blockDayNumber(START, START)).toBe(1);
    expect(dayOfWeekNumber(START, START)).toBe(1);
  });

  it("knows when the block has run out", () => {
    expect(isBlockComplete(START, "2026-03-01")).toBe(false);
    expect(isBlockComplete(START, "2026-03-02")).toBe(true);
  });
});

describe("weekRange", () => {
  it("anchors weeks to the block start, not to calendar Mondays", () => {
    // A block starting on a Thursday: week 2 starts on a Thursday too.
    expect(weekRange("2026-01-08", 2).startDate).toBe("2026-01-15");
    expect(weekRange("2026-01-08", 2).endDate).toBe("2026-01-21");
  });

  it("covers exactly seven days per week and 56 across the block", () => {
    const all = Array.from({ length: 8 }, (_, index) => weekRange(START, index + 1));
    expect(all.every((week) => week.dates.length === 7)).toBe(true);
    expect(new Set(all.flatMap((week) => week.dates)).size).toBe(56);
    expect(all[0].startDate).toBe(START);
    expect(all[7].endDate).toBe(blockEndDate(START));
  });

  it("rejects weeks outside 1-8", () => {
    expect(() => weekRange(START, 0)).toThrow(RangeError);
    expect(() => weekRange(START, 9)).toThrow(RangeError);
    expect(() => weekRange(START, 1.5)).toThrow(RangeError);
  });
});

describe("weekNumberFor", () => {
  it("puts each week boundary on the right side", () => {
    expect(weekNumberFor(START, "2026-01-05")).toBe(1);
    expect(weekNumberFor(START, "2026-01-11")).toBe(1); // day 7
    expect(weekNumberFor(START, "2026-01-12")).toBe(2); // day 8
    expect(weekNumberFor(START, "2026-02-23")).toBe(8); // day 50
    expect(weekNumberFor(START, "2026-03-01")).toBe(8); // day 56
  });

  it("returns null outside the block rather than clamping", () => {
    expect(weekNumberFor(START, "2026-01-04")).toBeNull();
    expect(weekNumberFor(START, "2026-03-02")).toBeNull();
    expect(weekNumberFor(START, "2025-01-05")).toBeNull();
  });

  it("handles a block that spans a year end and a leap day", () => {
    expect(weekNumberFor("2023-12-25", "2024-01-01")).toBe(2);
    expect(weekNumberFor("2024-02-26", "2024-02-29")).toBe(1);
    expect(weekNumberFor("2024-02-26", "2024-03-04")).toBe(2);
  });
});

describe("entriesForWeek", () => {
  it("takes only the seven days of the week, sorted", () => {
    const entries = [entry("2026-01-13"), entry("2026-01-11"), entry("2026-01-12"), entry("2026-01-19")];
    const week2 = entriesForWeek(entries, START, 2);
    expect(week2.map((item) => item.entryDate)).toEqual(["2026-01-12", "2026-01-13"]);
  });

  it("splits the demo block into eight weeks of seven", () => {
    const entries = demoDailyEntries();
    for (let week = 1; week <= 8; week += 1) {
      expect(entriesForWeek(entries, DEMO_BLOCK_START, week)).toHaveLength(7);
    }
  });
});

describe("daysElapsedInWeek", () => {
  it("reports a partial week as partial and never more than seven", () => {
    expect(daysElapsedInWeek(START, 1, "2026-01-06")).toBe(2);
    expect(daysElapsedInWeek(START, 1, "2026-01-11")).toBe(7);
    expect(daysElapsedInWeek(START, 1, "2026-02-01")).toBe(7);
  });

  it("is zero for a week that has not started", () => {
    expect(daysElapsedInWeek(START, 3, "2026-01-06")).toBe(0);
  });
});
