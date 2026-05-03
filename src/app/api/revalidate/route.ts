import { timingSafeEqual } from "crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { purgeCloudflareUrls } from "@/lib/server/cloudflare-purge";

const LOCALES = ["en", "bn"] as const;

const WEBHOOK_ENTITY_TYPES = [
  "product",
  "category",
  "banner",
  "popup",
  "notification",
  "blog",
  "store",
] as const;

type WebhookEntityType = (typeof WEBHOOK_ENTITY_TYPES)[number];

type WebhookPayload = {
  event: string;
  type: WebhookEntityType;
  slug?: string;
  store_public_id: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isWebhookEntityType(value: unknown): value is WebhookEntityType {
  return typeof value === "string" && (WEBHOOK_ENTITY_TYPES as readonly string[]).includes(value);
}

function parseWebhookPayload(body: unknown): WebhookPayload | null {
  if (!isRecord(body)) return null;
  const { event, type, slug, store_public_id } = body;
  if (typeof event !== "string" || event.trim() === "") return null;
  if (!isWebhookEntityType(type)) return null;
  if (typeof store_public_id !== "string" || store_public_id.trim() === "") return null;
  if (slug !== undefined && typeof slug !== "string") return null;
  return {
    event: event.trim(),
    type,
    store_public_id: store_public_id.trim(),
    ...(typeof slug === "string" && slug !== "" ? { slug: slug.trim() } : {}),
  };
}

function timingSafeSecretMatch(expected: string, received: string | null): boolean {
  const a = Buffer.from(expected, "utf8");
  if (received === null) {
    return false;
  }
  const b = Buffer.from(received, "utf8");
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

function normalizeSiteBase(): string | null {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}

function absoluteUrls(pathSuffixes: string[]): string[] {
  const base = normalizeSiteBase();
  if (!base) return [];
  return pathSuffixes.map((p) => `${base}${p.startsWith("/") ? "" : "/"}${p}`);
}

function revalidateProduct(slug: string): { revalidatedPaths: string[]; purgePaths: string[] } {
  const revalidatedPaths: string[] = [];
  const purgePaths: string[] = [];
  for (const loc of LOCALES) {
    const productPath = `/${loc}/products/${slug}`;
    revalidatePath(productPath);
    revalidatedPaths.push(productPath);
    purgePaths.push(productPath);
  }
  for (const loc of LOCALES) {
    const categoriesPath = `/${loc}/categories`;
    revalidatePath(categoriesPath, "layout");
    revalidatedPaths.push(`${categoriesPath} (layout)`);
  }
  for (const loc of LOCALES) {
    const home = `/${loc}`;
    revalidatePath(home);
    revalidatedPaths.push(home);
    purgePaths.push(home);
  }
  return { revalidatedPaths, purgePaths };
}

function revalidateCategory(slug: string): { revalidatedPaths: string[]; purgePaths: string[] } {
  const revalidatedPaths: string[] = [];
  const purgePaths: string[] = [];
  for (const loc of LOCALES) {
    const p = `/${loc}/categories/${slug}`;
    revalidatePath(p);
    revalidatedPaths.push(p);
    purgePaths.push(p);
  }
  for (const loc of LOCALES) {
    const home = `/${loc}`;
    revalidatePath(home);
    revalidatedPaths.push(home);
    purgePaths.push(home);
  }
  return { revalidatedPaths, purgePaths };
}

function revalidateHomepagesOnly(): { revalidatedPaths: string[]; purgePaths: string[] } {
  const revalidatedPaths: string[] = [];
  const purgePaths: string[] = [];
  for (const loc of LOCALES) {
    const home = `/${loc}`;
    revalidatePath(home);
    revalidatedPaths.push(home);
    purgePaths.push(home);
  }
  return { revalidatedPaths, purgePaths };
}

function revalidateBlog(slug: string): { revalidatedPaths: string[]; purgePaths: string[] } {
  const revalidatedPaths: string[] = [];
  const purgePaths: string[] = [];
  for (const loc of LOCALES) {
    const postPath = `/${loc}/blog/${slug}`;
    revalidatePath(postPath);
    revalidatedPaths.push(postPath);
    purgePaths.push(postPath);
  }
  for (const loc of LOCALES) {
    const indexPath = `/${loc}/blog`;
    revalidatePath(indexPath);
    revalidatedPaths.push(indexPath);
    purgePaths.push(indexPath);
  }
  return { revalidatedPaths, purgePaths };
}

function revalidateStore(): { revalidatedPaths: string[]; purgePaths: string[] } {
  revalidatePath("/", "layout");
  const revalidatedPaths = ["/ (root layout)"];
  const purgePaths: string[] = [];
  for (const loc of LOCALES) {
    const home = `/${loc}`;
    purgePaths.push(home);
  }
  return { revalidatedPaths, purgePaths };
}

function runRevalidation(
  payload: WebhookPayload,
): { revalidatedPaths: string[]; purgePaths: string[] } {
  switch (payload.type) {
    case "product": {
      const slug = payload.slug;
      if (!slug) return { revalidatedPaths: [], purgePaths: [] };
      return revalidateProduct(slug);
    }
    case "category": {
      const slug = payload.slug;
      if (!slug) return { revalidatedPaths: [], purgePaths: [] };
      return revalidateCategory(slug);
    }
    case "banner":
    case "popup":
    case "notification":
      return revalidateHomepagesOnly();
    case "blog": {
      const slug = payload.slug;
      if (!slug) return { revalidatedPaths: [], purgePaths: [] };
      return revalidateBlog(slug);
    }
    case "store":
      return revalidateStore();
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  let rawBody = "";
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ detail: "Could not read body" }, { status: 400 });
  }

  const secret = process.env.REVALIDATE_SECRET;
  if (secret === undefined || secret === "") {
    console.error("[revalidate] missing_REVALIDATE_SECRET");
    return NextResponse.json({ detail: "Revalidation is not configured" }, { status: 500 });
  }

  const headerSecret = request.headers.get("x-webhook-secret");

  let storePublicIdForLog = "unknown";
  try {
    const loose = JSON.parse(rawBody) as unknown;
    if (isRecord(loose) && typeof loose.store_public_id === "string") {
      storePublicIdForLog = loose.store_public_id;
    }
  } catch {
    // ignore
  }

  if (!timingSafeSecretMatch(secret, headerSecret)) {
    console.warn("[revalidate] unauthorized_webhook", {
      store_public_id: storePublicIdForLog,
      note: "X-Webhook-Secret mismatch or missing",
    });
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json({ detail: "Invalid JSON" }, { status: 400 });
  }

  const payload = parseWebhookPayload(parsedJson);
  if (!payload) {
    return NextResponse.json({ detail: "Malformed payload" }, { status: 400 });
  }

  if (
    (payload.type === "product" || payload.type === "category" || payload.type === "blog") &&
    (!payload.slug || payload.slug.trim() === "")
  ) {
    return NextResponse.json(
      { detail: `Missing slug for type "${payload.type}"` },
      { status: 400 },
    );
  }

  try {
    const { revalidatedPaths, purgePaths } = runRevalidation(payload);

    const base = normalizeSiteBase();
    if (!base) {
      console.warn("[revalidate] skipped_cloudflare_purge_missing_NEXT_PUBLIC_SITE_URL", {
        store_public_id: payload.store_public_id,
        event: payload.event,
        type: payload.type,
      });
    }

    const purgeUrls = absoluteUrls(purgePaths);

    console.info("[revalidate] revalidated", {
      store_public_id: payload.store_public_id,
      event: payload.event,
      type: payload.type,
      paths: revalidatedPaths,
    });

    void purgeCloudflareUrls(purgeUrls).then(() => {
      console.info("[revalidate] cloudflare_purge_finished", {
        store_public_id: payload.store_public_id,
        event: payload.event,
        type: payload.type,
        purgeUrlCount: purgeUrls.length,
        cloudflareConfigured: Boolean(base && purgeUrls.length > 0),
      });
    });

    return NextResponse.json({
      revalidated: true,
      event: payload.event,
      type: payload.type,
    });
  } catch (err) {
    console.error("[revalidate] unexpected_error", {
      store_public_id: payload.store_public_id,
      event: payload.event,
      type: payload.type,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ detail: "Revalidation failed" }, { status: 500 });
  }
}
