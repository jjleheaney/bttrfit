import { addDays } from "./dates";
import { DAYS_PER_WEEK, WEEKS_PER_BLOCK } from "./weeks";
import type { Block, DailyEntry, SentinelLift } from "./types";

/**
 * Deterministic datasets used by the tests and, later, by the seed script. Kept
 * in the domain layer so both read from one definition and the fixture cannot
 * drift from what the logic is verified against.
 *
 * The eight week block is built to exercise every branch of the verdict table,
 * including the two that refuse to answer.
 */

export const DEMO_BLOCK_START = "2026-01-05";

export const DEMO_BLOCK: Block = {
  startDate: DEMO_BLOCK_START,
  startingWeight: 95.8,
  proteinTargetG: 170,
  weeklyDrinksTarget: 3,
};

/**
 * Target week averages, chosen so the eight weeks walk every row of the verdict
 * table in turn: down, down, flat, up, up, flat, down.
 */
const WEEK_AVERAGE_TARGETS = [95.6, 94.6, 93.6, 93.6, 94.0, 94.3, 94.3, 93.0];

/** Fixed daily noise around the week average, summing to zero so the week's mean
 * lands exactly on target. Daily weight is noisy; that is the lesson. */
const DAILY_NOISE = [0.3, -0.2, 0.1, 0.0, 0.4, -0.3, -0.3];

/** ~80% protein compliance across the block, worst in week 6, which is the week
 * the drinking is: the metrics fail together, as they do in life. */
const PROTEIN = [
  [true, true, true, true, true, false, true],
  [true, true, true, true, true, true, false],
  [true, true, false, true, true, true, true],
  [true, true, true, true, false, true, true],
  [true, true, true, false, true, true, true],
  [false, true, false, true, false, true, false],
  [true, true, true, true, true, true, true],
  [true, true, false, true, true, true, true],
];

/** Three to four sessions a week. */
const WORKOUTS = [
  [true, false, true, false, true, false, true],
  [true, false, true, true, false, true, false],
  [true, false, true, false, true, false, false],
  [true, true, false, true, false, true, false],
  [true, false, false, true, false, true, false],
  [true, false, true, false, true, true, false],
  [true, false, true, true, false, true, false],
  [true, false, true, false, true, false, true],
];

/** Patchy, as step compliance always is. */
const STEPS = [
  [true, true, false, true, false, false, true],
  [true, false, true, false, true, false, false],
  [true, true, false, true, true, true, false],
  [true, true, true, false, false, true, false],
  [true, false, true, true, false, true, false],
  [false, false, false, true, false, false, false],
  [true, true, false, true, true, false, true],
  [true, false, true, false, true, true, false],
];

const SLEEP = [
  [true, true, true, false, true, true, false],
  [true, true, false, true, true, true, true],
  [true, false, true, false, false, true, true],
  [true, true, true, true, true, false, true],
  [true, true, true, false, true, true, true],
  [false, true, false, false, true, false, true],
  [true, true, true, true, false, true, true],
  [true, false, true, true, true, true, true],
];

/** Week 6 is the heavy week: eight drinks against a target of three. */
const DRINKS = [
  [0, 0, 2, 0, 0, 1, 0],
  [0, 0, 0, 0, 2, 0, 0],
  [0, 1, 0, 0, 0, 2, 0],
  [0, 0, 0, 0, 3, 0, 0],
  [0, 0, 0, 0, 2, 0, 0],
  [1, 0, 2, 0, 3, 0, 2],
  [0, 0, 0, 1, 0, 0, 0],
  [0, 0, 0, 0, 2, 0, 0],
];

const NOTES: Record<number, string> = {
  // Block day (1-56).
  38: "Wedding weekend. Wrote it down honestly.",
  44: "Back to it. Shoulder felt fine on press.",
};

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * A complete eight week block: 56 fully answered days, weight drifting from 95.8
 * to roughly 93.0 with realistic noise.
 */
