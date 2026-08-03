/**
 * Single source of truth for the raw palette.
 *
 * The CSS custom properties in `app/globals.css` mirror these values; anything
 * that cannot read CSS variables (charts, canvas, manifest, meta tags) imports
 * from here so the two never drift.
 */
export const plate = {
  ink: "#0E1116",
  steel: "#E7E9ED",
  chalk: "#FAFAF8",
  slate: "#6B7280",
  blue: "#1B4FD8",
  green: "#00843D",
  red: "#C8102E",
  yellow: "#F2C200",
} as const;

export const chart = {
  light: {
    rollingAverage: plate.blue,
    dailyPoint: "#9AA2AE",
    grid: "#D4D8DE",
    axis: plate.slate,
  },
  dark: {
    rollingAverage: "#4C7DFF",
    dailyPoint: "#4B5563",
    grid: "#2B323C",
    axis: "#9AA2AE",
  },
} as const;

export const status = {
  hit: plate.green,
  miss: plate.red,
  unanswered: plate.yellow,
} as const;

export type ThemeName = "light" | "dark";
