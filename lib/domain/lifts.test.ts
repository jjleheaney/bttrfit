import { describe, expect, it } from "vitest";
import { SENTINEL_LIFT_MENU, liftDisplayName } from "./lifts";

describe("sentinel lift menu", () => {
  it("has unique keys", () => {
    const keys = SENTINEL_LIFT_MENU.map((lift) => lift.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("falls back to the raw key when a lift is not on the menu", () => {
    expect(liftDisplayName("back_squat")).toBe("Back squat");
    expect(liftDisplayName("zercher_carry")).toBe("zercher_carry");
  });
});
