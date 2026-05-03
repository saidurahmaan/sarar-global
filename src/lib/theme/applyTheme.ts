import type { ResolvedPalette } from "./ThemeContext"

function normalizeHex6(hex: string): string | null {
  let h = hex.trim()
  if (h.startsWith("#")) h = h.slice(1)
  if (h.length === 3 && /^[0-9a-fA-F]{3}$/.test(h)) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("")
  }
  if (h.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(h)) return null
  return h
}

/** Relative luminance; used to pick `data-theme-mode` for blend-mode overrides on dark UIs. */
export function isColorDark(hex: string): boolean {
  const h = normalizeHex6(hex)
  if (!h) return false
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance < 0.5
}

/**
 * Applies palette tokens as CSS custom properties on :root.
 * Keys from the API are already CSS variable names (with hyphens).
 * e.g. "primary-foreground" → "--primary-foreground"
 * One system. No mapping. No dual variables.
 */
export function applyTheme(palette: ResolvedPalette): void {
  if (typeof document === "undefined") return
  const root = document.documentElement
  Object.entries(palette).forEach(([key, value]) => {
    root.style.setProperty(`--${key}`, value)
  })
  root.style.removeProperty("background-color")
  const modeHex = palette["header"] ?? palette.background
  root.setAttribute("data-theme-mode", isColorDark(modeHex) ? "dark" : "light")
}
