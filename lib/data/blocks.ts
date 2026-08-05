import { createClient } from "./supabase/server";
import {
  DAYS_PER_BLOCK,
  blockEndDate,
  type Block,
  type BlockStatus,
  type DailyEntry,
  type IsoDate,
  type SentinelLift,
  type UnitPreference,
} from "@/lib/domain";

/**
 * The only place that knows both the database shape and the domain shape.
 *
 * Reads return domain types plus the ids writes need, so nothing above this
 * layer handles a snake_case row — that boundary is what lets `lib/domain` be
 * lifted into the React Native port untouched.
 */

export type Profile = {
  id: string;
  firstName: string;
  unitPreference: UnitPreference;
};

export type BlockRecord = Block & {
  id: string;
  blockNumber: number;
  endDate: IsoDate;
  status: BlockStatus;
};

export type SentinelLiftRecord = SentinelLift & { id: string };

export type BlockContext = {
  profile: Profile;
  block: BlockRecord;
  /** Every entry in the block: 56 rows at most, so paging would cost more than
   * it saves and day-to-day navigation needs no further round trips. */
  entries: DailyEntry[];
  lifts: SentinelLiftRecord[];
};

export class NotSignedInError extends Error {
  constructor() {
    super("Not signed in");
  }
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new NotSignedInError();
  return { supabase, user };
}

export async function getProfile(): Promise<Profile> {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("profiles")
    .select("id, first_name, unit_preference")
    .eq("id", user.id)
    .maybeSingle();

  // The signup trigger creates the row, but a profile that went missing must not
  // be able to lock a user out of their own check-in.
  return {
    id: user.id,
    firstName: data?.first_name ?? "",
    unitPreference: data?.unit_preference ?? "kg",
  };
}

function toBlockRecord(row: {
  id: string;
  block_number: number;
  start_date: string;
  end_date: string;
  starting_weight: number;
  protein_target_g: number;
  weekly_drinks_target: number;
  status: BlockStatus;
}): BlockRecord {
  return {
    id: row.id,
    blockNumber: row.block_number,
    startDate: row.start_date,
    endDate: row.end_date,
    startingWeight: Number(row.starting_weight),
    proteinTargetG: row.protein_target_g,
    weeklyDrinksTarget: row.weekly_drinks_target,
    status: row.status,
  };
}

const BLOCK_COLUMNS =
  "id, block_number, start_date, end_date, starting_weight, protein_target_g, weekly_drinks_target, status";

export async function getActiveBlock(): Promise<BlockRecord | null> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("blocks")
    .select(BLOCK_COLUMNS)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (error) throw error;
  return data ? toBlockRecord(data) : null;
}

export async function getLastBlock(): Promise<BlockRecord | null> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("blocks")
    .select(BLOCK_COLUMNS)
    .eq("user_id", user.id)
    .order("block_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data ? toBlockRecord(data) : null;
}

/**
 * Retires any active block whose eight weeks are behind the user.
 *
 * `status` is what the one-active-block index keys on, so leaving an expired
 * block active makes the app a dead end: no more check-ins, and the next block
 * refused because a block is "already running".
 */
export async function completeExpiredBlocks(today: IsoDate): Promise<void> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("blocks")
    .update({ status: "completed" })
    .eq("user_id", user.id)
    .eq("status", "active")
    .lt("end_date", today);

  if (error) throw error;
}

/** The lifts a block was built around, in slot order. Prefills the next block. */
export async function getLiftKeysForBlock(blockId: string): Promise<string[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("sentinel_lifts")
    .select("lift_key, slot")
    .eq("block_id", blockId)
    .order("slot");

  if (error) throw error;
  return (data ?? []).map((row) => row.lift_key);
}

/**
 * The last weight the user actually stood on a scale for, across every block.
 * A new block starts from that rather than from the previous block's starting
 * weight, which is by then months out of date.
 */
export async function getLatestRecordedWeight(): Promise<number | null> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("daily_entries")
    .select("weight")
    .eq("user_id", user.id)
    .not("weight", "is", null)
    .order("entry_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.weight === null || data?.weight === undefined ? null : Number(data.weight);
}

