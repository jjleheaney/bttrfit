import { describe, expect, it } from "vitest";
import { canSwapSentinelLift } from "./settings";
import type { SentinelLift } from "./types";

function lift(weeks: number[]): SentinelLift {
  return {
    slot: 1,
    liftKey: "back_squat",
    displayName: "Back squat",
    entries: weeks.map((weekNumber) => ({ weekNumber, reps: 5, weight: 100 })),
  };
}

describe("canSwapSentinelLift", () => {
  it("allows a swap while only the week 1 baseline exists", () => {
    expect(canSwapSentinelLift(lift([1])).allowed).toBe(true);
  });

  it("allows a swap when even the baseline is missing", () => {
    expect(canSwapSentinelLift(lift([])).allowed).toBe(true);
  });

  it("refuses once a second week gives the lift something to compare", () => {
    const decision = canSwapSentinelLift(lift([1, 2]));
    expect(decision.allowed).toBe(false);
    if (decision.allowed) return;
    expect(decision.reason).toContain("week 2");
  });

  it("names the range when several weeks are behind it", () => {
    const decision = canSwapSentinelLift(lift([1, 2, 3, 5]));
    if (decision.allowed) throw new Error("expected a refusal");
    expect(decision.reason).toContain("weeks 2 to 5");
  });

  it("ignores the order the entries arrive in", () => {
    const decision = canSwapSentinelLift(lift([5, 2, 1]));
    if (decision.allowed) throw new Error("expected a refusal");
    expect(decision.reason).toContain("weeks 2 to 5");
  });
});
