import { NextRequest } from "next/server";
import { createHash } from "node:crypto";

import { checkRateLimit, getClientIp, paperbaseErrorResponse } from "@/lib/server/handler-utils";
import { getServerPaperbaseConfig } from "@/lib/server/config";
import { pricingBreakdown } from "@/lib/server/paperbase";
import type { PaperbasePricingBreakdownRequest, PaperbasePricingBreakdownResponse } from "@/types/paperbase";

type CacheEntry = {
  expiresAt: number;
  touchedAt: number;
  value: PaperbasePricingBreakdownResponse;
};

const INITIATE_CACHE_TTL_MS = 60_000;
const INITIATE_CACHE_MAX_ENTRIES = 1500;
const initiateCache = new Map<string, CacheEntry>();
const initiateInFlight = new Map<string, Promise<PaperbasePricingBreakdownResponse>>();

function normalizedItems(items: PaperbasePricingBreakdownRequest["items"]) {
  return [...items]
    .map((item) => ({
      product_public_id: item.product_public_id,
      variant_public_id: item.variant_public_id ?? "",
      quantity: item.quantity,
    }))
    .sort((a, b) => {
      const aKey = `${a.product_public_id}:${a.variant_public_id}`;
      const bKey = `${b.product_public_id}:${b.variant_public_id}`;
      return aKey.localeCompare(bKey);
    });
}

function buildInitiateCacheKey(payload: PaperbasePricingBreakdownRequest): string {
  const tenantHash = createHash("sha256")
    .update(getServerPaperbaseConfig().publishableKey)
    .digest("hex");
  const requestFingerprint = JSON.stringify({
    items: normalizedItems(payload.items),
    shipping_zone_public_id: payload.shipping_zone_public_id ?? "",
    shipping_method_public_id: payload.shipping_method_public_id ?? "",
  });
  const payloadHash = createHash("sha256").update(requestFingerprint).digest("hex");
  return `checkout:initiate:${tenantHash}:${payloadHash}`;
}

function gcInitiateCache() {
  const now = Date.now();
  for (const [key, entry] of initiateCache.entries()) {
    if (entry.expiresAt <= now) {
      initiateCache.delete(key);
    }
  }
  if (initiateCache.size <= INITIATE_CACHE_MAX_ENTRIES) {
    return;
  }
  const ordered = [...initiateCache.entries()].sort((a, b) => a[1].touchedAt - b[1].touchedAt);
  const toDrop = initiateCache.size - INITIATE_CACHE_MAX_ENTRIES;
  for (const [key] of ordered.slice(0, toDrop)) {
    initiateCache.delete(key);
  }
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers.get("x-forwarded-for"));
  const limited = checkRateLimit(`checkout:initiate:${ip}`, 60, 60_000);
  if (!limited.ok) {
    return new Response(null, { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } });
  }

  try {
    const body = (await request.json()) as PaperbasePricingBreakdownRequest & Record<string, unknown>;
    if (!body?.items || !Array.isArray(body.items) || body.items.length === 0) {
      return Response.json({ detail: "items must be a non-empty array." }, { status: 400 });
    }
    const sanitised: PaperbasePricingBreakdownRequest = {
      items: body.items.map(({ product_public_id, variant_public_id, quantity }) => ({
        product_public_id,
        ...(variant_public_id ? { variant_public_id } : {}),
        quantity,
      })),
      ...(body.shipping_zone_public_id ? { shipping_zone_public_id: body.shipping_zone_public_id } : {}),
      ...(body.shipping_method_public_id ? { shipping_method_public_id: body.shipping_method_public_id } : {}),
    };
    const cacheKey = buildInitiateCacheKey(sanitised);
    const now = Date.now();
    const cached = initiateCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      cached.touchedAt = now;
      return Response.json(cached.value, {
        headers: {
          "X-Initiate-Cache": "HIT",
        },
      });
    }

    const active = initiateInFlight.get(cacheKey);
    if (active) {
      const shared = await active;
      return Response.json(shared, {
        headers: {
          "X-Initiate-Cache": "INFLIGHT_HIT",
        },
      });
    }

    const requestPromise = pricingBreakdown(sanitised)
      .then((result) => {
        initiateCache.set(cacheKey, {
          value: result,
          expiresAt: Date.now() + INITIATE_CACHE_TTL_MS,
          touchedAt: Date.now(),
        });
        gcInitiateCache();
        return result;
      })
      .finally(() => {
        initiateInFlight.delete(cacheKey);
      });
    initiateInFlight.set(cacheKey, requestPromise);
    const result = await requestPromise;
    return Response.json(result, {
      headers: {
        "X-Initiate-Cache": "MISS",
      },
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ detail: "Invalid JSON body." }, { status: 400 });
    }
    return paperbaseErrorResponse(error);
  }
}
