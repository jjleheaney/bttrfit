import { describe, expect, it } from "vitest";
import { contactSheet, type SheetRowKey } from "./contact-sheet";
import { DEMO_BLOCK, demoDailyEntries } from "./fixtures";
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

function row(rows: ReturnType<typeof contactSheet>, key: SheetRowKey) {
  const found = rows.find((candidate) => candidate.key === key);
  if (!found) throw new Error(`no ${key} row`);
  return found;
}

describe("contactSheet", () => {
  it("is six metric rows of seven days, in the check-in's order", () => {
    const rows = contactSheet([], BLOCK, 1, "2026-01-05");
    expect(rows.map((sheetRow) => sheetRow.key)).toEqual([
      "weight",
      "protein",
      "workouts",
      "sleep",
      "steps",
      "drinks",
    ]);
    expect(rows.every((sheetRow) => sheetRow.cells.length === 7)).toBe(true);
    expect(rows[0].cells.map((cell) => cell.date)).toEqual([
      "2026-01-05",
      "2026-01-06",
      "2026-01-07",
      "2026-01-08",
      "2026-01-09",
      "2026-01-10",
      "2026-01-11",
    ]);
  });

  it("separates a missed day from an unanswered one and from a day still to come", () => {
    const entries = [
      entry({ entryDate: "2026-01-05", proteinHit: true }),
      entry({ entryDate: "2026-01-06", proteinHit: false }),
      entry({ entryDate: "2026-01-07", drinks: 0 }),
    ];
    const protein = row(contactSheet(entries, BLOCK, 1, "2026-01-08"), "protein");

    expect(protein.cells.map((cell) => cell.state)).toEqual([
      "hit",
      "miss",
      "unanswered",
      "unanswered",
      "future",
      "future",
      "future",
    ]);
  });

  it("never reads a day that has not happened as a miss, including today", () => {
    const rows = contactSheet([], BLOCK, 1, "2026-01-07");
    for (const sheetRow of rows) {
      expect(sheetRow.cells.map((cell) => cell.state)).toEqual([
        "unanswered",
        "unanswered",
        "unanswered",
        "future",
        "future",
        "future",
        "future",
      ]);
      expect(sheetRow.cells.some((cell) => cell.state === "miss")).toBe(false);
    }
  });

  it("prints the day's weight to one decimal in the cell", () => {
    const entries = [
      entry({ entryDate: "2026-01-05", weight: 96 }),
      entry({ entryDate: "2026-01-06", weight: 95.04 }),
    ];
    const weight = row(contactSheet(entries, BLOCK, 1, "2026-01-07"), "weight");

    expect(weight.cells.map((cell) => cell.value)).toEqual([
      "96.0",
      "95.0",
      null,
      null,
      null,
      null,
      null,
    ]);
    expect(weight.cells[0].label).toBe("96.0");
    // A weigh-in is never a pass or a fail, so it stays out of miss/over.
    expect(weight.cells[0].state).toBe("hit");
  });

  it("counts a logged zero as an answer rather than an empty square", () => {
    const drinks = row(
      contactSheet([entry({ entryDate: "2026-01-05", drinks: 0 })], BLOCK, 1, "2026-01-05"),
      "drinks",
    );
    expect(drinks.cells[0].state).toBe("hit");
    expect(drinks.cells[0].value).toBe("0");
    expect(drinks.cells[0].label).toContain("0 drinks");
  });

  it("goes over on the day the week's target is passed, and stays over", () => {
    // Target is three: two on Monday is inside it, two more on Tuesday is not,
    // and Wednesday being dry does not put the week back inside it.
    const entries = [
      entry({ entryDate: "2026-01-05", drinks: 2 }),
      entry({ entryDate: "2026-01-06", drinks: 2 }),
      entry({ entryDate: "2026-01-07", drinks: 0 }),
    ];
    const drinks = row(contactSheet(entries, BLOCK, 1, "2026-01-07"), "drinks");

    expect(drinks.cells.slice(0, 3).map((cell) => cell.state)).toEqual(["hit", "over", "over"]);
    expect(drinks.cells.map((cell) => cell.value).slice(0, 3)).toEqual(["2", "2", "0"]);
    expect(drinks.cells[1].label).toBe("2 drinks, 4 of 3 this week: over");
    expect(drinks.cells[2].label).toBe("0 drinks, 4 of 3 this week: over");
  });

  it("is exactly at the target, not over it, when the target is spent", () => {
    const drinks = row(
      contactSheet([entry({ entryDate: "2026-01-05", drinks: 3 })], BLOCK, 1, "2026-01-05"),
      "drinks",
    );
    expect(drinks.cells[0].state).toBe("hit");
  });

  it("treats any drink as over when the target is none", () => {
    const teetotal = { ...BLOCK, weeklyDrinksTarget: 0 };
    const drinks = row(
      contactSheet(
        [
          entry({ entryDate: "2026-01-05", drinks: 0 }),
          entry({ entryDate: "2026-01-06", drinks: 1 }),
        ],
        teetotal,
        1,
        "2026-01-06",
      ),
      "drinks",
    );
    expect(drinks.cells.slice(0, 2).map((cell) => cell.state)).toEqual(["hit", "over"]);
  });

  it("counts only the week it is drawing, not the drinks of earlier weeks", () => {
    const entries = [
      entry({ entryDate: "2026-01-05", drinks: 4 }),
      entry({ entryDate: "2026-01-12", drinks: 1 }),
    ];
    const secondWeek = row(contactSheet(entries, BLOCK, 2, "2026-01-12"), "drinks");
    expect(secondWeek.cells[0].state).toBe("hit");
    expect(secondWeek.cells[0].label).toBe("1 drink, 1 of 3 this week");
  });

  it("labels every cell for a screen reader rather than relying on colour", () => {
    const rows = contactSheet(demoDailyEntries(), DEMO_BLOCK, 6, "2026-03-01");
    for (const sheetRow of rows) {
      for (const cell of sheetRow.cells) {
        expect(cell.label.length).toBeGreaterThan(0);
      }
    }
  });

  it("reads a mid-block week of the demo fixture as fully logged", () => {
    const rows = contactSheet(demoDailyEntries(), DEMO_BLOCK, 3, "2026-03-01");
    expect(
      rows.every((sheetRow) =>
        sheetRow.cells.every(
          (cell) => cell.state === "hit" || cell.state === "miss" || cell.state === "over",
        ),
      ),
    ).toBe(true);
  });

  it("prints a number only on the rows that measure one", () => {
    const rows = contactSheet(demoDailyEntries(), DEMO_BLOCK, 3, "2026-03-01");
    for (const sheetRow of rows) {
      const measured = sheetRow.key === "weight" || sheetRow.key === "drinks";
      for (const cell of sheetRow.cells) {
        expect(cell.value === null).toBe(!measured);
      }
    }
  });
});
