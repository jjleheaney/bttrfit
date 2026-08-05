/** A calendar date in `YYYY-MM-DD` form. Never a `Date`: the app is used at
 * 6am and 11pm and a timestamp would drag the user's timezone into every
 * comparison. */
export type IsoDate = string;

export type UnitPreference = "kg" | "lbs";

export type BlockStatus = "active" | "completed" | "abandoned";

/** The block-scoped settings the domain layer needs. Targets live on the block,
 * not the profile, so each block's history stays internally consistent. */
export type Block = {
  startDate: IsoDate;
  startingWeight: number;
  proteinTargetG: number;
  weeklyDrinksTarget: number;
};

/**
 * Every metric is nullable and stays that way through the domain layer.
 * `null` means "not answered", which is not the same as "answered no".
 */
export type DailyEntry = {
  entryDate: IsoDate;
  weight: number | null;
  proteinHit: boolean | null;
  workoutDone: boolean | null;
  sleepHit: boolean | null;
  stepsHit: boolean | null;
  drinks: number | null;
  notes?: string | null;
};

export type LiftEntry = {
  weekNumber: number;
  reps: number;
  weight: number;
};

export type SentinelLift = {
  slot: 1 | 2 | 3;
  liftKey: string;
  displayName: string;
  entries: LiftEntry[];
};

/** The five metrics that can be the week's single focus. Weight is excluded: it
 * is the outcome being measured, not a behaviour to fix. */
export type MetricKey = "protein" | "steps" | "sleep" | "workouts" | "alcohol";
