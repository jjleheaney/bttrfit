"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import {
  MAX_WEEKLY_DRINKS_TARGET,
  SENTINEL_LIFT_MENU,
  canSwapSentinelLift,
  liftDisplayName,
  parseDecimal,
  parseInteger,
  parseWeight,
} from "@/lib/domain";
import {
  deleteAccount,
  getActiveBlock,
  getBlockContext,
  getProfile,
  swapSentinelLift,
  updateBlockTargets,
  updateProfile,
} from "@/lib/data/blocks";
import { createClient } from "@/lib/data/supabase/server";

export type SettingsResult = { ok: true } | { ok: false; error: string };

/**
 * Every action here re-reads the block from the database rather than trusting an
 * id from the form: a Server Function is a public POST endpoint, and the id is
 * the only thing standing between a stranger and someone else's targets.
 */
export async function saveTargets(input: {
  startingWeight: string;
  proteinTargetG: string;
  weeklyDrinksTarget: string;
}): Promise<SettingsResult> {
  const [profile, block] = await Promise.all([getProfile(), getActiveBlock()]);
  if (!block) return { ok: false, error: "You have no active block." };

  const weight = parseWeight(input.startingWeight, profile.unitPreference);
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

  try {
    await updateBlockTargets(block.id, {
      startingWeight: weight.value,
      proteinTargetG: protein.value,
      weeklyDrinksTarget: drinks.value,
    });
  } catch {
    return { ok: false, error: "Could not save. Try again." };
  }

  refresh();
  return { ok: true };
}

export async function saveName(firstName: string): Promise<SettingsResult> {
  const name = firstName.trim().slice(0, 40);
  if (!name) return { ok: false, error: "Enter a name." };

  try {
    await updateProfile({ firstName: name });
  } catch {
    return { ok: false, error: "Could not save. Try again." };
  }

  refresh();
  return { ok: true };
}

export async function swapLift(input: {
  sentinelLiftId: string;
  liftKey: string;
  reps: string;
  weight: string;
}): Promise<SettingsResult> {
  const context = await getBlockContext();
  const lift = context?.lifts.find((candidate) => candidate.id === input.sentinelLiftId);
  if (!lift) return { ok: false, error: "That lift is not in your active block." };

  const decision = canSwapSentinelLift(lift);
  if (!decision.allowed) return { ok: false, error: decision.reason };

  if (!SENTINEL_LIFT_MENU.some((option) => option.key === input.liftKey)) {
    return { ok: false, error: "That is not a lift on the list." };
  }
  if (context?.lifts.some((other) => other.id !== lift.id && other.liftKey === input.liftKey)) {
    return { ok: false, error: "That lift is already in another slot." };
  }

  const reps = parseInteger(input.reps, { min: 1, max: 30, label: "Reps" });
  if ("error" in reps) return { ok: false, error: reps.error };
  const weight = parseDecimal(input.weight, { min: 1, max: 1000, label: "Weight" });
  if ("error" in weight) return { ok: false, error: weight.error };

  try {
    await swapSentinelLift(lift.id, input.liftKey, liftDisplayName(input.liftKey), {
      reps: reps.value,
      weight: weight.value,
    });
  } catch {
    return { ok: false, error: "Could not swap the lift. Try again." };
  }

  refresh();
  return { ok: true };
}

/**
 * Irreversible, so it asks for the account's own email back before it runs —
 * the one confirmation that cannot be tapped through by accident.
 */
export async function closeAccount(confirmation: string): Promise<SettingsResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, error: "You are not signed in." };

  if (confirmation.trim().toLowerCase() !== user.email.toLowerCase()) {
    return { ok: false, error: "That is not the email this account uses." };
  }

  try {
    await deleteAccount();
  } catch {
    return { ok: false, error: "Could not delete the account. Try again." };
  }

  // The session outlives the row it points at, so it has to go too or the next
  // request is made as a user who no longer exists.
  await supabase.auth.signOut();
  redirect("/login");
}