/** Everything the Today screen and the lift log need, in one round trip each. */
export async function getBlockContext(): Promise<BlockContext | null> {
  const [profile, block] = await Promise.all([getProfile(), getActiveBlock()]);
  if (!block) return null;

  const { supabase } = await requireUser();
  const [entries, lifts] = await Promise.all([
    supabase
      .from("daily_entries")
      .select("entry_date, weight, protein_hit, workout_done, sleep_hit, steps_hit, drinks, notes")
      .eq("block_id", block.id)
      .order("entry_date"),
    supabase
      .from("sentinel_lifts")
      .select("id, slot, lift_key, display_name, lift_entries (week_number, reps, weight)")
      .eq("block_id", block.id)
      .order("slot"),
  ]);

  if (entries.error) throw entries.error;
  if (lifts.error) throw lifts.error;

  return {
    profile,
    block,
    entries: (entries.data ?? []).map((row) => ({
      entryDate: row.entry_date,
      weight: row.weight === null ? null : Number(row.weight),
      proteinHit: row.protein_hit,
      workoutDone: row.workout_done,
      sleepHit: row.sleep_hit,
      stepsHit: row.steps_hit,
      drinks: row.drinks,
      notes: row.notes,
    })),
    lifts: (lifts.data ?? []).map((row) => ({
      id: row.id,
      slot: row.slot as 1 | 2 | 3,
      liftKey: row.lift_key,
      displayName: row.display_name,
      entries: (row.lift_entries ?? [])
        .map((entry) => ({
          weekNumber: entry.week_number,
          reps: entry.reps,
          weight: Number(entry.weight),
        }))
        .sort((a, b) => a.weekNumber - b.weekNumber),
    })),
  };
}

export type DailyEntryPatch = Partial<Omit<DailyEntry, "entryDate">>;

/**
 * Writes one day, creating the row on first touch. Only the keys the user
 * actually changed are sent: an omitted metric must stay unanswered rather than
 * being overwritten with `null` by a second tap on a different metric.
 */
export async function saveDailyEntry(
  blockId: string,
  entryDate: IsoDate,
  patch: DailyEntryPatch,
): Promise<void> {
  const { supabase, user } = await requireUser();

  const columns: Record<string, string | number | boolean | null> = {};
  if ("weight" in patch) columns.weight = patch.weight ?? null;
  if ("proteinHit" in patch) columns.protein_hit = patch.proteinHit ?? null;
  if ("workoutDone" in patch) columns.workout_done = patch.workoutDone ?? null;
  if ("sleepHit" in patch) columns.sleep_hit = patch.sleepHit ?? null;
  if ("stepsHit" in patch) columns.steps_hit = patch.stepsHit ?? null;
  if ("drinks" in patch) columns.drinks = patch.drinks ?? null;
  if ("notes" in patch) columns.notes = patch.notes?.trim() ? patch.notes.trim() : null;

  const { error } = await supabase
    .from("daily_entries")
    .upsert(
      { user_id: user.id, block_id: blockId, entry_date: entryDate, ...columns },
      { onConflict: "user_id,entry_date" },
    );

  if (error) throw error;
}

export type NewBlock = {
  firstName: string;
  unitPreference: UnitPreference;
  startDate: IsoDate;
  startingWeight: number;
  proteinTargetG: number;
  weeklyDrinksTarget: number;
  lifts: { slot: 1 | 2 | 3; liftKey: string; displayName: string; reps: number; weight: number }[];
};

/**
 * Creates the profile, the block, its three sentinel lifts and the week 1
 * baseline top sets — in one transaction, via the `create_block` function.
 *
 * Separate inserts could half-succeed, and a block without its lifts still holds
 * the one-active-block index: the user would be unable to retry setup and unable
 * to check in. The function runs as the caller (security invoker), so RLS still
 * decides what it may write and it takes no user id from the client.
 */
export async function createBlock(input: NewBlock): Promise<BlockRecord> {
  const { supabase } = await requireUser();

  const { data, error } = await supabase.rpc("create_block", {
    p_first_name: input.firstName,
    p_unit_preference: input.unitPreference,
    p_start_date: input.startDate,
    p_starting_weight: input.startingWeight,
    p_protein_target_g: input.proteinTargetG,
    p_weekly_drinks_target: input.weeklyDrinksTarget,
    p_lifts: input.lifts.map((lift) => ({
      slot: lift.slot,
      lift_key: lift.liftKey,
      display_name: lift.displayName,
      reps: lift.reps,
      weight: lift.weight,
    })),
  });

  if (error) throw error;
  if (!data) throw new Error("create_block returned no block");
  return toBlockRecord(data);
}

/** Upserts the week's top set for each lift the user filled in. */
export async function saveLiftEntries(
  weekNumber: number,
  entries: { sentinelLiftId: string; reps: number; weight: number }[],
): Promise<void> {
  if (entries.length === 0) return;
  const { supabase } = await requireUser();

  const { error } = await supabase.from("lift_entries").upsert(
    entries.map((entry) => ({
      sentinel_lift_id: entry.sentinelLiftId,
      week_number: weekNumber,
      reps: entry.reps,
      weight: entry.weight,
    })),
    { onConflict: "sentinel_lift_id,week_number" },
  );

  if (error) throw error;
}

/** True once the block's 56 days are behind the user. */
export function blockIsOver(block: BlockRecord, today: IsoDate): boolean {
  return today > blockEndDate(block.startDate);
}

export const BLOCK_LENGTH_DAYS = DAYS_PER_BLOCK;
