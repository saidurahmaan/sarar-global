"use client";

import { useEffect, useMemo } from "react";
import useSWR from "swr";

import { ThemeContext, type ThemeConfig } from "./ThemeContext";
import { applyTheme } from "./applyTheme";
import { THEME_LS_KEY, THEME_LS_VERSION_KEY } from "./themeCacheKeys";

export const STOREFRONT_THEME_SWR_KEY = "/api/v1/theming";

function readLocalFallback(): ThemeConfig | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const stored = localStorage.getItem(THEME_LS_KEY);
    const storedVersion = localStorage.getItem(THEME_LS_VERSION_KEY);
    if (!stored || !storedVersion) return undefined;
    const parsed = JSON.parse(stored) as ThemeConfig;
    if (
      !parsed.palette_version ||
      typeof parsed.palette_version !== "string" ||
      parsed.palette_version !== storedVersion
    ) {
      return undefined;
    }
    if (!parsed.palette || !parsed.resolved_palette) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

async function fetchTheme(): Promise<ThemeConfig> {
  const res = await fetch(STOREFRONT_THEME_SWR_KEY, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `theme_fetch_${res.status}`);
  }
  return res.json() as Promise<ThemeConfig>;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const fallbackData = useMemo(() => readLocalFallback(), []);

  const { data } = useSWR(STOREFRONT_THEME_SWR_KEY, fetchTheme, {
    dedupingInterval: 5 * 60 * 1000,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    fallbackData,
    shouldRetryOnError: true,
    errorRetryCount: 2,
  });

  const themeValue: ThemeConfig | null = useMemo(() => {
    if (!data?.palette || !data?.palette_version || !data?.resolved_palette) return null;
    return {
      palette: data.palette,
      palette_version: data.palette_version,
      resolved_palette: data.resolved_palette,
    };
  }, [data]);

  useEffect(() => {
    if (data?.resolved_palette) {
      applyTheme(data.resolved_palette);
      try {
        const storedVersion = localStorage.getItem(THEME_LS_VERSION_KEY);
        if (storedVersion !== data.palette_version) {
          localStorage.setItem(THEME_LS_KEY, JSON.stringify(data));
          localStorage.setItem(THEME_LS_VERSION_KEY, data.palette_version);
        }
      } catch {
        /* ignore quota */
      }
      return;
    }
    const fb = readLocalFallback();
    if (fb?.resolved_palette) applyTheme(fb.resolved_palette);
  }, [data]);

  return (
    <ThemeContext.Provider value={themeValue}>{children}</ThemeContext.Provider>
  );
}
