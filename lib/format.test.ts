import { describe, expect, it } from "vitest";
import { formatDay, formatDelta, formatLongDay, formatRate, formatWeight } from "./format";

describe("formatDay", () => {
  it("renders a weekday and date with a single space and no comma", () => {
    // The separator is the point: a comma here on one ICU build and not another
    // is a hydration mismatch on the busiest screen in the app.
    expect(formatDay("2026-08-06")).toBe("Thu 6 Aug");
    expect(formatLongDay("2026-08-06")).toBe("Thursday 6 August");
  });

  it("names the calendar day itself rather than shifting it into a zone", () => {
    expect(formatDay("2026-01-01")).toBe("Thu 1 Jan");
    expect(formatDay("2026-12-31")).toBe("Thu 31 Dec");
  });
});

describe("the number formats", () => {
  it("keeps one decimal on a weight", () => {
    expect(formatWeight(95, "kg")).toBe("95.0kg");
  });

  it("shows a dash rather than 0% for a rate nobody has earned yet", () => {
    expect(formatRate(null)).toBe("—");
    expect(formatRate(0.666)).toBe("67%");
  });

  it("signs a change, and calls a rounding-error change no change at all", () => {
    expect(formatDelta(-1.24, "kg")).toBe("−1.2kg");
    expect(formatDelta(0.4, "kg")).toBe("+0.4kg");
    expect(formatDelta(0.04, "kg")).toBe("0.0kg");
  });
});
