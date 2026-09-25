export const THEMES = ["system", "dark"] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_COOKIE = "kodigo-theme";

export function parseTheme(value: unknown): Theme {
  return THEMES.includes(value as Theme) ? (value as Theme) : "system";
}
