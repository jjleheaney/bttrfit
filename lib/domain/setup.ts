import type { UnitPreference } from "./types";

/** 1.8g of protein per kg of bodyweight. Offered, not imposed. */
export const PROTEIN_G_PER_KG = 1.8;
export const KG_PER_LB = 0.45359237;
export const DEFAULT_WEEKLY_DRINKS_TARGET = 3;

/**
 * Four drinks a week, and no way to ask for more.
 *
 * Alcohol is the one input here that works against every other one at once —
 * it suppresses protein synthesis, wrecks the sleep the training is recovered
 * on, and arrives with food nobody counts. A target of twelve is not a target,
 * it is a note of what already happens, and a target of zero is the one people
 * abandon in week two and then stop opening the app rather than admit to. The
 * ceiling exists so the number stays a decision instead of a description.
 */
export const MAX_WEEKLY_DRINKS_TARGET = 4;

/** Every allowed answer, in the order they are offered. */
export const WEEKLY_DRINKS_OPTIONS = [0, 1, 2, 3, 4] as const;

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
