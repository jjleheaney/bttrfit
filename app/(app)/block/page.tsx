import Link from "next/link";
import { redirect } from "next/navigation";
import {
  DAYS_PER_BLOCK,
  blockSummary,
  type BlockWeek,
  type MetricCompliance,
  type UnitPreference,
} from "@/lib/domain";
import { getBlockContext } from "@/lib/data/blocks";
import { currentDate } from "@/lib/data/today";
import { LiftChart } from "@/components/lift-chart";
import { LiftRow } from "@/components/lift-row";
import { WeightChart } from "@/components/weight-chart";
import { formatDay, formatDelta, formatRate, formatWeight } from "@/lib/format";

/**
 * The eight weeks in one place. The week screen answers "how was last week";
 * this answers "is the block working", which is a different question and needs
 * the whole span to answer honestly.
 */
export default async function BlockPage() {
  const [context, today] = await Promise.all([getBlockContext(), currentDate()]);

  if (!context) {
    redirect("/start");
  }

  const { block, entries, lifts, profile } = context;
  const unit = profile.unitPreference;
  const summary = blockSummary(block, entries, lifts, today);
  const { compliance } = summary;

  return (
    <main className="flex flex-1 flex-col gap-4 px-4 pt-3 pb-4">
      <header>
        <h1 className="font-display text-title uppercase tracking-tight">
          Block {block.blockNumber}
        </h1>
        <p className="tabular text-caption text-text-muted">
          {formatDay(block.startDate)} – {formatDay(block.endDate)} ·{" "}
          {summary.weeksElapsed === 0
            ? "not started"
            : summary.finished
              ? "all 8 weeks logged"
              : `day ${summary.daysElapsed} of ${DAYS_PER_BLOCK}`}
        </p>
      </header>

      {summary.finished && (
        <Link
          href="/block/review"
          className="rounded-md border border-line bg-surface px-3 py-2 text-caption"
        >
          The block is over.{" "}
          <span className="underline">Read the review and start block {block.blockNumber + 1}</span>
        </Link>
      )}

      <section
        aria-labelledby="headline"
        className="flex flex-col gap-1 rounded-md border border-line bg-surface px-3 py-3"
      >
        <h2 id="headline" className="text-caption uppercase tracking-wide text-text-muted">
          Weight, block to date
        </h2>
        <p className="font-display text-display uppercase leading-none tracking-tight">
          {summary.weightChange === null ? "—" : formatDelta(summary.weightChange, unit)}
        </p>
        <p className="tabular text-caption text-text-muted">
          {summary.latestWeekAverage === null
            ? "No weigh-ins yet, so there is no block change to report."
            : `${formatWeight(summary.startingWeight, unit)} at the start, ${formatWeight(summary.latestWeekAverage, unit)} on the latest week's average`}
        </p>
      </section>

      <section aria-labelledby="trend" className="flex flex-col gap-2">
        <h2 id="trend" className="text-caption uppercase tracking-wide text-text-muted">
          The trend
        </h2>
        <WeightChart points={summary.trend} unit={unit} />
      </section>

      <section aria-labelledby="lifts" className="flex flex-col gap-3">
        <h2 id="lifts" className="text-caption uppercase tracking-wide text-text-muted">
          Sentinel lifts, weeks 1–8
        </h2>
        <LiftChart lifts={summary.lifts} unit={unit} />
        {summary.lifts.map((lift) => (
          <LiftRow key={lift.liftKey} lift={lift} unit={unit} />
        ))}
      </section>

      <section aria-labelledby="compliance" className="flex flex-col gap-1">
        <h2 id="compliance" className="text-caption uppercase tracking-wide text-text-muted">
          Compliance · {compliance.daysLogged} of {compliance.daysElapsed} days logged
        </h2>
        <Rate label="Protein" metric={compliance.protein} daysLogged={compliance.daysLogged} />
        <Rate label="Sleep" metric={compliance.sleep} daysLogged={compliance.daysLogged} />
        <Rate label="Steps" metric={compliance.steps} daysLogged={compliance.daysLogged} />
        <Line
          label="Training"
          value={
            compliance.workoutsCompleted === 1 ? "1 session" : `${compliance.workoutsCompleted} sessions`
          }
        />
        <Line
          label="Drinks"
          value={`${compliance.totalDrinks} of ${compliance.drinksAllowance}`}
          status={
            compliance.daysLogged === 0
              ? null
              : compliance.totalDrinks <= compliance.drinksAllowance
                ? "hit"
                : "miss"
          }
        />
      </section>

      <section aria-labelledby="weeks" className="flex flex-col gap-2">
        <h2 id="weeks" className="text-caption uppercase tracking-wide text-text-muted">
          Week by week
        </h2>
        <ul className="flex flex-col gap-1">
          {summary.weeks.map((week) => (
            <li key={week.weekNumber}>
              <WeekRow week={week} unit={unit} />
            </li>
          ))}
        </ul>
        <p className="text-caption text-text-muted">
          {summary.judgedWeeks === 0
            ? "No week has enough data for a verdict yet: a verdict needs a previous week's weight and two lifts to compare."
            : `${summary.recompingWeeks} of ${summary.judgedWeeks} judged ${summary.judgedWeeks === 1 ? "week" : "weeks"} came back recomping.`}
        </p>
      </section>
    </main>
  );
}

