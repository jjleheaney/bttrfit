import Link from "next/link";
import { redirect } from "next/navigation";
import {
  SENTINEL_LIFT_SLOTS,
  blockEndDate,
  daysBetween,
  WEEKS_PER_BLOCK,
} from "@/lib/domain";
import { getBlockContext } from "@/lib/data/blocks";
import { currentDate } from "@/lib/data/today";
import { formatLongDay } from "@/lib/format";
import { TodayScreen } from "./today-screen";

export default async function TodayPage() {
  const [context, today] = await Promise.all([getBlockContext(), currentDate()]);

  if (!context) {
    redirect("/start");
  }

  const { block, entries, lifts, profile } = context;

  if (today < block.startDate) {
    const days = daysBetween(today, block.startDate);
    return (
      <Notice title={`Block ${block.blockNumber} starts ${formatLongDay(block.startDate)}`}>
        <p>
          {days === 1 ? "Tomorrow." : `In ${days} days.`} Check-ins open on the first day. Nothing
          to do until then.
        </p>
      </Notice>
    );
  }

  if (today > blockEndDate(block.startDate)) {
    return (
      <Notice title={`Block ${block.blockNumber} is finished`}>
        <p>
          All {WEEKS_PER_BLOCK} weeks are logged. The block review lands in a later phase; until
          then, start the next block to keep checking in.
        </p>
        <Link href="/start" className="underline">
          Start block {block.blockNumber + 1}
        </Link>
      </Notice>
    );
  }

  /** A week counts as logged once every sentinel lift has an entry for it. */
  const liftsLoggedForWeek = Array.from({ length: WEEKS_PER_BLOCK }, (_, index) => index + 1).filter(
    (week) =>
      lifts.length === SENTINEL_LIFT_SLOTS &&
      lifts.every((lift) => lift.entries.some((entry) => entry.weekNumber === week)),
  );

  return (
    // Keyed on the date: the first render of a fresh browser is UTC-derived until
    // TimezoneSync lands the real zone, and the corrected day has to reach the
    // screen's own state rather than only its props.
    <TodayScreen
      key={today}
      block={{
        startDate: block.startDate,
        startingWeight: block.startingWeight,
        proteinTargetG: block.proteinTargetG,
        weeklyDrinksTarget: block.weeklyDrinksTarget,
      }}
      blockId={block.id}
      initialEntries={entries}
      liftsLoggedForWeek={liftsLoggedForWeek}
      today={today}
      unit={profile.unitPreference}
    />
  );
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col justify-center gap-3 px-5 py-10">
      <h1 className="font-display text-display uppercase tracking-tight">{title}</h1>
      <div className="flex flex-col gap-3 text-body text-text-muted">{children}</div>
    </main>
  );
}
