import type { SheetCell, SheetRow } from "@/lib/domain";
import { formatDay } from "@/lib/format";

/**
 * Six metrics by seven days, one solid square per cell. The week grid is the
 * element this app should be remembered for, so it gets room and no decoration.
 */
export function ContactSheet({ rows, weekdays }: { rows: SheetRow[]; weekdays: string[] }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-[4.5rem_repeat(7,1fr)] items-center gap-1">
        <span />
        {weekdays.map((weekday, index) => (
          <span
            key={index}
            aria-hidden
            className="tabular text-center text-caption text-text-muted"
          >
            {weekday}
          </span>
        ))}
      </div>

      {rows.map((row) => (
        <div key={row.key} className="grid grid-cols-[4.5rem_repeat(7,1fr)] items-center gap-1">
          <span className="text-caption text-text-muted">{row.label}</span>
          {row.cells.map((cell) => (
            <Cell key={cell.date} cell={cell} row={row.label} />
          ))}
        </div>
      ))}
    </div>
  );
}

function Cell({ cell, row }: { cell: SheetCell; row: string }) {
  const title = `${row}, ${formatDay(cell.date)}: ${cell.label}`;

  if (cell.state === "future") {
    return <Square title={title} className="border border-dotted border-line" />;
  }

  if (cell.state === "unanswered") {
    return <Square title={title} className="border border-dotted border-attention" />;
  }

  if (cell.state === "miss") {
    return <Square title={title} className="border border-text" />;
  }

  if (cell.fill === null) {
    return <Square title={title} className="bg-hit" />;
  }

  // The two proportional rows: a fill height rather than a status colour, because
  // neither weight nor a drink is a pass or a fail on its own.
  return (
    <Square title={title} className="relative border border-line">
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 bg-text"
        style={{ height: `${Math.round(cell.fill * 100)}%` }}
      />
    </Square>
  );
}

function Square({
  title,
  className,
  children,
}: {
  title: string;
  className: string;
  children?: React.ReactNode;
}) {
  return (
    <span role="img" aria-label={title} title={title} className="block">
      <span className={`block aspect-square w-full overflow-hidden rounded-sm ${className}`}>
        {children}
      </span>
    </span>
  );
}
