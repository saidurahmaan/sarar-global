/**
 * Post-deploy cache warmer: GETs storefront URLs (sitemap + critical + optional API fallback)
 * so CDN edges pull fresh HTML. Run: npx tsx scripts/warm-cache.ts
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const CONCURRENCY = 5;
const FETCH_TIMEOUT_MS = 30_000;
const LOCALES = ["en", "bn"] as const;

type Paginated<T> = {
  results?: T[];
};

type ProductRow = { slug?: string };
type CategoryRow = { slug?: string };

function loadEnvLocal(): void {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) {
    console.error(`[warm-cache] Missing required env: ${name}`);
    process.exit(1);
  }
  return v;
}

function normalizeOrigin(url: string): string {
  return url.replace(/\/+$/, "");
}

function toAbsoluteSiteUrl(siteBase: string, pathOrUrl: string): string {
  const p = pathOrUrl.trim();
  if (p.startsWith("http://") || p.startsWith("https://")) {
    return p;
  }
  const base = normalizeOrigin(siteBase);
  const path = p.startsWith("/") ? p : `/${p}`;
  return `${base}${path}`;
}

function criticalPaths(): string[] {
  const paths: string[] = [];
  for (const loc of LOCALES) {
    paths.push(`/${loc}`);
    paths.push(`/${loc}/blog`);
  }
  return paths;
}

function parseSitemapLocs(xml: string): string[] {
  const out: string[] = [];
  const re = /<loc>\s*([^<]+?)\s*<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const loc = m[1]?.trim();
    if (loc) out.push(loc);
  }
  return out;
}

function shouldSkipWarmUrl(absoluteUrl: string, siteBase: string): boolean {
  try {
    const u = new URL(absoluteUrl);
    if (u.pathname.startsWith("/api/")) return true;
    const site = new URL(siteBase);
    if (u.origin !== site.origin) {
      console.warn(`[warm-cache] skipping off-origin URL: ${absoluteUrl}`);
      return true;
    }
  } catch {
    console.warn(`[warm-cache] skipping invalid URL: ${absoluteUrl}`);
    return true;
  }
  return false;
}

function paperbaseApiBase(): string {
  const raw = process.env.PAPERBASE_API_URL?.trim();
  if (!raw) return "";
  const origin = raw.replace(/\/api\/v1\/?$/i, "").replace(/\/+$/, "");
  return `${origin}/api/v1/`;
}

async function fetchJson<T>(url: string, headers: Record<string, string>): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { ...headers, "Cache-Control": "no-cache" },
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[warm-cache] API ${url} → ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (e) {
    console.warn(`[warm-cache] API fetch failed ${url}: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function collectFallbackUrls(siteBase: string): Promise<string[]> {
  const apiBase = paperbaseApiBase();
  const key = process.env.PAPERBASE_PUBLISHABLE_KEY?.trim();
  if (!apiBase || !key) {
    console.warn("[warm-cache] fallback skipped: PAPERBASE_API_URL or PAPERBASE_PUBLISHABLE_KEY unset");
    return [];
  }
  const auth = { Authorization: `Bearer ${key}` };
  const urls: string[] = [];

  const productsUrl = `${apiBase}products/?page_size=100`;
  const products = await fetchJson<Paginated<ProductRow>>(productsUrl, auth);
  const productRows = products?.results ?? [];
  for (const row of productRows) {
    const slug = typeof row.slug === "string" ? row.slug.trim() : "";
    if (!slug) continue;
    for (const loc of LOCALES) {
      urls.push(toAbsoluteSiteUrl(siteBase, `/${loc}/products/${encodeURIComponent(slug)}`));
    }
  }

  const categoriesUrl = `${apiBase}categories/?page_size=100`;
  const categories = await fetchJson<Paginated<CategoryRow>>(categoriesUrl, auth);
  const categoryRows = categories?.results ?? [];
  for (const row of categoryRows) {
    const slug = typeof row.slug === "string" ? row.slug.trim() : "";
    if (!slug) continue;
    for (const loc of LOCALES) {
      urls.push(toAbsoluteSiteUrl(siteBase, `/${loc}/categories/${encodeURIComponent(slug)}`));
    }
  }

  return urls;
}

async function fetchSitemapUrls(siteBase: string): Promise<string[] | null> {
  const sitemapUrl = `${normalizeOrigin(siteBase)}/sitemap.xml`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(sitemapUrl, {
      method: "GET",
      headers: { "Cache-Control": "no-cache" },
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[warm-cache] sitemap ${sitemapUrl} → ${res.status}`);
      return null;
    }
    const xml = await res.text();
    const locs = parseSitemapLocs(xml);
    if (locs.length === 0) {
      console.warn("[warm-cache] sitemap contained no <loc> entries");
      return null;
    }
    const absolute = locs.map((loc) => {
      if (loc.startsWith("http://") || loc.startsWith("https://")) return loc;
      return toAbsoluteSiteUrl(siteBase, loc);
    });
    return absolute.filter((u) => !shouldSkipWarmUrl(u, siteBase));
  } catch (e) {
    console.warn(
      `[warm-cache] sitemap fetch failed: ${e instanceof Error ? e.message : String(e)}`,
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}

type WarmResult = { url: string; ok: boolean; status: number; ms: number };

async function warmOne(url: string): Promise<WarmResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const start = performance.now();
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "Cache-Control": "no-cache" },
      signal: controller.signal,
    });
    const ms = Math.round(performance.now() - start);
    const ok = res.ok;
    console.info(`[warm-cache] ${url} → ${res.status} (${ms}ms)`);
    return { url, ok, status: res.status, ms };
  } catch (e) {
    const ms = Math.round(performance.now() - start);
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[warm-cache] ${url} → FAILED (${ms}ms) ${msg}`);
    return { url, ok: false, status: 0, ms };
  } finally {
    clearTimeout(timer);
  }
}

async function runPool(urls: string[], concurrency: number): Promise<WarmResult[]> {
  const results: WarmResult[] = [];
  let index = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const i = index;
      index += 1;
      if (i >= urls.length) return;
      const r = await warmOne(urls[i]!);
      results[i] = r;
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, urls.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function dedupe(urls: string[]): string[] {
  return [...new Set(urls)];
}

async function main(): Promise<void> {
  loadEnvLocal();
  const siteBase = requireEnv("NEXT_PUBLIC_SITE_URL");

  const critical = criticalPaths().map((p) => toAbsoluteSiteUrl(siteBase, p));

  let fromSitemap = await fetchSitemapUrls(siteBase);
  let allUrls: string[] = [...critical];

  if (fromSitemap !== null) {
    allUrls = dedupe([...critical, ...fromSitemap]);
    console.info(`[warm-cache] using sitemap + critical (${allUrls.length} URLs)`);
  } else {
    const fallback = await collectFallbackUrls(siteBase);
    allUrls = dedupe([...critical, ...fallback]);
    console.info(
      `[warm-cache] sitemap unavailable; using critical + API fallback (${allUrls.length} URLs)`,
    );
  }

  const started = performance.now();
  const results = await runPool(allUrls, CONCURRENCY);
  const totalMs = Math.round(performance.now() - started);

  const success = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  const total = results.length;

  console.info("[warm-cache] summary", {
    totalUrls: total,
    success,
    failed,
    totalTimeMs: totalMs,
  });

  const failRate = total === 0 ? 0 : failed / total;
  if (failRate > 0.2) {
    console.error(`[warm-cache] failure rate ${(failRate * 100).toFixed(1)}% exceeds 20%`);
    process.exit(1);
  }
  process.exit(0);
}

void main().catch((err: unknown) => {
  console.error("[warm-cache] fatal", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
