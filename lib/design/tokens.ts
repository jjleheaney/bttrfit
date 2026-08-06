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
  /** The dark theme's page colour. Not a plate: the gym floor. */
  black: "#0A0A0A",
} as const;

/**
 * The semantic roles, per theme, exactly as `app/globals.css` defines them.
 * Dark is the default, so it is listed first.
 *
 * `contrast.test.ts` reads this map and fails the build on any pair that drops
 * below WCAG AA, which is what stops a shade being "adjusted later" into an
 * unreadable one.
 */
export const themes = {
  dark: {
    ground: plate.black,
    surface: "#121212",
    surfaceRaised: "#1F1F22",
    field: "#1A1A1A",
    text: "#FFFFFF",
    textMuted: "#ABABAB",
    line: "#303034",
    accent: "#5B8DFF",
    accentContrast: plate.black,
    hit: "#22C55E",
    hitContrast: "#06130C",
    miss: "#FF6B7D",
    missContrast: plate.black,
    attention: plate.yellow,
    attentionContrast: plate.black,
  },
  light: {
    ground: plate.steel,
    surface: plate.chalk,
    surfaceRaised: "#FFFFFF",
    field: "#FFFFFF",
    text: plate.ink,
    textMuted: "#5B6270",
    line: "#D4D8DE",
    accent: plate.blue,
    accentContrast: "#FFFFFF",
    /** Darker than the plate green: #00843D on the steel ground is 3.96:1. */
    hit: "#00722F",
    hitContrast: "#FFFFFF",
    miss: plate.red,
    missContrast: "#FFFFFF",
    /** Plate yellow cannot reach 3:1 on a light ground, so the light theme uses
     * it darkened rather than using a colour that means nothing else. */
    attention: "#A37C00",
    attentionContrast: plate.ink,
  },
} as const;

export const chart = {
  light: {
    rollingAverage: themes.light.accent,
    dailyPoint: "#9AA2AE",
    grid: themes.light.line,
    axis: plate.slate,
  },
  dark: {
    rollingAverage: themes.dark.accent,
    dailyPoint: "#6B6B70",
    grid: themes.dark.line,
    axis: themes.dark.textMuted,
  },
} as const;

export const status = {
  hit: plate.green,
  miss: plate.red,
  unanswered: plate.yellow,
} as const;

export type ThemeName = keyof typeof themes;

/** The role names every component colour resolves to. */
export type ColorRole = keyof (typeof themes)["dark"];
