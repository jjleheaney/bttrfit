import { describe, expect, it } from "vitest";
import { dailyEntriesCsv, liftEntriesCsv, toCsv, type ExportBlock } from "./export";
import type { DailyEntry } from "./types";

function entry(overrides: Partial<DailyEntry> & { entryDate: string }): DailyEntry {
  return {
    weight: null,
    proteinHit: null,
    workoutDone: null,
    sleepHit: null,
    stepsHit: null,
    drinks: null,
    notes: null,
    ...overrides,
  };
}

const block: ExportBlock = {
  blockNumber: 1,
  startDate: "2026-01-05",
  entries: [
    entry({
      entryDate: "2026-01-05",
      weight: 95.8,
      proteinHit: true,
      workoutDone: false,
      drinks: 2,
      notes: "felt strong",
    }),
    entry({ entryDate: "2026-01-12", weight: 95.1, sleepHit: true }),
    entry({ entryDate: "2026-01-13", stepsHit: true }),
  ],
  lifts: [
    {
      slot: 1,
      liftKey: "back_squat",
      displayName: "Back squat",
      entries: [{ weekNumber: 1, reps: 5, weight: 100 }],
    },
  ],
};

describe("toCsv", () => {
  it("quotes only the cells that need it", () => {
    const csv = toCsv(["a", "b"], [["plain", "has,comma"]]);
    expect(csv).toBe('a,b\r\nplain,"has,comma"\r\n');
  });

  it("escapes embedded quotes by doubling them", () => {
    expect(toCsv(["note"], [['he said "go"']])).toBe('note\r\n"he said ""go"""\r\n');
  });

  it("keeps a newline inside a cell from becoming a new row", () => {
    const csv = toCsv(["note", "n"], [["line one\nline two", 1]]);
    expect(csv).toBe('note,n\r\n"line one\nline two",1\r\n');
    // Three physical lines, but only two records.
    expect(csv.trimEnd().split("\r\n")).toHaveLength(2);
  });

  it("defuses a note a spreadsheet would run as a formula", () => {
    // Quoted because of the tab, and the tab is what stops Excel evaluating it.
    expect(toCsv(["note"], [["=1+1"]])).toBe('note\r\n"\t=1+1"\r\n');
    expect(toCsv(["note"], [["@SUM(A1)"]])).toBe('note\r\n"\t@SUM(A1)"\r\n');
  });

  it("leaves a negative number as a number rather than defusing it", () => {
    expect(toCsv(["change"], [[-2.8]])).toBe("change\r\n-2.8\r\n");
  });

  it("writes a header even with no rows, so the file is still parseable", () => {
    expect(toCsv(["a", "b"], [])).toBe("a,b\r\n");
  });
});

describe("dailyEntriesCsv", () => {
  const csv = dailyEntriesCsv([block], "kg");
  const [header, ...rows] = csv.trimEnd().split("\r\n");

  it("labels each row with the block and the week it fell in", () => {
    expect(header.startsWith("block,week,date")).toBe(true);
    expect(rows[0].startsWith("1,1,2026-01-05")).toBe(true);
    expect(rows[1].startsWith("1,2,2026-01-12")).toBe(true);
  });

  it("writes booleans as yes/no and leaves unanswered metrics empty", () => {
    // protein answered yes, workout answered no, sleep and steps never answered.
    expect(rows[0]).toBe("1,1,2026-01-05,95.8,kg,yes,no,,,2,felt strong");
  });

  it("does not claim a unit for a day with no weigh-in", () => {
    expect(rows[2]).toBe("1,2,2026-01-13,,,,,,yes,,");
  });
});

describe("liftEntriesCsv", () => {
  it("carries the same Epley estimate the app compares week to week", () => {
    const rows = liftEntriesCsv([block], "kg").trimEnd().split("\r\n");
    // 100 x 5 → 100 * (1 + 5/30) = 116.666… → 116.7
    expect(rows[1]).toBe("1,1,1,Back squat,5,100,kg,116.7");
  });

  it("emits only a header when nothing has been logged", () => {
    const empty = liftEntriesCsv([{ ...block, lifts: [] }], "kg");
    expect(empty.trimEnd().split("\r\n")).toHaveLength(1);
  });
});