export function demoDailyEntries(): DailyEntry[] {
  const entries: DailyEntry[] = [];

  for (let week = 0; week < WEEKS_PER_BLOCK; week += 1) {
    for (let day = 0; day < DAYS_PER_WEEK; day += 1) {
      const blockDay = week * DAYS_PER_WEEK + day + 1;
      entries.push({
        entryDate: addDays(DEMO_BLOCK_START, blockDay - 1),
        weight: round1(WEEK_AVERAGE_TARGETS[week] + DAILY_NOISE[day]),
        proteinHit: PROTEIN[week][day],
        workoutDone: WORKOUTS[week][day],
        sleepHit: SLEEP[week][day],
        stepsHit: STEPS[week][day],
        drinks: DRINKS[week][day],
        notes: NOTES[blockDay] ?? null,
      });
    }
  }

  return entries;
}

/**
 * Three sentinel lifts across eight weeks. Reps deliberately move between weeks
 * so the tests compare across rep ranges rather than only across load, and the
 * row declines mid-block: a block where everything improves proves nothing.
 *
 * Week 8 omits the row entirely, which is what leaves that week's verdict
 * dependent on two lifts rather than three.
 */
export function demoSentinelLifts(): SentinelLift[] {
  return [
    {
      slot: 1,
      liftKey: "bench_press",
      displayName: "Bench press",
      entries: [
        { weekNumber: 1, reps: 6, weight: 80 },
        { weekNumber: 2, reps: 6, weight: 85 },
        { weekNumber: 3, reps: 6, weight: 82.5 },
        { weekNumber: 4, reps: 8, weight: 82.5 },
        { weekNumber: 5, reps: 8, weight: 85 },
        { weekNumber: 6, reps: 6, weight: 85 },
        { weekNumber: 7, reps: 6, weight: 85 },
        { weekNumber: 8, reps: 5, weight: 90 },
      ],
    },
    {
      slot: 2,
      liftKey: "back_squat",
      displayName: "Back squat",
      entries: [
        { weekNumber: 1, reps: 5, weight: 110 },
        { weekNumber: 2, reps: 5, weight: 115 },
        { weekNumber: 3, reps: 5, weight: 110 },
        { weekNumber: 4, reps: 5, weight: 115 },
        { weekNumber: 5, reps: 5, weight: 115 },
        { weekNumber: 6, reps: 3, weight: 122.5 },
        { weekNumber: 7, reps: 5, weight: 115 },
        { weekNumber: 8, reps: 5, weight: 120 },
      ],
    },
    {
      slot: 3,
      liftKey: "row",
      displayName: "Barbell or chest-supported row",
      entries: [
        { weekNumber: 1, reps: 8, weight: 70 },
        { weekNumber: 2, reps: 8, weight: 67.5 },
        { weekNumber: 3, reps: 8, weight: 67.5 },
        { weekNumber: 4, reps: 10, weight: 65 },
        { weekNumber: 5, reps: 8, weight: 70 },
        { weekNumber: 6, reps: 8, weight: 67.5 },
        { weekNumber: 7, reps: 10, weight: 67.5 },
        // Week 8 not logged: the verdict must cope with two lifts, not three.
      ],
    },
  ];
}

/** A user two days into week 1: everything downstream must handle a near-empty
 * block without dividing by seven. */
export function midWeekOneEntries(): DailyEntry[] {
  return [
    {
      entryDate: DEMO_BLOCK_START,
      weight: 95.8,
      proteinHit: true,
      workoutDone: true,
      sleepHit: true,
      stepsHit: false,
      drinks: 0,
      notes: null,
    },
    {
      entryDate: addDays(DEMO_BLOCK_START, 1),
      weight: 95.6,
      proteinHit: true,
      workoutDone: false,
      sleepHit: true,
      stepsHit: true,
      drinks: 0,
      notes: null,
    },
  ];
}

/**
 * A block week with three consecutive missed days in the middle, so the lapse
 * prompt and the streak-across-a-gap behaviour are both testable.
 */
export function lapsedEntries(): DailyEntry[] {
  const answered = [0, 1, 2, 6];
  return answered.map((offset) => ({
    entryDate: addDays(DEMO_BLOCK_START, offset),
    weight: round1(95.8 - offset * 0.1),
    proteinHit: offset !== 6,
    workoutDone: offset % 2 === 0,
    sleepHit: true,
    stepsHit: offset === 0,
    drinks: 0,
    notes: null,
  }));
}
