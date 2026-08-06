import { addDays, weekdayNumber } from "./dates";
import type { IsoDate, UnitPreference } from "./types";

/** 1.8g of protein per kg of bodyweight. Offered, not imposed. */
export const PROTEIN_G_PER_KG = 1.8;
export const KG_PER_LB = 0.45359237;
export const DEFAULT_WEEKLY_DRINKS_TARGET = 3;

export function toKilograms(weight: number, unit: UnitPreference): number {
  return unit === "kg" ? weight : weight * KG_PER_LB;
}

export function fromKilograms(kilograms: number, unit: UnitPreference): number {
  return unit === "kg" ? kilograms : kilograms / KG_PER_LB;
}

/**
 * Rounded to the nearest 5g: a protein target is a daily decision, not a
 * measurement, and 171g reads as precision the number does not have.
 */
export function suggestedProteinTarget(weight: number, unit: UnitPreference): number {
  const grams = toKilograms(weight, unit) * PROTEIN_G_PER_KG;
  return Math.round(grams / 5) * 5;
}

/**
 * Blocks default to the next Monday, which is when people believe they will
 * start. Starting today stays one tap away, because the person who wants to
 * start now should not be told to wait.
 */
export function nextMonday(today: IsoDate): IsoDate {
  const weekday = weekdayNumber(today);
  return addDays(today, 8 - weekday);
}

export function startDateOptions(today: IsoDate): { today: IsoDate; nextMonday: IsoDate } {
  return { today, nextMonday: nextMonday(today) };
}

export type ParsedNumber = { value: number } | { error: string };

/**
 * Input parsing lives here rather than in the form so that the rules are tested
 * once and cannot differ between the setup flow and the daily check-in.
 */
export function parseWeight(raw: string, unit: UnitPreference): ParsedNumber {
  const value = Number(raw.trim().replace(",", "."));
  if (!raw.trim() || Number.isNaN(value)) {
    return { error: "Enter a weight." };
  }
  const kilograms = toKilograms(value, unit);
  if (kilograms < 30 || kilograms > 400) {
    return { error: unit === "kg" ? "Enter a weight in kg." : "Enter a weight in lbs." };
  }
  return { value: Math.round(value * 10) / 10 };
}

export function parseDecimal(
  raw: string,
  { min, max, label }: { min: number; max: number; label: string },
): ParsedNumber {
  const value = Number(raw.trim().replace(",", "."));
  if (!raw.trim() || Number.isNaN(value)) {
    return { error: `Enter ${label.toLowerCase()}.` };
  }
  if (value < min || value > max) {
    return { error: `${label} must be between ${min} and ${max}.` };
  }
  return { value: Math.round(value * 10) / 10 };
}

export function parseInteger(
  raw: string,
  { min, max, label }: { min: number; max: number; label: string },
): ParsedNumber {
  const value = Number(raw.trim());
  if (!raw.trim() || !Number.isInteger(value)) {
    return { error: `${label} must be a whole number.` };
  }
  if (value < min || value > max) {
    return { error: `${label} must be between ${min} and ${max}.` };
  }
  return { value };
}
