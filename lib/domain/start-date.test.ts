import { describe, expect, it } from "vitest";
import { MAX_START_DATE_DAYS_AHEAD, planStartDateMove, startDateWindow } from "./start-date";
import { addDays } from "./dates";
import type { IsoDate } from "./types";

const TODAY: IsoDate = "2026-03-01";
const START: IsoDate = "2026-02-20";

function move(newStartDate: IsoDate, loggedDates: IsoDate[] = [], today: IsoDate = TODAY) {
  return planStartDateMove({ newStartDate, today, loggedDates });
}

function reason(decision: ReturnType<typeof move>): string {
  if (decision.allowed) throw new Error("expected a refusal");
  return decision.reason;
}

describe("planStartDateMove", () => {
  it("returns the end date the block will have, 56 days inclusive", () => {
    const decision = move("2026-02-25");
    if (!decision.allowed) throw new Error(decision.reason);
    expect(decision).toEqual({ allowed: true, startDate: "2026-02-25", endDate: "2026-04-21" });
  });

  it("allows the date the block already starts on", () => {
    expect(move(START, [START, TODAY]).allowed).toBe(true);
  });

  it("allows a move that still covers every logged day", () => {
    // Logged on the 24th onwards, so the block may start any time up to the 24th.
    expect(move("2026-02-24", ["2026-02-24", "2026-02-28"]).allowed).toBe(true);
  });

  it("refuses a move that would strand a logged day, naming that day", () => {
    const text = reason(move("2026-02-25", ["2026-02-24", "2026-02-28"]));
    expect(text).toContain("2026-02-24");
    expect(text).toContain("latest start date");
  });

  it("names the last logged day when a backward move would end before it", () => {
    // A day logged on the 28th needs the block to still reach it: start + 55.
    // Only a day logged ahead of today binds tighter than "the block covers
    // today" — a check-in filed from a zone a day ahead of the server's.
    const earliest = addDays("2026-02-28", -55);
    const text = reason(move(addDays(earliest, -1), ["2026-02-21", "2026-02-28"], "2026-02-25"));
    expect(text).toContain("2026-02-28");
    expect(text).toContain(earliest);
  });

  it("allows the backward move that lands exactly on the last logged day's limit", () => {
    const earliest = addDays("2026-02-28", -55);
    expect(move(earliest, ["2026-02-28"], "2026-02-28").allowed).toBe(true);
  });

  it("refuses a move whose block would already be over, and says what is earliest", () => {
    const earliest = addDays(TODAY, -55);
    const text = reason(move(addDays(earliest, -1)));
    expect(text).toContain("already past");
    expect(text).toContain(earliest);
  });

  it("allows a move that leaves today as the block's very last day", () => {
    expect(move(addDays(TODAY, -55)).allowed).toBe(true);
  });

  it("allows a move up to the forward bound and refuses the day past it", () => {
    expect(move(addDays(TODAY, MAX_START_DATE_DAYS_AHEAD)).allowed).toBe(true);
    expect(reason(move(addDays(TODAY, MAX_START_DATE_DAYS_AHEAD + 1)))).toContain(
      `${MAX_START_DATE_DAYS_AHEAD} days`,
    );
  });

  it("refuses days that would overlap another block, naming it", () => {
    const decision = planStartDateMove({
      newStartDate: "2026-02-10",
      today: TODAY,
      loggedDates: [],
      otherBlocks: [{ blockNumber: 1, startDate: "2025-12-20", endDate: "2026-02-13" }],
    });
    const text = reason(decision);
    expect(text).toContain("block 1");
    expect(text).toContain("2026-02-14");
  });

  it("allows a block that starts the day after another one ended", () => {
    expect(
      planStartDateMove({
        newStartDate: "2026-02-14",
        today: TODAY,
        loggedDates: [],
        otherBlocks: [{ blockNumber: 1, startDate: "2025-12-20", endDate: "2026-02-13" }],
      }).allowed,
    ).toBe(true);
  });

  it("formats the dates in the refusal when a formatter is given", () => {
    const decision = planStartDateMove({
      newStartDate: "2026-02-25",
      today: TODAY,
      loggedDates: ["2026-02-24"],
      formatDate: () => "Tuesday 24 February",
    });
    expect(reason(decision)).toContain("Tuesday 24 February");
  });

  it("ignores the order logged dates arrive in", () => {
    const text = reason(move("2026-02-25", ["2026-02-28", "2026-02-24"]));
    expect(text).toContain("2026-02-24");
  });
});

describe("startDateWindow", () => {
  it("is bounded by today when nothing has been logged", () => {
    expect(startDateWindow({ today: TODAY, loggedDates: [] })).toEqual({
      earliest: addDays(TODAY, -55),
      latest: addDays(TODAY, MAX_START_DATE_DAYS_AHEAD),
    });
  });

  it("closes to the first and last logged day once check-ins exist", () => {
    expect(
      startDateWindow({ today: TODAY, loggedDates: ["2026-02-21", "2026-02-28"] }),
    ).toEqual({ earliest: addDays(TODAY, -55), latest: "2026-02-21" });
  });

  it("keeps the block reaching a logged day that is later than today", () => {
    // A day logged ahead of today (a traveller crossing a date line) still has to
    // stay inside the block.
    const later = addDays(TODAY, 3);
    expect(startDateWindow({ today: TODAY, loggedDates: [later] })).toEqual({
      earliest: addDays(later, -55),
      latest: later,
    });
  });

  it("every date in the window is accepted, and the days either side are not", () => {
    const loggedDates = ["2026-02-24", "2026-02-28"];
    const { earliest, latest } = startDateWindow({ today: TODAY, loggedDates });

    expect(move(earliest, loggedDates).allowed).toBe(true);
    expect(move(latest, loggedDates).allowed).toBe(true);
    expect(move(addDays(earliest, -1), loggedDates).allowed).toBe(false);
    expect(move(addDays(latest, 1), loggedDates).allowed).toBe(false);
  });
});
