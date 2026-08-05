/**
 * Proves row level security across the four user-owned tables by driving the
 * API as two real signed-in users, not as the service role.
 *
 * Each user seeds a block, a sentinel lift, a lift entry and a daily entry,
 * then tries to read, update and delete the other user's rows. RLS is correct
 * only if every cross-user read comes back empty and every cross-user write
 * affects nothing. Test users and their data are removed at the end.
 *
 *   node scripts/rls-smoke-test.mjs
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and
 * SUPABASE_SERVICE_ROLE_KEY. Nothing is written to any table a real user owns.
 */
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: [".env", ".env.local"], override: true, quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  console.error(
    "Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY first.",
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const password = `rls-smoke-${crypto.randomUUID()}`;
const results = [];

function check(name, passed, detail = "") {
  results.push({ name, passed, detail });
  console.log(`${passed ? "ok  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function createUser(label) {
  const email = `rls-smoke-${label}-${Date.now()}@bttrfit.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: label },
  });
  if (error) throw new Error(`Could not create ${label}: ${error.message}`);

  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`Could not sign in ${label}: ${signInError.message}`);

  return { id: data.user.id, email, client, label };
}

async function seed(user, startDate) {
  const { data: block, error: blockError } = await user.client
    .from("blocks")
    .insert({
      user_id: user.id,
      block_number: 1,
      start_date: startDate,
      starting_weight: 95.8,
      protein_target_g: 170,
    })
    .select()
    .single();
  if (blockError) throw new Error(`${user.label} could not insert a block: ${blockError.message}`);

  const { data: lift, error: liftError } = await user.client
    .from("sentinel_lifts")
    .insert({ block_id: block.id, slot: 1, lift_key: "bench_press", display_name: "Bench press" })
    .select()
    .single();
  if (liftError) throw new Error(`${user.label} could not insert a lift: ${liftError.message}`);

  const { data: liftEntry, error: liftEntryError } = await user.client
    .from("lift_entries")
    .insert({ sentinel_lift_id: lift.id, week_number: 1, reps: 6, weight: 80 })
    .select()
    .single();
  if (liftEntryError) {
    throw new Error(`${user.label} could not insert a lift entry: ${liftEntryError.message}`);
  }

  const { data: daily, error: dailyError } = await user.client
    .from("daily_entries")
    .insert({
      user_id: user.id,
      block_id: block.id,
      entry_date: startDate,
      weight: 95.8,
      protein_hit: true,
    })
    .select()
    .single();
  if (dailyError) {
    throw new Error(`${user.label} could not insert a daily entry: ${dailyError.message}`);
  }

  return { block, lift, liftEntry, daily };
}

/** A signed-in user must see their own row and nothing else in the table. */
async function checkOwnReadIsolated(user, table, ownId, otherId) {
  const { data, error } = await user.client.from(table).select("id");
  if (error) {
    check(`${user.label} can read own ${table}`, false, error.message);
    return;
  }
  const ids = data.map((row) => row.id);
  check(`${user.label} sees own ${table} row`, ids.includes(ownId));
  check(
    `${user.label} cannot see the other user's ${table} row`,
    !ids.includes(otherId),
    `visible ids: ${ids.length}`,
  );
}

async function checkCrossUserWrites(user, table, otherId, update) {
  const { data: updated, error: updateError } = await user.client
    .from(table)
    .update(update)
    .eq("id", otherId)
    .select();
  check(
    `${user.label} cannot update the other user's ${table} row`,
    !updateError && (updated?.length ?? 0) === 0,
    updateError ? `rejected: ${updateError.message}` : "0 rows affected",
  );

  const { data: deleted, error: deleteError } = await user.client
    .from(table)
    .delete()
    .eq("id", otherId)
    .select();
  check(
    `${user.label} cannot delete the other user's ${table} row`,
    !deleteError && (deleted?.length ?? 0) === 0,
    deleteError ? `rejected: ${deleteError.message}` : "0 rows affected",
  );
}

async function main() {
  const alice = await createUser("alice");
  const bob = await createUser("bob");

  try {
    // The signup trigger, not the client, is responsible for the profile row.
    for (const user of [alice, bob]) {
      const { data } = await user.client.from("profiles").select("id, first_name");
      check(
        `${user.label} has exactly one profile row, created by the signup trigger`,
        data?.length === 1 && data[0].id === user.id,
        `first_name: ${data?.[0]?.first_name ?? "none"}`,
      );
    }

    const aliceRows = await seed(alice, "2026-01-05");
    const bobRows = await seed(bob, "2026-02-02");

    const tables = [
      ["blocks", aliceRows.block.id, bobRows.block.id, { starting_weight: 1 }],
      ["sentinel_lifts", aliceRows.lift.id, bobRows.lift.id, { display_name: "Hijacked" }],
      ["lift_entries", aliceRows.liftEntry.id, bobRows.liftEntry.id, { weight: 1 }],
      ["daily_entries", aliceRows.daily.id, bobRows.daily.id, { weight: 1 }],
    ];

    for (const [table, aliceId, bobId, update] of tables) {
      await checkOwnReadIsolated(alice, table, aliceId, bobId);
      await checkOwnReadIsolated(bob, table, bobId, aliceId);
      await checkCrossUserWrites(alice, table, bobId, update);
      await checkCrossUserWrites(bob, table, aliceId, update);
    }

    // Ownership of lifts is derived through blocks, so writing a lift into
    // someone else's block must fail too.
    const { error: forgedLift } = await alice.client
      .from("sentinel_lifts")
      .insert({
        block_id: bobRows.block.id,
        slot: 2,
        lift_key: "deadlift",
        display_name: "Deadlift",
      });
    check(
      "alice cannot add a sentinel lift to the other user's block",
      Boolean(forgedLift),
      forgedLift?.message ?? "insert unexpectedly succeeded",
    );

    // user_id is not trusted from the client: RLS must reject a spoofed owner.
    const { error: forgedEntry } = await alice.client.from("daily_entries").insert({
      user_id: bob.id,
      block_id: bobRows.block.id,
      entry_date: "2026-02-03",
      weight: 80,
    });
    check(
      "alice cannot write a daily entry as the other user",
      Boolean(forgedEntry),
      forgedEntry?.message ?? "insert unexpectedly succeeded",
    );

    const { error: profileTheft } = await alice.client
      .from("profiles")
      .update({ first_name: "Hijacked" })
      .eq("id", bob.id)
      .select();
    const { data: bobProfile } = await bob.client
      .from("profiles")
      .select("first_name")
      .eq("id", bob.id)
      .single();
    check(
      "alice cannot rename the other user's profile",
      !profileTheft && bobProfile?.first_name !== "Hijacked",
      `first_name is still ${bobProfile?.first_name}`,
    );
  } finally {
    for (const user of [alice, bob]) {
      await admin.auth.admin.deleteUser(user.id);
    }
    console.log("\ncleaned up both test users (cascades remove their rows)");
  }

  const failed = results.filter((result) => !result.passed);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
