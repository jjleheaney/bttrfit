import { describe, expect, it } from "vitest";
import { recompVerdict } from "./verdict";
import type { LiftStatus } from "./lifts";

function key(weeklyDelta: number | null, liftStatuses: (LiftStatus | null)[]) {
  return recompVerdict({ weeklyDelta, liftStatuses }).key;
}

const THREE_IMPROVED: LiftStatus[] = ["improved", "improved", "improved"];

describe("recompVerdict: every row of the table", () => {
  it("down 0.2kg or more with 2+ improved or maintained is recomping", () => {
    expect(key(-0.2, ["improved", "maintained", "declined"])).toBe("recomping");
    expect(key(-1.4, ["maintained", "maintained", "declined"])).toBe("recomping");
    expect(key(-0.6, THREE_IMPROVED)).toBe("recomping");
  });

  it("down 0.2kg or more with 2+ declined is losing more than fat", () => {
    expect(key(-0.2, ["declined", "declined", "improved"])).toBe("losing_more_than_fat");
    expect(key(-1.1, ["declined", "declined", "declined"])).toBe("losing_more_than_fat");
  });

  it("flat with 2+ improved is recomping slowly", () => {
    expect(key(0, ["improved", "improved", "declined"])).toBe("recomping_slowly");
    expect(key(0.19, THREE_IMPROVED)).toBe("recomping_slowly");
    expect(key(-0.19, ["improved", "improved", "maintained"])).toBe("recomping_slowly");
  });

  it("flat with 2+ maintained or declined is holding", () => {
    expect(key(0, ["maintained", "maintained", "improved"])).toBe("holding");
    expect(key(0.1, ["declined", "maintained", "improved"])).toBe("holding");
    expect(key(-0.05, ["declined", "declined", "declined"])).toBe("holding");
  });

  it("up 0.2kg or more with 2+ improved is gaining", () => {
    expect(key(0.2, ["improved", "improved", "declined"])).toBe("gaining");
    expect(key(1.2, THREE_IMPROVED)).toBe("gaining");
  });

  it("up 0.2kg or more with 2+ maintained or declined is off track", () => {
    expect(key(0.3, ["maintained", "declined", "improved"])).toBe("off_track");
    expect(key(0.9, ["maintained", "maintained", "maintained"])).toBe("off_track");
  });
});

describe("recompVerdict: the 0.2kg threshold", () => {
  it("treats exactly 0.2 as a direction and anything inside it as flat", () => {
    expect(key(-0.2, THREE_IMPROVED)).toBe("recomping");
    expect(key(-0.199, THREE_IMPROVED)).toBe("recomping_slowly");
    expect(key(0.199, THREE_IMPROVED)).toBe("recomping_slowly");
    expect(key(0.2, THREE_IMPROVED)).toBe("gaining");
  });
});

describe("recompVerdict: when it refuses to answer", () => {
  it("shows baseline week with no previous week of weight, whatever the lifts say", () => {
    const verdict = recompVerdict({ weeklyDelta: null, liftStatuses: THREE_IMPROVED });
    expect(verdict.key).toBe("baseline");
    expect(verdict.conclusive).toBe(false);
  });

  it("says why it cannot answer when no lifts were logged, rather than using weight alone", () => {
    const verdict = recompVerdict({ weeklyDelta: -0.8, liftStatuses: [] });
    expect(verdict.key).toBe("unavailable");
    expect(verdict.conclusive).toBe(false);
    expect(verdict.message).toMatch(/Weight alone cannot tell you/);
  });

  it("needs two comparable lifts, not one", () => {
    expect(key(-0.8, ["improved"])).toBe("unavailable");
    expect(key(-0.8, ["improved", null, null])).toBe("unavailable");
    expect(key(-0.8, ["improved", "improved", null])).toBe("recomping");
  });

  it("ignores lifts with nothing to compare against instead of counting them", () => {
    expect(key(-0.8, ["declined", "declined", null])).toBe("losing_more_than_fat");
  });

  it("says the signals are mixed when the lifts do not agree", () => {
    // Two lifts, one each way: no majority either way on a week weight fell.
    const verdict = recompVerdict({ weeklyDelta: -0.8, liftStatuses: ["improved", "declined"] });
    expect(verdict.key).toBe("mixed");
    expect(verdict.conclusive).toBe(false);
  });

  it("never returns a conclusive verdict it cannot support", () => {
    const refusals = [
      recompVerdict({ weeklyDelta: null, liftStatuses: [] }),
      recompVerdict({ weeklyDelta: -1, liftStatuses: [null, null, null] }),
      recompVerdict({ weeklyDelta: -1, liftStatuses: ["improved", "declined"] }),
    ];
    expect(refusals.every((verdict) => !verdict.conclusive)).toBe(true);
    expect(refusals.every((verdict) => verdict.message.length > 0)).toBe(true);
  });
});

describe("recompVerdict: copy", () => {
  it("uses the message from the brief for the signature verdict", () => {
    const verdict = recompVerdict({ weeklyDelta: -0.6, liftStatuses: THREE_IMPROVED });
    expect(verdict.label).toBe("Recomping");
    expect(verdict.message).toBe(
      "Weight down, strength holding. This is exactly what you are looking for.",
    );
  });

  it("never congratulates on a week the data does not support", () => {
    const offTrack = recompVerdict({
      weeklyDelta: 0.6,
      liftStatuses: ["maintained", "maintained", "declined"],
    });
    expect(offTrack.message).toBe("Weight up, strength flat. Worth reviewing the week honestly.");
  });
});
