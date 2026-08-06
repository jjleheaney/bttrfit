import { describe, expect, it } from "vitest";
import {
  fromKilograms,
  nextMonday,
  parseDecimal,
  parseInteger,
  parseWeight,
  suggestedProteinTarget,
  toKilograms,
} from "./setup";

describe("units", () => {
  it("round-trips between kg and lbs", () => {
    expect(toKilograms(220, "lbs")).toBeCloseTo(99.79, 2);
    expect(fromKilograms(toKilograms(185, "lbs"), "lbs")).toBeCloseTo(185, 6);
    expect(toKilograms(95.8, "kg")).toBe(95.8);
  });
});

describe("suggestedProteinTarget", () => {
  it("is 1.8g per kg, rounded to the nearest 5g", () => {
    expect(suggestedProteinTarget(95.8, "kg")).toBe(170); // 172.44
    expect(suggestedProteinTarget(80, "kg")).toBe(145); // 144
  });

  it("converts before calculating, so lbs users get a sane number", () => {
    expect(suggestedProteinTarget(211, "lbs")).toBe(suggestedProteinTarget(95.7, "kg"));
  });
});

describe("nextMonday", () => {
  it("is always in the future, and a week away from a Monday", () => {
    expect(nextMonday("2026-01-06")).toBe("2026-01-12"); // Tuesday
    expect(nextMonday("2026-01-11")).toBe("2026-01-12"); // Sunday
    expect(nextMonday("2026-01-05")).toBe("2026-01-12"); // Monday: not today
  });

  it("crosses a month and a year end", () => {
    expect(nextMonday("2026-01-30")).toBe("2026-02-02");
    expect(nextMonday("2026-12-30")).toBe("2027-01-04");
  });
});

describe("parseWeight", () => {
  it("accepts a comma as a decimal separator", () => {
    expect(parseWeight("95,8", "kg")).toEqual({ value: 95.8 });
  });

  it("keeps one decimal", () => {
    expect(parseWeight("95.849", "kg")).toEqual({ value: 95.8 });
  });

  it("rejects blanks, words and impossible weights with a plain message", () => {
    expect(parseWeight("", "kg")).toEqual({ error: "Enter a weight." });
    expect(parseWeight("heavy", "kg")).toEqual({ error: "Enter a weight." });
    expect(parseWeight("9", "kg")).toEqual({ error: "Enter a weight in kg." });
    expect(parseWeight("900", "kg")).toEqual({ error: "Enter a weight in kg." });
  });

  it("applies the bounds in kilograms, whatever the user is typing in", () => {
    // 100lbs is 45kg: light, but a real weight.
    expect(parseWeight("100", "lbs")).toEqual({ value: 100 });
    expect(parseWeight("50", "lbs")).toEqual({ error: "Enter a weight in lbs." });
  });
});

describe("parseInteger", () => {
  const bounds = { min: 0, max: 30, label: "Drinks" };

  it("accepts a whole number in range, including the edges", () => {
    expect(parseInteger("0", bounds)).toEqual({ value: 0 });
    expect(parseInteger("30", bounds)).toEqual({ value: 30 });
  });

  it("names the field in the error, so the message is useful on its own", () => {
    expect(parseInteger("2.5", bounds)).toEqual({ error: "Drinks must be a whole number." });
    expect(parseInteger("", bounds)).toEqual({ error: "Drinks must be a whole number." });
    expect(parseInteger("31", bounds)).toEqual({ error: "Drinks must be between 0 and 30." });
  });
});

describe("parseDecimal", () => {
  const bar = { min: 1, max: 1000, label: "Weight" };

  it("takes the fractional plate weights people actually load", () => {
    expect(parseDecimal("102.5", bar)).toEqual({ value: 102.5 });
    expect(parseDecimal("102,5", bar)).toEqual({ value: 102.5 });
    expect(parseDecimal(" 60 ", bar)).toEqual({ value: 60 });
  });

  it("rounds to a single decimal, since bars are not weighed to the gram", () => {
    expect(parseDecimal("102.54", bar)).toEqual({ value: 102.5 });
  });

  it("rejects blanks, nonsense and out-of-range loads", () => {
    expect(parseDecimal("", bar)).toEqual({ error: "Enter weight." });
    expect(parseDecimal("heavy", bar)).toEqual({ error: "Enter weight." });
    expect(parseDecimal("0", bar)).toEqual({ error: "Weight must be between 1 and 1000." });
    expect(parseDecimal("1001", bar)).toEqual({ error: "Weight must be between 1 and 1000." });
  });
});
