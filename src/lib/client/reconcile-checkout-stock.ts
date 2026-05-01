import {
  readProductDetailCacheEntry,
  upsertProductDetailCache,
} from "@/lib/client/product-detail-cache";
import type { CartLineMutationScope } from "@/lib/store/cart-store";
import type { CartItem } from "@/types/cart";
import type { ProductDetail } from "@/types/product";

/** Matches `POST /api/v1/orders/` line quantity cap (STOREFRONT_INTEGRATION §7.16). */
const API_MAX_QTY = 1000;
const RECONCILE_CACHE_TTL_MS = 120_000;
const RECONCILE_CACHE_MAX_AGE_MS = 120_000;

function isFreshCacheEntry(entry: { fetchedAt?: number; expiresAt: number }): boolean {
  const now = Date.now();
  if (typeof entry.fetchedAt === "number") {
    return now - entry.fetchedAt < RECONCILE_CACHE_MAX_AGE_MS;
  }
  return entry.expiresAt > now;
}

function productRequestId(item: CartItem): string {
  return item.product_slug ?? item.product_public_id;
}

async function fetchProductDetail(item: CartItem): Promise<ProductDetail | null> {
  const id = productRequestId(item);
  try {
    const response = await fetch(`/api/products/${encodeURIComponent(id)}`);
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as ProductDetail;
  } catch {
    return null;
  }
}

export function effectiveLineCapacity(detail: ProductDetail, item: CartItem): { ok: boolean; max: number } {
  const variants = detail.variants ?? [];
  if (variants.length > 0) {
    const vid = item.variant_public_id;
    if (!vid) return { ok: false, max: 0 };
    const v = variants.find((x) => x.public_id === vid);
    if (!v) return { ok: false, max: 0 };
    if (v.stock_status === "out_of_stock" || v.available_quantity <= 0) {
      return { ok: false, max: 0 };
    }
    if (!detail.stock_tracking) return { ok: true, max: API_MAX_QTY };
    return { ok: true, max: Math.min(v.available_quantity, API_MAX_QTY) };
  }
  if (detail.stock_tracking) {
    if (detail.stock_status === "out_of_stock" || detail.available_quantity <= 0) {
      return { ok: false, max: 0 };
    }
    return { ok: true, max: Math.min(detail.available_quantity, API_MAX_QTY) };
  }
  return { ok: true, max: API_MAX_QTY };
}

/**
 * Re-reads product detail for each cart line and removes or clamps lines so the client
 * cart matches current availability before `POST /pricing/breakdown/` (via `/checkout/initiate`).
 */
export async function reconcileCheckoutStock(
  items: CartItem[],
  opts: {
    setLineQuantity: (
      productPublicId: string,
      variantPublicId: string | undefined,
      quantity: number,
      scope: CartLineMutationScope,
      patch?: { max_quantity?: number; unsetMaxQuantity?: boolean },
    ) => void;
    scope: CartLineMutationScope;
  },
): Promise<boolean> {
  if (items.length === 0) return false;

  const productIds = [...new Set(items.map((i) => i.product_public_id))];
  const detailByPid = new Map<string, ProductDetail>();
  const staleOrMissingLines: CartItem[] = [];

  for (const pid of productIds) {
    const line = items.find((i) => i.product_public_id === pid);
    if (!line) continue;
    const id = productRequestId(line);
    const cached = readProductDetailCacheEntry(id);
    if (cached && isFreshCacheEntry(cached)) {
      detailByPid.set(pid, cached.data);
      continue;
    }
    staleOrMissingLines.push(line);
  }

  await Promise.all(
    staleOrMissingLines.map(async (line) => {
      const detail = await fetchProductDetail(line);
      if (!detail) return;
      const id = productRequestId(line);
      upsertProductDetailCache(id, detail, RECONCILE_CACHE_TTL_MS);
      detailByPid.set(line.product_public_id, detail);
    }),
  );

  let changed = false;

  for (const item of items) {
    const detail = detailByPid.get(item.product_public_id);
    if (!detail) {
      opts.setLineQuantity(item.product_public_id, item.variant_public_id, 0, opts.scope);
      changed = true;
      continue;
    }

    const { ok, max } = effectiveLineCapacity(detail, item);
    if (!ok) {
      opts.setLineQuantity(item.product_public_id, item.variant_public_id, 0, opts.scope);
      changed = true;
      continue;
    }

    const nextQty = Math.min(item.quantity, max);
    if (nextQty !== item.quantity) {
      opts.setLineQuantity(item.product_public_id, item.variant_public_id, nextQty, opts.scope);
      changed = true;
    }
  }

  return changed;
}
