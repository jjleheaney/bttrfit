import { describe, expect, it } from "vitest";
import {
  currentStreak,
  isLapsing,
  longestStreak,
  missingDates,
  shouldPromptBackdate,
} from "./streaks";
import { DEMO_BLOCK_START, demoDailyEntries, lapsedEntries } from "./fixtures";
import { addDays } from "./dates";
import type { DailyEntry } from "./types";

const START = "2026-01-05";

function complete(entryDate: string): DailyEntry {
  return {
    entryDate,
    weight: 95,
    proteinHit: true,
    workoutDone: false,
    sleepHit: true,
    stepsHit: false,
    drinks: 0,
  };
}

function partial(entryDate: string): DailyEntry {
  return { ...complete(entryDate), drinks: null };
}

function run(from: string, days: number): DailyEntry[] {
  return Array.from({ length: days }, (_, index) => complete(addDays(from, index)));
}

describe("currentStreak", () => {
  it("counts consecutive complete days ending today", () => {
    expect(currentStreak(run(START, 5), "2026-01-09")).toBe(5);
  });

  it("allows today to be unlogged: the day is not over", () => {
    expect(currentStreak(run(START, 5), "2026-01-10")).toBe(5);
  });

  it("breaks once yesterday is missing too", () => {
    expect(currentStreak(run(START, 5), "2026-01-11")).toBe(0);
  });

  it("counts only fully completed days: a partial day is not a streak day", () => {
    const entries = [...run(START, 3), partial("2026-01-08"), complete("2026-01-09")];
    expect(currentStreak(entries, "2026-01-09")).toBe(1);
  });

  it("is zero with no entries at all", () => {
    expect(currentStreak([], "2026-01-09")).toBe(0);
  });

  it("restarts after a lapse rather than resuming the old count", () => {
    // Six days, three missed, then two more.
    const entries = [...run(START, 6), ...run("2026-01-14", 2)];
    expect(currentStreak(entries, "2026-01-15")).toBe(2);
  });
});

describe("longestStreak", () => {
  it("finds the longest run either side of a lapse", () => {
    const entries = [...run(START, 6), ...run("2026-01-14", 2)];
    expect(longestStreak(entries)).toBe(6);
  });

  it("is unaffected by the order entries arrive in", () => {
    const entries = [...run(START, 4)].reverse();
    expect(longestStreak(entries)).toBe(4);
  });

  it("counts a single complete day as one, and an empty block as zero", () => {
    expect(longestStreak([complete(START)])).toBe(1);
    expect(longestStreak([partial(START)])).toBe(0);
    expect(longestStreak([])).toBe(0);
  });

  it("runs to 56 across the fully logged demo block", () => {
    expect(longestStreak(demoDailyEntries())).toBe(56);
  });
});

describe("isLapsing", () => {
  it("is false at five logged days in the last seven", () => {
    const entries = [START, "2026-01-06", "2026-01-07", "2026-01-08", "2026-01-09"].map(complete);
    expect(isLapsing(entries, "2026-01-11")).toBe(false);
  });

  it("is true at four", () => {
    const entries = [START, "2026-01-06", "2026-01-07", "2026-01-08"].map(complete);
    expect(isLapsing(entries, "2026-01-11")).toBe(true);
  });

  it("counts partially answered days as logged: only the record matters here", () => {
    const entries = [
      complete(START),
      partial("2026-01-06"),
      partial("2026-01-07"),
      partial("2026-01-08"),
      partial("2026-01-09"),
    ];
    expect(isLapsing(entries, "2026-01-11")).toBe(false);
  });

  it("ignores days that have scrolled out of the window", () => {
    const entries = run(START, 7);
    expect(isLapsing(entries, "2026-01-11")).toBe(false);
    expect(isLapsing(entries, "2026-01-16")).toBe(true);
  });
});

describe("missingDates and the backdate prompt", () => {
  it("lists the unlogged days of the last week, oldest first", () => {
    expect(missingDates(lapsedEntries(), DEMO_BLOCK_START, "2026-01-11")).toEqual([
      "2026-01-08",
      "2026-01-09",
      "2026-01-10",
    ]);
  });

  it("never offers days before the block started", () => {
    expect(missingDates([complete(START)], START, "2026-01-07")).toEqual([
      "2026-01-06",
      "2026-01-07",
    ]);
  });

  it("stays quiet for the first two days of a block", () => {
    expect(shouldPromptBackdate([], START, START)).toBe(false);
    expect(shouldPromptBackdate([], START, "2026-01-06")).toBe(false);
    expect(shouldPromptBackdate([], START, "2026-01-07")).toBe(true);
  });

  it("prompts on the lapsed fixture and not on a fully logged block", () => {
    expect(shouldPromptBackdate(lapsedEntries(), DEMO_BLOCK_START, "2026-01-11")).toBe(true);
    expect(shouldPromptBackdate(demoDailyEntries(), DEMO_BLOCK_START, "2026-01-11")).toBe(false);
  });

  it("does not prompt once the block is over", () => {
    expect(shouldPromptBackdate([], START, "2026-03-02")).toBe(false);
  });
});
