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

  if (cell.value === null) {
    return <Square title={title} className="bg-hit" />;
  }

  // The measured rows carry their own number, so the square is solid and the
  // figure sits on it: a week of weights and a week of drinks, both readable
  // without decoding a fill height. Red is reserved for the week going over.
  return (
    <Square
      title={title}
      className={`@container ${
        cell.state === "over" ? "bg-miss text-miss-contrast" : "bg-text text-ground"
      }`}
    >
      <span
        aria-hidden
        className="tabular flex h-full w-full items-center justify-center"
        // Shrinks with its own square rather than being clipped by it. Plex Mono
        // advances 0.6em per glyph, so the widest figure the grid draws — five,
        // as in "105.3" — needs a third of the cell. Above that width the token
        // wins and every cell in the row reads at the same size.
        style={{ fontSize: "min(var(--text-cell), 33cqw)" }}
      >
        {cell.value}
      </span>
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