function WeekRow({ week, unit }: { week: BlockWeek; unit: UnitPreference }) {
  if (!week.started) {
    return (
      <p className="flex items-baseline justify-between gap-2 rounded-md border border-dotted border-line px-3 py-2 text-caption text-text-muted">
        <span>Week {week.weekNumber}</span>
        <span className="tabular">Not started</span>
      </p>
    );
  }

  const { verdict } = week;

  return (
    <Link
      href={`/week?week=${week.weekNumber}`}
      className="flex min-h-tap items-center justify-between gap-2 rounded-md border border-line bg-surface px-3 py-2"
    >
      <span className="flex flex-col">
        <span className="text-caption">Week {week.weekNumber}</span>
        <span className="tabular text-caption text-text-muted">
          {week.daysLogged}/7 logged · {week.liftsLogged}/3 lifts
        </span>
      </span>
      <span className="flex flex-col items-end">
        <span
          className={`text-caption font-medium ${verdictTone(week)} ${verdict.conclusive ? "" : "text-text-muted"}`}
        >
          {verdict.label}
        </span>
        <span className="tabular text-caption text-text-muted">
          {week.weightAverage === null ? "no weigh-ins" : formatWeight(week.weightAverage, unit)}
          {week.weeklyDelta === null ? "" : ` · ${formatDelta(week.weeklyDelta, unit)}`}
        </span>
      </span>
    </Link>
  );
}

/** Only the verdicts that read as good or bad get a colour. The three that refuse
 * to answer stay neutral: a colour would be an answer. */
function verdictTone(week: BlockWeek): string {
  if (!week.verdict.conclusive) return "";
  if (week.verdict.key === "recomping" || week.verdict.key === "recomping_slowly") {
    return "text-hit";
  }
  if (week.verdict.key === "losing_more_than_fat" || week.verdict.key === "off_track") {
    return "text-miss";
  }
  return "";
}

function Rate({
  label,
  metric,
  daysLogged,
}: {
  label: string;
  metric: MetricCompliance;
  daysLogged: number;
}) {
  return <Line label={label} value={`${formatRate(metric.rate)} · ${metric.days}/${daysLogged}`} />;
}

function Line({
  label,
  value,
  status = null,
}: {
  label: string;
  value: string;
  status?: "hit" | "miss" | null;
}) {
  return (
    <p className="flex items-baseline justify-between gap-2 text-caption">
      <span className="text-text-muted">{label}</span>
      <span
        className={`tabular ${status === "hit" ? "text-hit" : status === "miss" ? "text-miss" : ""}`}
      >
        {value}
      </span>
    </p>
  );
}
