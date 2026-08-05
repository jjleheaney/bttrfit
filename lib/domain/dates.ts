import type { IsoDate } from "./types";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

/** Rejects both malformed strings and impossible dates ("2026-02-30"), which
 * `Date.UTC` would otherwise silently roll forward. */
export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== "string") return false;
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [, year, month, day] = match;
  const utc = Date.UTC(Number(year), Number(month) - 1, Number(day));
  return fromEpochDay(utc / MS_PER_DAY) === value;
}

function assertIsoDate(value: IsoDate): void {
  if (!isIsoDate(value)) {
    throw new RangeError(`Expected a YYYY-MM-DD date, received "${value}"`);
  }
}

/** Days since the Unix epoch. All date maths goes through this, in UTC, so it
 * is immune to local time and daylight saving. */
export function toEpochDay(date: IsoDate): number {
  assertIsoDate(date);
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / MS_PER_DAY;
}

export function fromEpochDay(epochDay: number): IsoDate {
  const date = new Date(epochDay * MS_PER_DAY);
  const year = String(date.getUTCFullYear()).padStart(4, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromEpochDay(toEpochDay(date) + days);
}

/** Signed day count from `from` to `to`. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return toEpochDay(to) - toEpochDay(from);
}

export function compareDates(a: IsoDate, b: IsoDate): number {
  return toEpochDay(a) - toEpochDay(b);
}

/** Inclusive at both ends. */
export function datesBetween(from: IsoDate, to: IsoDate): IsoDate[] {
  const span = daysBetween(from, to);
  if (span < 0) return [];
  return Array.from({ length: span + 1 }, (_, index) => addDays(from, index));
}
