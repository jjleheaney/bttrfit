import Link from "next/link";
import {
  getActiveBlock,
  getLastBlock,
  getLatestRecordedWeight,
  getLiftKeysForBlock,
  getProfile,
} from "@/lib/data/blocks";
import { TimezoneSync } from "@/components/timezone-sync";
import { currentDate, currentTimeZone } from "@/lib/data/today";
import { StartFlow } from "./start-flow";

export default async function StartPage() {
  const [profile, active, previous, latestWeight, today] = await Promise.all([
    getProfile(),
    getActiveBlock(),
    getLastBlock(),
    getLatestRecordedWeight(),
    currentDate(),
  ]);
  const timeZone = await currentTimeZone();

  if (active) {
    return (
      <main className="flex flex-1 flex-col justify-center gap-3 px-5 py-10">
        <h1 className="font-display text-display uppercase tracking-tight">
          Block {active.blockNumber} is already running
        </h1>
        <p className="text-body text-text-muted">
          A block runs for eight weeks and only one runs at a time.
        </p>
        <Link href="/" className="underline">
          Go to today
        </Link>
      </main>
    );
  }

  // A second block is mostly confirmation: everything carries over from the last
  // one, including the lifts, and the user changes what they want.
  const liftKeys = previous ? await getLiftKeysForBlock(previous.id) : [];

  return (
    <>
      {/* Before the first check-in there is no cookie yet, and "start today" has
          to mean the user's today rather than UTC's. */}
      <TimezoneSync known={timeZone} />
      <StartFlow
        today={today}
        prefill={{
          firstName: profile.firstName,
          unitPreference: profile.unitPreference,
          startingWeight: latestWeight === null ? "" : latestWeight.toFixed(1),
          proteinTargetG: previous ? String(previous.proteinTargetG) : "",
          weeklyDrinksTarget: previous ? String(previous.weeklyDrinksTarget) : "",
          liftKeys,
          blockNumber: (previous?.blockNumber ?? 0) + 1,
        }}
      />
    </>
  );
}
