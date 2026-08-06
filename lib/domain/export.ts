import type { DailyEntry, IsoDate, SentinelLift, UnitPreference } from "./types";
import { liftE1RM } from "./lifts";
import { weekNumberFor } from "./weeks";

/**
 * The user's data, in the one format every spreadsheet and every coach can read.
 *
 * Pure on purpose: the same functions produce the file the web app downloads and
 * whatever a future React Native client writes to disk, and they can be tested
 * without a request.
 */

export type CsvCell = string | number | boolean | null | undefined;

/**
 * Excel and Sheets read a leading `=`, `+`, `-` or `@` as a formula, so a note
 * typed as "=1+1" runs on open — and the same trick reaches external data and
 * shell prompts. Prefixing a tab defuses it while leaving the text readable, and
 * it only ever applies to what the user typed themselves.
 */
function defuseFormula(text: string): string {
  return /^[=+\-@\t\r]/.test(text) ? `\t${text}` : text;
}

/**
 * RFC 4180 quoting. Notes are free text, so a comma or a newline in one would
 * otherwise shift every later column of that row into the wrong field.
 */
function csvCell(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  const text = typeof value === "boolean" ? (value ? "yes" : "no") : defuseFormula(value);
  return /[",\r\n\t]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(header: readonly string[], rows: readonly CsvCell[][]): string {
  // CRLF and a trailing newline: what Excel expects, and what stops the last row
  // being silently dropped by stricter parsers.
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export type ExportBlock = {
  blockNumber: number;
  startDate: IsoDate;
  entries: DailyEntry[];
  lifts: SentinelLift[];
};

const DAILY_HEADER = [
  "block",
  "week",
  "date",
  "weight",
  "unit",
  "protein_hit",
  "workout_done",
  "sleep_hit",
  "steps_hit",
  "drinks",
  "notes",
] as const;

/**
 * One row per day the user answered anything, across every block.
 *
 * Unanswered metrics stay empty rather than becoming `no`: the distinction
 * between "did not hit protein" and "did not log" is the whole reason the
 * columns are nullable, and flattening it here would make the export lie.
 */
export function dailyEntriesCsv(blocks: readonly ExportBlock[], unit: UnitPreference): string {
  const rows = blocks.flatMap((block) =>
    block.entries.map((entry) => [
      block.blockNumber,
      weekNumberFor(block.startDate, entry.entryDate),
      entry.entryDate,
      entry.weight,
      entry.weight === null ? null : unit,
      entry.proteinHit,
      entry.workoutDone,
      entry.sleepHit,
      entry.stepsHit,
      entry.drinks,
      entry.notes ?? null,
    ]),
  );

  return toCsv(DAILY_HEADER, rows);
}

const LIFT_HEADER = [
  "block",
  "week",
  "slot",
  "lift",
  "reps",
  "weight",
  "unit",
  "estimated_1rm",
] as const;

/**
 * One row per logged top set. `estimated_1rm` is Epley, rounded to one decimal —
 * the same number the app compares week to week, so an export and the screen
 * cannot disagree.
 */
export function liftEntriesCsv(blocks: readonly ExportBlock[], unit: UnitPreference): string {
  const rows = blocks.flatMap((block) =>
    block.lifts.flatMap((lift) =>
      lift.entries.map((entry) => [
        block.blockNumber,
        entry.weekNumber,
        lift.slot,
        lift.displayName,
        entry.reps,
        entry.weight,
        unit,
        Math.round(liftE1RM(entry) * 10) / 10,
      ]),
    ),
  );

  return toCsv(LIFT_HEADER, rows);
}
