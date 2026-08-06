import type { SentinelLift } from "./types";

/**
 * What a block will and will not let you change once it is running.
 *
 * Targets are a promise to yourself and can be renegotiated; the sentinel lift
 * is the measuring stick, and moving it mid-block destroys the only evidence the
 * app exists to produce.
 */

export type SwapRefusal = { allowed: false; reason: string };
export type SwapDecision = { allowed: true } | SwapRefusal;

/** The baseline top set every block is created with. */
const BASELINE_WEEK = 1;

/**
 * A lift can be swapped while it has nothing but its week 1 baseline.
 *
 * After a second week is logged the lift has started producing the comparison
 * the whole product rests on — "the bar held while bodyweight fell" — and a swap
 * would either throw that away or, worse, silently compare a bench press to a
 * squat. Waiting for the next block costs the user nothing they have not
 * already banked.
 */
export function canSwapSentinelLift(lift: SentinelLift): SwapDecision {
  const logged = lift.entries.filter((entry) => entry.weekNumber > BASELINE_WEEK);
  if (logged.length === 0) return { allowed: true };

  const weeks = logged.map((entry) => entry.weekNumber).sort((a, b) => a - b);
  const logsSoFar =
    weeks.length === 1 ? `week ${weeks[0]}` : `weeks ${weeks[0]} to ${weeks.at(-1)}`;

  return {
    allowed: false,
    reason: `You have logged ${logsSoFar} for this lift. Swapping it now would leave nothing to compare it against — choose a different lift when the next block starts.`,
  };
}
