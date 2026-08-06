import { formatTopSet, type LiftProgress, type UnitPreference } from "@/lib/domain";

const STATUS_LABEL = { improved: "Improved", maintained: "Held", declined: "Declined" } as const;

/**
 * One sentinel lift across a whole block: the top set the user actually pressed
 * at the start and at the finish, with the e1RM comparison as the small print.
 * A lift's first and last logged weeks are rarely 1 and 8, so both are named.
 */
export function LiftRow({ lift, unit }: { lift: LiftProgress; unit: UnitPreference }) {
  if (lift.first === null || lift.last === null) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-dotted border-line px-3 py-2">
        <p className="text-caption text-text-muted">{lift.displayName}</p>
        <p className="text-caption text-text-muted">Never logged</p>
      </div>
    );
  }

  const started = lift.first.weekNumber;
  const finished = lift.last.weekNumber;

  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-line bg-surface px-3 py-2">
      <div>
        <p className="text-caption text-text-muted">{lift.displayName}</p>
        <p className="tabular text-lead leading-tight">
          {formatTopSet(lift.first, unit)}
          {started === finished ? "" : ` → ${formatTopSet(lift.last, unit)}`}
        </p>
        <p className="tabular text-caption text-text-muted">
          week {started}
          {started === finished ? " only" : ` to week ${finished}`}
        </p>
      </div>
      <p
        className={`shrink-0 text-caption font-medium ${
          lift.status === "improved" ? "text-hit" : lift.status === "declined" ? "text-miss" : ""
        }`}
      >
        {lift.status === null ? "One week" : STATUS_LABEL[lift.status]}
        {/* Exactly no change reads as "Held" without a signed zero after it. */}
        {lift.change === null || Math.abs(lift.change * 100) < 0.05
          ? ""
          : ` ${lift.change > 0 ? "+" : "−"}${Math.abs(lift.change * 100).toFixed(1)}%`}
      </p>
    </div>
  );
}
