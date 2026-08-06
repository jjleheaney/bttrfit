import { describe, expect, it } from "vitest";
import { themes, type ColorRole, type ThemeName } from "./tokens";

/**
 * WCAG AA, enforced rather than asserted in a PR description.
 *
 * Every pair below is a combination the app actually renders. Retuning a shade in
 * `tokens.ts` (and its mirror in `globals.css`) is meant to be easy; retuning one
 * into something unreadable is meant to fail here.
 */

const AA_TEXT = 4.5;
/** Large text, and the minimum for a border or fill that carries meaning. */
const AA_LARGE = 3;

function channel(value: number): number {
  const srgb = value / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Text pairs: 4.5:1. */
const TEXT_PAIRS: [ColorRole, ColorRole][] = [
  // Primary and secondary copy on the page, on a card, and inside an input.
  ["text", "ground"],
  ["text", "surface"],
  ["text", "surfaceRaised"],
  ["text", "field"],
  ["textMuted", "ground"],
  ["textMuted", "surface"],
  ["textMuted", "surfaceRaised"],
  // Placeholders are muted text on the input background.
  ["textMuted", "field"],
  // Status words: "Improved", "Declined", a missed target, an unanswered metric.
  ["hit", "ground"],
  ["hit", "surface"],
  ["miss", "ground"],
  ["miss", "surface"],
  // Links and the rolling-average line's label.
  ["accent", "ground"],
  ["accent", "surface"],
  // Text drawn on a filled control: the primary button, a Yes/No answer.
  ["accentContrast", "accent"],
  ["hitContrast", "hit"],
  ["missContrast", "miss"],
  ["attentionContrast", "attention"],
];

/**
 * Borders, fills and chart strokes: 3:1, the non-text minimum. `attention` lives
 * here rather than above because it is only ever a border or a fill — the
 * unanswered state is drawn, never written in yellow.
 */
const NON_TEXT_PAIRS: [ColorRole, ColorRole][] = [
  ["accent", "ground"],
  ["hit", "ground"],
  ["miss", "ground"],
  ["attention", "ground"],
  ["attention", "surface"],
];

const NAMES: ThemeName[] = ["dark", "light"];

describe.each(NAMES)("%s theme", (name) => {
  const theme = themes[name];

  it.each(TEXT_PAIRS)("reads %s on %s at AA", (foreground, background) => {
    expect(contrastRatio(theme[foreground], theme[background])).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it.each(NON_TEXT_PAIRS)("draws %s on %s above the non-text floor", (foreground, background) => {
    expect(contrastRatio(theme[foreground], theme[background])).toBeGreaterThanOrEqual(AA_LARGE);
  });

  it("keeps a card, an input and the page visibly apart", () => {
    // Not a contrast requirement, a design one: if these collapse, a card stops
    // being a card and an input stops looking editable.
    expect(theme.surface).not.toBe(theme.ground);
    expect(theme.field).not.toBe(theme.ground);
  });

  it("keeps the line colour visible against every surface it borders", () => {
    for (const background of ["ground", "surface", "field"] as const) {
      expect(contrastRatio(theme.line, theme[background])).toBeGreaterThan(1.15);
    }
  });

  it("disables controls at 50% without dropping the label below the large-text floor", () => {
    // `disabled:opacity-50` composites the label towards the background, which is
    // the one interactive state a raw token pair does not describe.
    const faded = blend(theme.text, theme.ground, 0.5);
    expect(contrastRatio(faded, theme.ground)).toBeGreaterThanOrEqual(AA_LARGE);
  });
});

/** `alpha` of `foreground` composited over `background`, as opacity renders. */
function blend(foreground: string, background: string, alpha: number): string {
  const mix = (index: number) => {
    const a = parseInt(foreground.slice(index, index + 2), 16);
    const b = parseInt(background.slice(index, index + 2), 16);
    return Math.round(a * alpha + b * (1 - alpha))
      .toString(16)
      .padStart(2, "0");
  };
  return `#${mix(1)}${mix(3)}${mix(5)}`;
}
