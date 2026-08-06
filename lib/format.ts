import type { IsoDate, UnitPreference } from "@/lib/domain";

/**
 * Presentation only. Dates are formatted in UTC because the string itself is
 * already the user's calendar day: shifting it into a local zone would rename it.
 */
function asUtcDate(date: IsoDate): Date {
  return new Date(`${date}T12:00:00Z`);
}

/**
 * The weekday is formatted apart from the date rather than in one pattern.
 *
 * Asking for all three at once lets ICU choose the separator, and it disagrees
 * with itself across versions — Node renders "Thu, 6 Aug" where the browser
 * renders "Thu 6 Aug", which React reports as a hydration mismatch on a screen
 * that shows the date at the top of every visit. Joining two formatters keeps
 * the server and the browser byte-identical.
 */
const weekdayShort = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" });
const weekdayLong = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" });

const dayMonthShort = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const dayMonthLong = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

export function formatDay(date: IsoDate): string {
  const value = asUtcDate(date);
  return `${weekdayShort.format(value)} ${dayMonthShort.format(value)}`;
}

export function formatLongDay(date: IsoDate): string {
  const value = asUtcDate(date);
  return `${weekdayLong.format(value)} ${dayMonthLong.format(value)}`;
}

export function formatWeight(weight: number, unit: UnitPreference): string {
  return `${weight.toFixed(1)}${unit}`;
}

export function formatRate(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`;
}

/** A signed change, where the sign is the point: "-1.2kg", "+0.4kg". */
export function formatDelta(delta: number | null, unit: UnitPreference): string {
  if (delta === null) return "—";
  const rounded = Math.abs(delta) < 0.05 ? 0 : delta;
  const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "";
  return `${sign}${Math.abs(rounded).toFixed(1)}${unit}`;
}
