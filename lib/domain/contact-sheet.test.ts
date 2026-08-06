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

  it("fills the weight row against the week's own spread, lightest day full", () => {
    const entries = [
      entry({ entryDate: "2026-01-05", weight: 96.0 }),
      entry({ entryDate: "2026-01-06", weight: 95.0 }),
      entry({ entryDate: "2026-01-07", weight: 95.5 }),
    ];
    const weight = row(contactSheet(entries, BLOCK, 1, "2026-01-07"), "weight");

    expect(weight.cells[0].fill).toBe(0);
    expect(weight.cells[1].fill).toBe(1);
    expect(weight.cells[2].fill).toBeCloseTo(0.5, 5);
    expect(weight.cells[0].label).toBe("96.0");
  });

  it("fills a lone weigh-in rather than dividing by a spread of zero", () => {
    const weight = row(
      contactSheet([entry({ entryDate: "2026-01-05", weight: 95.8 })], BLOCK, 1, "2026-01-05"),
      "weight",
    );
    expect(weight.cells[0].fill).toBe(1);
  });

  it("fills the drinks row by the share of the week's allowance a day used", () => {
    const entries = [
      entry({ entryDate: "2026-01-05", drinks: 0 }),
      entry({ entryDate: "2026-01-06", drinks: 1 }),
      entry({ entryDate: "2026-01-07", drinks: 6 }),
    ];
    const drinks = row(contactSheet(entries, BLOCK, 1, "2026-01-07"), "drinks");

    expect(drinks.cells[0].fill).toBe(0);
    expect(drinks.cells[0].state).toBe("hit");
    expect(drinks.cells[1].fill).toBeCloseTo(1 / 3, 5);
    // Six drinks against a target of three is capped, not drawn overflowing.
    expect(drinks.cells[2].fill).toBe(1);
    expect(drinks.cells[1].label).toBe("1 drink");
    expect(drinks.cells[2].label).toBe("6 drinks");
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
        sheetRow.cells.every((cell) => cell.state === "hit" || cell.state === "miss"),
      ),
    ).toBe(true);
  });
});
