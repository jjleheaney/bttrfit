import Link from "next/link";
import { redirect } from "next/navigation";
import {
  WEEKS_PER_BLOCK,
  blockSummary,
  type MetricCompliance,
} from "@/lib/domain";
import { getBlockContext } from "@/lib/data/blocks";
import { currentDate } from "@/lib/data/today";
import { LiftRow } from "@/components/lift-row";
import { formatDay, formatDelta, formatRate, formatWeight } from "@/lib/format";

/**
 * The product's argument for itself, made once every eight weeks: what the scale
 * did, what the bar did, what was actually logged, and the one behaviour to carry
 * into the next block. One action at the end, because a review the user reads and
 * then closes has changed nothing.
 */
export default async function BlockReviewPage() {
  const [context, today] = await Promise.all([getBlockContext(), currentDate()]);

  if (!context) {
    redirect("/start");
  }

  const { block, entries, lifts, profile } = context;
  const unit = profile.unitPreference;
  const summary = blockSummary(block, entries, lifts, today);
  const { compliance } = summary;

  if (!summary.finished) {
    return (
      <main className="flex flex-1 flex-col justify-center gap-3 px-5 py-10">
        <h1 className="font-display text-display uppercase tracking-tight">
          The review lands when week {WEEKS_PER_BLOCK} closes
        </h1>
        <p className="text-body text-text-muted">
          {summary.weeksElapsed === 0
            ? `Block ${block.blockNumber} has not started yet.`
            : `You are on week ${summary.weeksElapsed} of ${WEEKS_PER_BLOCK}. Judging a block before it is over is how people quit one that was working.`}
        </p>
        <Link href="/block" className="underline">
          See the block so far
        </Link>
      </main>
    );
  }

  const held = summary.lifts.filter(
    (lift) => lift.status === "improved" || lift.status === "maintained",
  ).length;
  const comparable = summary.lifts.filter((lift) => lift.status !== null).length;
  const lostWeight = summary.weightChange !== null && summary.weightChange < -0.2;

  return (
    <main className="flex flex-1 flex-col gap-4 px-4 pt-3 pb-4">
      <header>
        <p className="text-caption uppercase tracking-wide text-text-muted">Block review</p>
        <h1 className="font-display text-title uppercase tracking-tight">
          Block {block.blockNumber}
        </h1>
        <p className="tabular text-caption text-text-muted">
          {formatDay(block.startDate)} – {formatDay(block.endDate)}
        </p>
      </header>

      <section
        aria-labelledby="result"
        className="flex flex-col gap-1 rounded-md border border-line bg-surface px-3 py-3"
      >
        <h2 id="result" className="text-caption uppercase tracking-wide text-text-muted">
          Eight weeks
        </h2>
        <p className="font-display text-hero uppercase leading-none tracking-tight">
          {summary.weightChange === null ? "—" : formatDelta(summary.weightChange, unit)}
        </p>
        <p className="tabular text-caption text-text-muted">
          {summary.latestWeekAverage === null
            ? "No weigh-ins were logged, so the block has no weight result."
            : `${formatWeight(summary.startingWeight, unit)} to ${formatWeight(summary.latestWeekAverage, unit)} on the final week's average`}
        </p>
        {/* The one sentence the product exists to be able to write. It is only
            written when both halves of the evidence are actually present. */}
        <p className="text-caption">
          {comparable === 0
            ? "No lift has two logged weeks to compare, so whether you kept your strength is unknown. Weight alone cannot answer it."
            : lostWeight && held === comparable
              ? "Bodyweight down and every sentinel lift held or climbed. That is body recomposition, without a DEXA scan."
              : lostWeight && held > 0
                ? `Bodyweight down, and ${held} of ${comparable} lifts held or climbed. Partly recomposition, partly loss.`
                : lostWeight
                  ? "Bodyweight came down and the bar came down with it. That is weight loss, not recomposition."
                  : held === comparable
                    ? "Strength held or climbed across the block while bodyweight did not fall. Strength kept, fat not lost."
                    : "Neither bodyweight nor the bar moved in your favour across these eight weeks."}
        </p>
      </section>

      <section aria-labelledby="lifts" className="flex flex-col gap-2">
        <h2 id="lifts" className="text-caption uppercase tracking-wide text-text-muted">
          Start versus finish
        </h2>
        {summary.lifts.map((lift) => (
          <LiftRow key={lift.liftKey} lift={lift} unit={unit} />
        ))}
      </section>

      <section aria-labelledby="verdicts" className="flex flex-col gap-1">
        <h2 id="verdicts" className="text-caption uppercase tracking-wide text-text-muted">
          Weeks that earned a verdict
        </h2>
        <p className="font-display text-display uppercase leading-none tracking-tight">
          {summary.recompingWeeks} of {summary.judgedWeeks}
        </p>
        <p className="text-caption text-text-muted">
          {summary.judgedWeeks === 0
            ? `No week could be judged: a verdict needs the previous week's weight and two lifts to compare against.`
            : `${summary.recompingWeeks === 0 ? "No week" : summary.recompingWeeks === 1 ? "One week" : `${summary.recompingWeeks} weeks`} came back recomping, out of the ${summary.judgedWeeks} that had enough data to judge. The other ${WEEKS_PER_BLOCK - summary.judgedWeeks} refused to answer rather than guess.`}
        </p>
      </section>

      <section aria-labelledby="compliance" className="flex flex-col gap-1">
        <h2 id="compliance" className="text-caption uppercase tracking-wide text-text-muted">
          What you logged · {compliance.daysLogged} of {compliance.daysElapsed} days
        </h2>
        <Rate label="Protein" metric={compliance.protein} daysLogged={compliance.daysLogged} />
        <Rate label="Sleep" metric={compliance.sleep} daysLogged={compliance.daysLogged} />
        <Rate label="Steps" metric={compliance.steps} daysLogged={compliance.daysLogged} />
        <Line
          label="Training"
          value={
            compliance.workoutsCompleted === 1
              ? "1 session"
              : `${compliance.workoutsCompleted} sessions`
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

      {summary.weakestMetric && (
        <section
          aria-labelledby="weakest"
          className="flex flex-col gap-1 rounded-md border border-line bg-surface px-3 py-2"
        >
          <h2 id="weakest" className="text-caption uppercase tracking-wide text-text-muted">
            What let you down most consistently
          </h2>
          <p className="text-caption">{summary.weakestMetric.copy}</p>
          <p className="tabular text-caption text-text-muted">
            {formatRate(summary.weakestMetric.rate)} across the weeks you logged
          </p>
        </section>
      )}

      <Link
        href="/start"
        className="flex min-h-tap items-center justify-center rounded-md bg-accent px-4 text-body font-medium text-accent-contrast"
      >
        Start block {block.blockNumber + 1}
      </Link>
      <p className="text-caption text-text-muted">
        Your lifts, targets and units carry over. Change whatever the last eight weeks taught you to
        change.
      </p>
    </main>
  );
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
  // The denominator is shown, not implied: 100% off nine logged days is not an
  // eight-week result and must not be able to read as one.
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
