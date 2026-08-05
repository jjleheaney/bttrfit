import { describe, expect, it } from "vitest";
import { addDays, compareDates, datesBetween, daysBetween, fromEpochDay, isIsoDate, toEpochDay } from "./dates";

describe("isIsoDate", () => {
  it("accepts well-formed dates", () => {
    expect(isIsoDate("2026-01-05")).toBe(true);
    expect(isIsoDate("2024-02-29")).toBe(true);
  });

  it("rejects impossible dates rather than rolling them forward", () => {
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2025-02-29")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("2026-00-10")).toBe(false);
  });

  it("rejects anything that is not a plain date string", () => {
    expect(isIsoDate("2026-1-5")).toBe(false);
    expect(isIsoDate("2026-01-05T00:00:00Z")).toBe(false);
    expect(isIsoDate(20260105)).toBe(false);
    expect(isIsoDate(null)).toBe(false);
  });
});

describe("date arithmetic", () => {
  it("crosses month, year and leap-day boundaries", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2025-02-28", 1)).toBe("2025-03-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("is unaffected by daylight saving, which is the reason it works in UTC", () => {
    // Clocks go forward in the UK on 2026-03-29 and back on 2026-10-25.
    expect(addDays("2026-03-28", 1)).toBe("2026-03-29");
    expect(addDays("2026-03-29", 1)).toBe("2026-03-30");
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
    expect(daysBetween("2026-10-24", "2026-10-26")).toBe(2);
  });

  it("counts days signed, and zero for the same day", () => {
    expect(daysBetween("2026-01-05", "2026-03-01")).toBe(55);
    expect(daysBetween("2026-03-01", "2026-01-05")).toBe(-55);
    expect(daysBetween("2026-01-05", "2026-01-05")).toBe(0);
  });

  it("round-trips through epoch days", () => {
    expect(fromEpochDay(toEpochDay("2026-01-05"))).toBe("2026-01-05");
    expect(toEpochDay("1970-01-01")).toBe(0);
  });

  it("orders dates", () => {
    expect(compareDates("2026-01-05", "2026-01-06")).toBeLessThan(0);
    expect(compareDates("2026-01-06", "2026-01-05")).toBeGreaterThan(0);
    expect(compareDates("2026-01-05", "2026-01-05")).toBe(0);
  });

  it("lists inclusive ranges, and nothing for a reversed one", () => {
    expect(datesBetween("2026-01-05", "2026-01-07")).toEqual([
      "2026-01-05",
      "2026-01-06",
      "2026-01-07",
    ]);
    expect(datesBetween("2026-01-05", "2026-01-05")).toEqual(["2026-01-05"]);
    expect(datesBetween("2026-01-07", "2026-01-05")).toEqual([]);
  });

  it("refuses to do arithmetic on a malformed date", () => {
    expect(() => addDays("05/01/2026", 1)).toThrow(RangeError);
  });
});
