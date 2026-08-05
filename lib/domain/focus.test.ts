import { describe, expect, it } from "vitest";
import { FOCUS_COPY, FOCUS_PRIORITY, weeklyFocus } from "./focus";
import { weeklyCompliance, type WeeklyCompliance } from "./compliance";
import { DEMO_BLOCK, demoDailyEntries } from "./fixtures";

function compliance(overrides: Partial<WeeklyCompliance> = {}): WeeklyCompliance {
  return {
    weekNumber: 2,
    daysLogged: 7,
    protein: { days: 7, answered: 7, rate: 1, answeredRate: 1 },
    sleep: { days: 7, answered: 7, rate: 1, answeredRate: 1 },
    steps: { days: 7, answered: 7, rate: 1, answeredRate: 1 },
    workoutsCompleted: 4,
    workoutsAnswered: 7,
    totalDrinks: 0,
    weeklyDrinksTarget: 3,
    drinksTargetMet: true,
    ...overrides,
  };
}

function metric(overrides: Partial<WeeklyCompliance>) {
  return weeklyFocus(compliance(overrides))?.metric;
}

describe("weeklyFocus", () => {
  it("names exactly one metric, never a list", () => {
    const focus = weeklyFocus(
      compliance({ steps: { days: 2, answered: 7, rate: 2 / 7, answeredRate: 2 / 7 } }),
    );
    expect(focus).toEqual({ metric: "steps", rate: 2 / 7, copy: FOCUS_COPY.steps });
  });

  it("picks the lowest-compliance metric", () => {
    expect(metric({ sleep: { days: 3, answered: 7, rate: 3 / 7, answeredRate: 3 / 7 } })).toBe(
      "sleep",
    );
    expect(
      metric({
        protein: { days: 1, answered: 7, rate: 1 / 7, answeredRate: 1 / 7 },
        sleep: { days: 3, answered: 7, rate: 3 / 7, answeredRate: 3 / 7 },
      }),
    ).toBe("protein");
    expect(metric({ workoutsCompleted: 0 })).toBe("workouts");
    expect(metric({ totalDrinks: 12, drinksTargetMet: false })).toBe("alcohol");
  });

  it("breaks ties towards protein, then steps, then sleep, then workouts, then alcohol", () => {
    const half = { days: 3, answered: 6, rate: 0.5, answeredRate: 0.5 };
    expect(metric({ protein: half, steps: half, sleep: half })).toBe("protein");
    expect(metric({ steps: half, sleep: half })).toBe("steps");
    expect(metric({ sleep: half, workoutsCompleted: 2 })).toBe("sleep");
    expect(FOCUS_PRIORITY).toEqual(["protein", "steps", "sleep", "workouts", "alcohol"]);
  });

  it("treats being at the drinks target as full marks, and scales the overshoot", () => {
    expect(metric({ totalDrinks: 3, drinksTargetMet: true })).toBe("protein"); // nothing is low
    const sleep = { days: 4, answered: 7, rate: 4 / 7, answeredRate: 4 / 7 };
    // Six against a target of three scores 0.5, below the 0.57 sleep week.
    expect(metric({ totalDrinks: 6, drinksTargetMet: false, sleep })).toBe("alcohol");
    // Four against three scores 0.75, above it.
    expect(metric({ totalDrinks: 4, drinksTargetMet: false, sleep })).toBe("sleep");
  });

  it("scales the workout count against the days it was answered, not against seven", () => {
    // Two sessions in the two days answered is not a training frequency problem.
    expect(
      weeklyFocus(compliance({ daysLogged: 2, workoutsAnswered: 2, workoutsCompleted: 2 }))
        ?.metric,
    ).not.toBe("workouts");
    expect(weeklyFocus(compliance({ workoutsCompleted: 1 }))?.metric).toBe("workouts");
  });

  it("does not read a training question that was never answered as no training", () => {
    expect(
      weeklyFocus(compliance({ workoutsAnswered: 0, workoutsCompleted: 0 }))?.metric,
    ).not.toBe("workouts");
  });

  it("judges a half-answered metric on the days it was answered", () => {
    // Protein answered on three days of seven and hit on all three: nothing to fix,
    // even though days / daysLogged reads 3/7.
    const week = compliance({
      protein: { days: 3, answered: 3, rate: 3 / 7, answeredRate: 1 },
      sleep: { days: 4, answered: 7, rate: 4 / 7, answeredRate: 4 / 7 },
    });
    expect(weeklyFocus(week)?.metric).toBe("sleep");
  });

  it("has nothing to recommend for a week with nothing logged", () => {
    expect(weeklyFocus(compliance({ daysLogged: 0 }))).toBeNull();
  });

  it("does not treat an unanswered metric as a failure", () => {
    // A week where only drinks were ever answered: rates are null, not zero.
    const empty = { days: 0, answered: 0, rate: null, answeredRate: null };
    const week = compliance({
      daysLogged: 3,
      protein: empty,
      sleep: empty,
      steps: empty,
      workoutsAnswered: 0,
      workoutsCompleted: 0,
      totalDrinks: 9,
      drinksTargetMet: false,
    });
    expect(weeklyFocus(week)?.metric).toBe("alcohol");
  });

  it("names steps in the demo block's worst step week and sleep in its worst sleep week", () => {
    const entries = demoDailyEntries();
    expect(weeklyFocus(weeklyCompliance(entries, DEMO_BLOCK, 6))?.metric).toBe("steps");
    expect(weeklyFocus(weeklyCompliance(entries, DEMO_BLOCK, 3))?.metric).toBe("sleep");
  });

  it("has fixed copy for every metric, with no interpolation", () => {
    for (const key of FOCUS_PRIORITY) {
      expect(FOCUS_COPY[key]).toMatch(/next week/);
      expect(FOCUS_COPY[key]).not.toMatch(/[{}$]/);
    }
  });
});
