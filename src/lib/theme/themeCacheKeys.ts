/**
 * Inline script + ThemeProvider must stay aligned on localStorage keys.
 * Cache validity uses `palette_version` from the API (hash of palette definitions).
 * `data-theme-mode` is derived from `resolved_palette.header` (fallback: `background`) in applyTheme + FOUC.
 */
export const THEME_LS_KEY = "sf_theme_cache";
export const THEME_LS_VERSION_KEY = "sf_theme_cache_version";

export function getStoredVersion(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(THEME_LS_VERSION_KEY);
}
