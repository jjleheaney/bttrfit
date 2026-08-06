import Link from "next/link";
import { redirect } from "next/navigation";
import {
  WEEKS_PER_BLOCK,
  compareLiftWeek,
  contactSheet,
  weekDates,
  weekNumberFor,
  weekSummary,
  weekdayNumber,
  formatTopSet,
  weightSeries,
  type LiftWeekComparison,
  type MetricCompliance,
  type UnitPreference,
} from "@/lib/domain";
import { getBlockContext } from "@/lib/data/blocks";
import { currentDate } from "@/lib/data/today";
import { ContactSheet } from "@/components/contact-sheet";
import { WeightChart } from "@/components/weight-chart";
import { formatDay, formatDelta, formatRate, formatWeight } from "@/lib/format";

/** Indexed by `weekdayNumber`, which is 1 for Monday: block weeks are anchored to
 * the block start date, so a week rarely begins on a Monday. */
const WEEKDAY_INITIALS = ["", "M", "T", "W", "T", "F", "S", "S"];

export default async function WeekPage({
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

  const { block, entries, lifts, profile } = context;
  const unit = profile.unitPreference;
  const requested = Number(params.week);
  // Before day one there is no current week; the block's first week is the only
  // honest thing to show.
  const currentWeek = weekNumberFor(block.startDate, today) ?? 1;
  const weekNumber =
    Number.isInteger(requested) && requested >= 1 && requested <= WEEKS_PER_BLOCK
      ? requested
      : currentWeek;

  const summary = weekSummary(block, entries, lifts, weekNumber, today);
  const sheet = contactSheet(entries, block, weekNumber, today);
  // The trend reads across the whole block to date, not just this week: seven
  // points cannot show a trend, which is the lesson the chart exists to teach.
  const trend = weightSeries(
    entries,
    Array.from({ length: weekNumber }, (_, index) => weekDates(block.startDate, index + 1)).flat(),
  );

  const { compliance, verdict } = summary;
  const dates = weekDates(block.startDate, weekNumber);
  // Every sentinel lift gets a card, logged or not: three cards that sometimes
  // say "not logged" beat a list that silently shrinks.
  const liftCards = lifts
    .slice()
    .sort((a, b) => a.slot - b.slot)
    .map((lift) => ({
      name: lift.displayName,
      comparison: compareLiftWeek(lift, weekNumber),
    }));

  return (
    <main className="flex flex-1 flex-col gap-4 px-4 pt-3 pb-4">
      <header className="flex items-baseline justify-between gap-2">
        <div>
          <h1 className="font-display text-title uppercase tracking-tight">Week {weekNumber}</h1>
          <p className="tabular text-caption text-text-muted">
            {formatDay(summary.startDate)} – {formatDay(summary.endDate)} ·{" "}
            {summary.daysElapsed === 7 ? "complete" : `day ${summary.daysElapsed} of 7`}
          </p>
        </div>
        <nav aria-label="Week" className="flex items-center gap-1">
          <WeekArrow week={weekNumber - 1} label="Previous week">
            ‹
          </WeekArrow>
          <WeekArrow week={weekNumber + 1} label="Next week" max={currentWeek}>
            ›
          </WeekArrow>
        </nav>
      </header>

      <section
        aria-labelledby="verdict"
        className="flex flex-col gap-1 rounded-md border border-line bg-surface px-3 py-3"
      >
        <p className="text-caption uppercase tracking-wide text-text-muted">Verdict</p>
        <h2
          id="verdict"
          className={`font-display text-display uppercase leading-none tracking-tight ${
            verdict.conclusive ? "" : "text-text-muted"
          }`}
        >
          {verdict.label}
        </h2>
        <p className="text-caption text-text-muted">{verdict.message}</p>
        {summary.weeklyDelta !== null && (
          <p className="tabular text-caption">
            Week average {summary.weightAverage === null ? "—" : formatWeight(summary.weightAverage, unit)}
            , {formatDelta(summary.weeklyDelta, unit)} on week {weekNumber - 1}
            {summary.blockDelta === null ? "" : `, ${formatDelta(summary.blockDelta, unit)} on the block`}
          </p>
        )}
      </section>

      <section aria-labelledby="trend" className="flex flex-col gap-2">
        <h2 id="trend" className="text-caption uppercase tracking-wide text-text-muted">
          Weight, block to date
        </h2>
        <WeightChart points={trend} unit={unit} />
      </section>

      <section aria-labelledby="sheet" className="flex flex-col gap-2">
        <h2 id="sheet" className="text-caption uppercase tracking-wide text-text-muted">
          The week
        </h2>
        <ContactSheet
          rows={sheet}
          weekdays={dates.map((date) => WEEKDAY_INITIALS[weekdayNumber(date)])}
        />
      </section>

      <section aria-labelledby="compliance" className="flex flex-col gap-1">
        <h2 id="compliance" className="text-caption uppercase tracking-wide text-text-muted">
          Compliance · {compliance.daysLogged} of {summary.daysElapsed} days logged
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
          value={`${compliance.totalDrinks} of ${compliance.weeklyDrinksTarget}`}
          status={
            compliance.drinksTargetMet === null ? null : compliance.drinksTargetMet ? "hit" : "miss"
          }
        />
      </section>

      <section aria-labelledby="lifts" className="flex flex-col gap-2">
        <h2 id="lifts" className="text-caption uppercase tracking-wide text-text-muted">
          Sentinel lifts
        </h2>
        {summary.lifts.length === 0 && (
          <p className="text-caption text-text-muted">
            No lifts logged for week {weekNumber} yet. Log them to see whether you are holding
            strength.{" "}
            <Link href={`/lifts?week=${weekNumber}`} className="underline">
              Log week {weekNumber} lifts
            </Link>
          </p>
        )}
        {liftCards.map((card) => (
          <LiftCard
            key={card.name}
            comparison={card.comparison}
            name={card.name}
            unit={unit}
          />
        ))}
      </section>

      {summary.focus && (
        <section
          aria-labelledby="focus"
          className="flex flex-col gap-1 rounded-md border border-line bg-surface px-3 py-2"
        >
          <h2 id="focus" className="text-caption uppercase tracking-wide text-text-muted">
            Next week, fix one thing
          </h2>
          <p className="text-caption">{summary.focus.copy}</p>
        </section>
      )}

      {summary.notes.length > 0 && (
        <section aria-labelledby="notes" className="flex flex-col gap-1">
          <h2 id="notes" className="text-caption uppercase tracking-wide text-text-muted">
            Notes
          </h2>
          {summary.notes.map((note) => (
            <p key={note.date} className="text-caption text-text-muted">
              <span className="tabular">{formatDay(note.date)}</span> — {note.note}
            </p>
          ))}
        </section>
      )}
    </main>
  );
}

function WeekArrow({
  week,
  label,
  max = WEEKS_PER_BLOCK,
  children,
}: {
  week: number;
  label: string;
  max?: number;
  children: React.ReactNode;
}) {
  // A week that has not started has nothing to show, so the arrow is absent
  // rather than leading to an empty screen.
  if (week < 1 || week > max) {
    return (
      <span aria-hidden className="min-h-tap w-tap leading-[3rem] text-center text-text-muted opacity-30">
        {children}
      </span>
    );
  }

  return (
    <Link
      href={`/week?week=${week}`}
      aria-label={label}
      className="min-h-tap w-tap flex items-center justify-center text-lead"
    >
      {children}
    </Link>
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
  // The days-logged denominator is shown, not implied: 100% off two days is not a
  // strong week and must not be able to read as one.
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

const STATUS_LABEL = { improved: "Improved", maintained: "Held", declined: "Declined" } as const;

function LiftCard({
  comparison,
  name,
  unit,
}: {
  comparison: LiftWeekComparison | null;
  name: string;
  unit: UnitPreference;
}) {
  if (!comparison) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-dotted border-line px-3 py-2">
        <p className="text-caption text-text-muted">{name}</p>
        <p className="text-caption text-text-muted">Not logged</p>
      </div>
    );
  }

  const { current, status, change, e1rm } = comparison;

  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-line bg-surface px-3 py-2">
      <div>
        <p className="text-caption text-text-muted">{name}</p>
        <p className="tabular text-lead leading-tight">{formatTopSet(current, unit)}</p>
      </div>
      <div className="text-right">
        <p
          className={`text-caption font-medium ${
            status === "improved" ? "text-hit" : status === "declined" ? "text-miss" : ""
          }`}
        >
          {status === null ? "First entry" : STATUS_LABEL[status]}
        </p>
        <p
          className="tabular text-caption text-text-muted"
          title="Estimated one-rep max, used only to compare across rep ranges"
        >
          e1RM {e1rm.toFixed(1)}
          {unit}
          {change === null ? "" : ` (${change > 0 ? "+" : "−"}${Math.abs(change * 100).toFixed(1)}%)`}
        </p>
      </div>
    </div>
  );
}
