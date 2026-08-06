import Link from "next/link";
import { redirect } from "next/navigation";
import { WEEKS_PER_BLOCK, weekNumberFor, weekRange } from "@/lib/domain";
import { getBlockContext } from "@/lib/data/blocks";
import { currentDate } from "@/lib/data/today";
import { formatDay } from "@/lib/format";
import { LiftLog } from "./lift-log";

export default async function LiftsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const [context, today, params] = await Promise.all([
    getBlockContext(),
    currentDate(),
    searchParams,
  ]);

  if (!context) {
    redirect("/start");
  }

  const { block, lifts, profile } = context;
  const requested = Number(params.week);
  const currentWeek = weekNumberFor(block.startDate, today);
  const weekNumber =
    Number.isInteger(requested) && requested >= 1 && requested <= WEEKS_PER_BLOCK
      ? requested
      : (currentWeek ?? 1);
  const { startDate, endDate } = weekRange(block.startDate, weekNumber);

  return (
    <main className="flex flex-1 flex-col gap-4 px-4 pt-3 pb-3">
      <header>
        <h1 className="font-display text-title uppercase tracking-tight">
          Week {weekNumber} lifts
        </h1>
        <p className="tabular text-caption text-text-muted">
          {formatDay(startDate)} – {formatDay(endDate)}
        </p>
      </header>

      {lifts.length === 0 ? (
        <p className="text-body text-text-muted">
          This block has no sentinel lifts. Start a new block to pick three.
        </p>
      ) : (
        <LiftLog lifts={lifts} weekNumber={weekNumber} unit={profile.unitPreference} />
      )}

      {lifts.length === 0 && (
        <Link href="/" className="min-h-tap text-caption text-text-muted underline">
          Back to today
        </Link>
      )}
    </main>
  );
}
