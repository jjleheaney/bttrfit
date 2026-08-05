"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import {
  SENTINEL_LIFT_SLOTS,
  WEEKS_PER_BLOCK,
  isIsoDate,
  toKilograms,
  weekNumberFor,
  type UnitPreference,
} from "@/lib/domain";
import {
  getActiveBlock,
  getProfile,
  saveDailyEntry,
  saveLiftEntries,
  type DailyEntryPatch,
} from "@/lib/data/blocks";
import { TIME_ZONE_COOKIE, TIME_ZONE_COOKIE_MAX_AGE } from "@/lib/data/today";

export type SaveResult = { ok: true } | { ok: false; error: string };

/** Recorded once per browser so the server can tell which day the user is in. */
export async function setTimeZone(timeZone: string): Promise<void> {
  if (!/^[A-Za-z0-9_+\-/]{1,64}$/.test(timeZone)) return;
  const store = await cookies();
  store.set(TIME_ZONE_COOKIE, timeZone, {
    maxAge: TIME_ZONE_COOKIE_MAX_AGE,
    sameSite: "lax",
    path: "/",
  });
}

export type DayPatch = {
  weight?: number | null;
  proteinHit?: boolean | null;
  workoutDone?: boolean | null;
  sleepHit?: boolean | null;
  stepsHit?: boolean | null;
  drinks?: number | null;
  notes?: string | null;
};

function weightIsPlausible(weight: number, unit: UnitPreference): boolean {
  if (!Number.isFinite(weight)) return false;
  const kilograms = toKilograms(weight, unit);
  return kilograms >= 30 && kilograms <= 400;
}

/**
 * Server actions are reachable by POST regardless of the UI, so the date is
 * re-checked against the user's own active block here rather than trusted.
 */
export async function saveDay(entryDate: string, patch: DayPatch): Promise<SaveResult> {
  if (!isIsoDate(entryDate)) return { ok: false, error: "That is not a date." };

  const [profile, block] = await Promise.all([getProfile(), getActiveBlock()]);
  if (!block) return { ok: false, error: "You have no active block." };
  if (weekNumberFor(block.startDate, entryDate) === null) {
    return { ok: false, error: "That day is outside this block." };
  }

  const clean: DailyEntryPatch = {};
  if ("weight" in patch) {
    const weight = patch.weight ?? null;
    if (weight !== null && !weightIsPlausible(weight, profile.unitPreference)) {
      return { ok: false, error: "That weight looks wrong. Check it and try again." };
    }
    clean.weight = weight;
  }
  for (const key of ["proteinHit", "workoutDone", "sleepHit", "stepsHit"] as const) {
    if (key in patch) {
      const value = patch[key] ?? null;
      if (value !== null && typeof value !== "boolean") {
        return { ok: false, error: "Could not save that answer." };
      }
      clean[key] = value;
    }
  }
  if ("drinks" in patch) {
    const drinks = patch.drinks ?? null;
    if (drinks !== null && (!Number.isInteger(drinks) || drinks < 0 || drinks > 50)) {
      return { ok: false, error: "Drinks must be a whole number." };
    }
    clean.drinks = drinks;
  }
  if ("notes" in patch) {
    clean.notes = typeof patch.notes === "string" ? patch.notes.slice(0, 2000) : null;
  }

  try {
    await saveDailyEntry(block.id, entryDate, clean);
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not save. Check your connection and try again." };
  }
}

export type LiftInput = { sentinelLiftId: string; reps: number; weight: number };

export async function logLifts(weekNumber: number, lifts: LiftInput[]): Promise<SaveResult> {
  if (!Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > WEEKS_PER_BLOCK) {
    return { ok: false, error: "That is not a week in this block." };
  }
  if (lifts.length === 0) return { ok: false, error: "Enter at least one lift." };
  if (lifts.length > SENTINEL_LIFT_SLOTS) return { ok: false, error: "Too many lifts." };

  for (const lift of lifts) {
    if (!Number.isInteger(lift.reps) || lift.reps < 1 || lift.reps > 30) {
      return { ok: false, error: "Reps must be a whole number between 1 and 30." };
    }
    if (!Number.isFinite(lift.weight) || lift.weight <= 0 || lift.weight > 1000) {
      return { ok: false, error: "Check the weight on the bar." };
    }
  }

  try {
    // RLS decides whether these lift ids belong to the caller: an id from another
    // user's block fails the policy rather than being silently written.
    await saveLiftEntries(weekNumber, lifts);
    refresh();
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not save those lifts. Try again." };
  }
}
