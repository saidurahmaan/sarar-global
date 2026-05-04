import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { routing } from "@/i18n/routing";

const intlMiddleware = createMiddleware(routing);

type StoreLocale = (typeof routing.locales)[number];

const LOCALE_SET = new Set<StoreLocale>(routing.locales);

function isStoreLocale(value: string): value is StoreLocale {
  return LOCALE_SET.has(value as StoreLocale);
}

function resolveBackendBaseUrl(): string | null {
  const raw = process.env.PAPERBASE_API_URL?.trim();
  if (!raw) return null;
  const origin = raw.replace(/\/api\/v1\/?$/, "").replace(/\/+$/, "");
  return `${origin}/api/v1`;
}

async function resolveStoreLocale(): Promise<StoreLocale | null> {
  const baseUrl = resolveBackendBaseUrl();
  const publishableKey = process.env.PAPERBASE_PUBLISHABLE_KEY;
  if (!baseUrl || !publishableKey) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`${baseUrl}/store/public/`, {
      method: "GET",
      headers: { Authorization: `Bearer ${publishableKey}` },
      next: { revalidate: 300 },
      signal: controller.signal,
    }).finally(() => {
      clearTimeout(timeout);
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { language?: string };
    const locale = (data.language || "").toLowerCase();
    return isStoreLocale(locale) ? locale : "en";
  } catch (error) {
    console.error("[i18n] Failed to resolve store locale in middleware.", error);
    return null;
  }
}

function redirectToLocale(request: NextRequest, locale: string, suffix = "") {
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${suffix}`;
  return NextResponse.redirect(url);
}

export default async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const storeLocale = await resolveStoreLocale();
  if (!storeLocale) {
    return intlMiddleware(request);
  }

  if (pathname === "/") {
    return redirectToLocale(request, storeLocale);
  }

  const localeMatch = pathname.match(/^\/(en|bn)(\/.*)?$/);
  if (localeMatch) {
    const currentLocale = localeMatch[1];
    const suffix = localeMatch[2] || "";
    if (currentLocale !== storeLocale) {
      return redirectToLocale(request, storeLocale, suffix);
    }
    return intlMiddleware(request);
  }

  return redirectToLocale(request, storeLocale, pathname);
}

export const config = {
  matcher: ["/", "/(en|bn)/:path*", "/((?!api|_next|.*\\..*).*)"],
};
