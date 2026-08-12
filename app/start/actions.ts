"use server";

import { redirect } from "next/navigation";
import {
  MAX_WEEKLY_DRINKS_TARGET,
  SENTINEL_LIFT_MENU,
  SENTINEL_LIFT_SLOTS,
  daysBetween,
  isIsoDate,
  liftDisplayName,
  parseDecimal,
  parseInteger,
  parseWeight,
  type UnitPreference,
} from "@/lib/domain";
import { completeExpiredBlocks, createBlock, getActiveBlock } from "@/lib/data/blocks";
import { currentDate } from "@/lib/data/today";

/**
 * The flow always sends today. The window stays wider than that so a timezone
 * disagreement never rejects a legitimate setup, but a Server Function is a
 * public POST endpoint: without a bound, a block dated to 1970 or 2140 would
 * drive every week and day calculation from there.
 */
const EARLIEST_START_DAYS_BEFORE_TODAY = 7;
const LATEST_START_DAYS_AFTER_TODAY = 14;

export type StartBlockInput = {
  firstName: string;
  unitPreference: UnitPreference;
  startDate: string;
  startingWeight: string;
  proteinTargetG: string;
  weeklyDrinksTarget: string;
  lifts: { liftKey: string; reps: string; weight: string }[];
};

export type StartBlockResult = { ok: false; error: string };

/**
 * One write at the end of the flow rather than a draft row per step: an
 * abandoned setup should leave nothing behind, and a half-created block would
 * hold the one-active-block slot hostage.
 */
export async function startBlock(input: StartBlockInput): Promise<StartBlockResult> {
  const today = await currentDate();

  // A block whose eight weeks are over must not keep the active slot, or the
  // user can never start another one.
  await completeExpiredBlocks(today);
  if (await getActiveBlock()) {
    return { ok: false, error: "You already have an active block." };
  }

  const unit: UnitPreference = input.unitPreference === "lbs" ? "lbs" : "kg";

  if (!isIsoDate(input.startDate)) {
    return { ok: false, error: "Pick a start date." };
  }
  const offset = daysBetween(today, input.startDate);
  if (offset < -EARLIEST_START_DAYS_BEFORE_TODAY || offset > LATEST_START_DAYS_AFTER_TODAY) {
    return { ok: false, error: "A block starts today or on an upcoming day." };
  }

  const weight = parseWeight(input.startingWeight, unit);
  if ("error" in weight) return { ok: false, error: weight.error };

  const protein = parseInteger(input.proteinTargetG, {
    min: 40,
    max: 500,
    label: "Protein target",
  });
  if ("error" in protein) return { ok: false, error: protein.error };

  const drinks = parseInteger(input.weeklyDrinksTarget, {
    min: 0,
    max: MAX_WEEKLY_DRINKS_TARGET,
    label: "Drinks target",
  });
  if ("error" in drinks) return { ok: false, error: drinks.error };

  if (input.lifts.length !== SENTINEL_LIFT_SLOTS) {
    return { ok: false, error: `Pick ${SENTINEL_LIFT_SLOTS} lifts.` };
  }
  const keys = input.lifts.map((lift) => lift.liftKey);
  if (new Set(keys).size !== keys.length) {
    return { ok: false, error: "Pick three different lifts." };
  }
  if (keys.some((key) => !SENTINEL_LIFT_MENU.some((option) => option.key === key))) {
    return { ok: false, error: "That is not a lift on the list." };
  }

  const lifts = [];
  for (const [index, lift] of input.lifts.entries()) {
    const reps = parseInteger(lift.reps, { min: 1, max: 30, label: "Reps" });
    if ("error" in reps) return { ok: false, error: reps.error };
    const barWeight = parseDecimal(lift.weight, { min: 1, max: 1000, label: "Weight" });
    if ("error" in barWeight) return { ok: false, error: barWeight.error };

    lifts.push({
      slot: (index + 1) as 1 | 2 | 3,
      liftKey: lift.liftKey,
      displayName: liftDisplayName(lift.liftKey),
      reps: reps.value,
      weight: barWeight.value,
    });
  }

  try {
    await createBlock({
      firstName: input.firstName.trim().slice(0, 40),
      unitPreference: unit,
      startDate: input.startDate,
      startingWeight: weight.value,
      proteinTargetG: protein.value,
      weeklyDrinksTarget: drinks.value,
      lifts,
    });
  } catch {
    return { ok: false, error: "Could not start the block. Try again." };
  }

  redirect("/");
}
