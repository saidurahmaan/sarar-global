"use client"

import { createContext, useContext } from "react"

export interface ResolvedPalette {
  background: string
  foreground: string
  header: string
  "header-foreground": string
  primary: string
  "primary-foreground": string
  secondary: string
  "secondary-foreground": string
  muted: string
  "muted-foreground": string
  accent: string
  "accent-foreground": string
  card: string
  "card-foreground": string
  popover: string
  "popover-foreground": string
  border: string
  input: string
  ring: string
}

export interface ThemeConfig {
  palette: string
  palette_version: string
  resolved_palette: ResolvedPalette
}

export const ThemeContext = createContext<ThemeConfig | null>(null)
export const useTheme = () => useContext(ThemeContext)
