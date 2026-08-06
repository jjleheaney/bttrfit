import type { LiftProgress, UnitPreference } from "@/lib/domain";
import { WEEKS_PER_BLOCK } from "@/lib/domain";

const WIDTH = 320;
const HEIGHT = 120;
const PADDING_Y = 10;

/**
 * The three sentinel lifts on one estimated-1RM axis, so "the bar held while
 * bodyweight fell" is a single glance rather than three comparisons.
 *
 * The lines are told apart by stroke pattern rather than colour: in this palette
 * green, red and yellow mean hit, missed and unanswered, and spending them on
 * lift identity would make a chart's colours lie about a status.
 */
const DASHES = ["", "6 3", "1.5 3"] as const;

export function LiftChart({
  lifts,
  unit,
}: {
  lifts: LiftProgress[];
  unit: UnitPreference;
}) {
  const values = lifts.flatMap((lift) =>
    lift.points.map((point) => point.e1rm).filter((value): value is number => value !== null),
  );

  if (values.length === 0) {
    return (
      <p className="text-caption text-text-muted">
        No lifts logged yet this block. Log a week&apos;s top sets and the progression starts here.
      </p>
    );
  }

  const lowest = Math.min(...values);
  const highest = Math.max(...values);
  // A single logged week, or three identical weeks, must not be drawn as drama.
  const span = Math.max(highest - lowest, 5);
  const x = (weekNumber: number) => ((weekNumber - 1) / (WEEKS_PER_BLOCK - 1)) * WIDTH;
  const y = (value: number) =>
    PADDING_Y + ((highest - value) / span) * (HEIGHT - PADDING_Y * 2);

  return (
    <figure className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-32 w-full overflow-visible"
        role="img"
        aria-label={lifts
          .map((lift) =>
            lift.first === null || lift.last === null
              ? `${lift.displayName} not logged`
              : `${lift.displayName} from an estimated ${e1rmOf(lift, "first")}${unit} in week ${lift.first.weekNumber} to ${e1rmOf(lift, "last")}${unit} in week ${lift.last.weekNumber}`,
          )
          .join(". ")}
      >
        {lifts.map((lift, index) => {
          // Broken into runs so an unlogged week leaves a gap rather than a line
          // through a week that was never trained.
          const runs: string[] = [];
          let run: string[] = [];
          lift.points.forEach((point) => {
            if (point.e1rm === null) {
              if (run.length > 1) runs.push(run.join(" "));
              run = [];
              return;
            }
            run.push(`${x(point.weekNumber).toFixed(1)},${y(point.e1rm).toFixed(1)}`);
          });
          if (run.length > 1) runs.push(run.join(" "));

          return (
            <g key={lift.liftKey} className="stroke-accent fill-accent">
              {runs.map((points) => (
                <polyline
                  key={points}
                  points={points}
                  fill="none"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeDasharray={DASHES[index] || undefined}
                />
              ))}
              {lift.points.map((point) =>
                point.e1rm === null ? null : (
                  <circle
                    key={point.weekNumber}
                    cx={x(point.weekNumber)}
                    cy={y(point.e1rm)}
                    r={2.2}
                    stroke="none"
                  />
                ),
              )}
            </g>
          );
        })}
      </svg>

      <figcaption className="flex flex-col gap-1">
        <ul className="flex flex-col gap-1">
          {lifts.map((lift, index) => (
            <li key={lift.liftKey} className="flex items-center gap-2 text-caption">
              <svg viewBox="0 0 24 4" className="h-1 w-6 shrink-0" aria-hidden>
                <line
                  x1="0"
                  y1="2"
                  x2="24"
                  y2="2"
                  strokeWidth={2}
                  strokeDasharray={DASHES[index] || undefined}
                  className="stroke-accent"
                />
              </svg>
              <span className="text-text-muted">{lift.displayName}</span>
            </li>
          ))}
        </ul>
        <p className="flex justify-between gap-2 text-caption text-text-muted">
          <span>Estimated 1RM, weeks 1–{WEEKS_PER_BLOCK}</span>
          <span className="tabular shrink-0">
            {lowest.toFixed(0)}–{highest.toFixed(0)}
            {unit}
          </span>
        </p>
      </figcaption>
    </figure>
  );
}

function e1rmOf(lift: LiftProgress, which: "first" | "last"): string {
  const entry = which === "first" ? lift.first : lift.last;
  if (!entry) return "—";
  const point = lift.points.find((candidate) => candidate.weekNumber === entry.weekNumber);
  return point?.e1rm?.toFixed(1) ?? "—";
}
