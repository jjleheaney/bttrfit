import type { IsoDate, UnitPreference } from "@/lib/domain";

/**
 * Presentation only. Dates are formatted in UTC because the string itself is
 * already the user's calendar day: shifting it into a local zone would rename it.
 */
function asUtcDate(date: IsoDate): Date {
  return new Date(`${date}T12:00:00Z`);
}

const dayLabel = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const longDayLabel = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

export function formatDay(date: IsoDate): string {
  return dayLabel.format(asUtcDate(date));
}

export function formatLongDay(date: IsoDate): string {
  return longDayLabel.format(asUtcDate(date));
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
