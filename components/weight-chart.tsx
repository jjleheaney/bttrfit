import type { UnitPreference, WeightPoint } from "@/lib/domain";
import { formatDay } from "@/lib/format";

const WIDTH = 320;
const HEIGHT = 96;
const PADDING_Y = 8;

/**
 * Raw weigh-ins as small low-contrast dots, the trailing mean as one bold line:
 * the average is the story, the dots are the evidence. A teaching device as much
 * as a chart, so it never smooths, never extrapolates, and never joins across a
 * gap in the rolling average.
 */
export function WeightChart({
  points,
  unit,
}: {
  points: WeightPoint[];
  unit: UnitPreference;
}) {
  const values = points.flatMap((point) =>
    [point.weight, point.rollingAverage].filter((value): value is number => value !== null),
  );

  if (values.length === 0) {
    return (
      <p className="text-caption text-text-muted">
        No weigh-ins yet this block. Weigh in on the check-in screen and the trend starts here.
      </p>
    );
  }

  const lowest = Math.min(...values);
  const highest = Math.max(...values);
  // A flat block would otherwise divide by zero and, worse, draw noise as drama.
  const span = Math.max(highest - lowest, 1);
  const x = (index: number) =>
    points.length === 1 ? WIDTH / 2 : (index / (points.length - 1)) * WIDTH;
  const y = (value: number) =>
    PADDING_Y + ((highest - value) / span) * (HEIGHT - PADDING_Y * 2);

  // Broken into runs so a stretch with too few weigh-ins for a mean leaves a gap
  // rather than a straight line the user would read as a measurement.
  const runs: string[] = [];
  let run: string[] = [];
  points.forEach((point, index) => {
    if (point.rollingAverage === null) {
      if (run.length > 1) runs.push(run.join(" "));
      run = [];
      return;
    }
    run.push(`${x(index).toFixed(1)},${y(point.rollingAverage).toFixed(1)}`);
  });
  if (run.length > 1) runs.push(run.join(" "));

  const averaged = points.filter((point) => point.rollingAverage !== null);
  const first = averaged[0];
  const last = averaged.at(-1);

  return (
    <figure className="flex flex-col gap-1">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-24 w-full overflow-visible"
        role="img"
        aria-label={
          first && last && first !== last
            ? `Weight trend from ${first.rollingAverage?.toFixed(1)}${unit} on ${formatDay(first.date)} to ${last.rollingAverage?.toFixed(1)}${unit} on ${formatDay(last.date)}`
            : "Weight trend, not enough weigh-ins yet for a seven day average"
        }
      >
        {points.map((point, index) =>
          point.weight === null ? null : (
            <circle
              key={point.date}
              cx={x(index)}
              cy={y(point.weight)}
              r={1.8}
              className="fill-text-muted opacity-70"
            />
          ),
        )}
        {runs.map((run) => (
          <polyline
            key={run}
            points={run}
            fill="none"
            strokeWidth={2}
            strokeLinecap="round"
            className="stroke-accent"
          />
        ))}
      </svg>
      <figcaption className="flex justify-between gap-2 text-caption text-text-muted">
        <span>
          {runs.length === 0
            ? "A 7-day average needs four weigh-ins"
            : "Dots are days, the line is the 7-day average"}
        </span>
        <span className="tabular shrink-0">
          {lowest.toFixed(1)}–{highest.toFixed(1)}
          {unit}
        </span>
      </figcaption>
    </figure>
  );
}
