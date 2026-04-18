"use client";

import { create } from "zustand";

import type { CartItem, CartMap } from "@/types/cart";

const CART_STORAGE_KEY = "sarar-global-cart";

type CartState = {
  /** Primary cart — keyed by `${product_public_id}::${variant_public_id ?? "default"}` */
  itemsMap: CartMap;
  hydrated: boolean;
  cartPanelOpen: boolean;
  /**
   * Temporary checkout map for Buy Now flows.
   * Populated by `startBuyNow`, never persisted.
   * When non-null the checkout view reads from this map instead of `itemsMap`.
   */
  buyNowMap: CartMap | null;
  openCartPanel: () => void;
  closeCartPanel: () => void;
  hydrateCart: () => void;
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeItem: (productPublicId: string, variantPublicId?: string) => void;
  increment: (productPublicId: string, variantPublicId?: string) => void;
  decrement: (productPublicId: string, variantPublicId?: string) => void;
  clear: () => void;
  /**
   * Stateless Buy Now — clones `itemsMap`, merges the given item, and stores
   * the result in `buyNowMap` WITHOUT touching `itemsMap`.
   */
  startBuyNow: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  clearBuyNow: () => void;
  /**
   * Updates an existing line to a new variant (or refreshes fields) without changing
   * the logical line when the variant id is unchanged. When the variant id changes,
   * the line is moved to a new map key and quantity is clamped to the new max.
   */
  updateItemVariant: (
    productPublicId: string,
    oldVariantPublicId: string | undefined,
    updates: Omit<CartItem, "quantity">,
  ) => void;
};

export function getItemKey(productPublicId: string, variantPublicId?: string) {
  return `${productPublicId}::${variantPublicId ?? "default"}`;
}

function persistMap(map: CartMap) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(map));
}

function clampToMax(quantity: number, maxQuantity?: number) {
  if (maxQuantity == null || !Number.isFinite(maxQuantity)) return quantity;
  return Math.min(quantity, Math.max(0, maxQuantity));
}

function newLineKey(): string {
  try {
    return globalThis.crypto.randomUUID();
  } catch {
    return `lk_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }
}

function assignMissingLineKeys(map: CartMap): { map: CartMap; changed: boolean } {
  let changed = false;
  const next: CartMap = { ...map };
  for (const key of Object.keys(next)) {
    const item = next[key];
    if (!item) continue;
    if (!item.line_key) {
      next[key] = { ...item, line_key: newLineKey() };
      changed = true;
    }
  }
  return { map: next, changed };
}

/**
 * Reads localStorage and normalises the value to a `CartMap`.
 * Handles backward-compat migration from the previous `CartItem[]` format.
 */
function loadMapFromStorage(): CartMap {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(CART_STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    // Migration: old format was an array
    if (Array.isArray(parsed)) {
      const migrated: CartMap = {};
      for (const item of parsed as CartItem[]) {
        const key = getItemKey(item.product_public_id, item.variant_public_id);
        migrated[key] = item;
      }
      persistMap(migrated);
      return migrated;
    }
    return parsed as CartMap;
  } catch {
    return {};
  }
}

/**
 * Core merge: inserts or quantity-merges `item` into a map clone.
 * Always returns a new object — never mutates the input map.
 */
function mergeItemIntoMap(
  map: CartMap,
  item: Omit<CartItem, "quantity">,
  quantity: number,
): CartMap {
  const safeQty = Math.max(1, quantity);
  const key = getItemKey(item.product_public_id, item.variant_public_id);
  const existing = map[key];

  if (existing) {
    const maxQ = item.max_quantity ?? existing.max_quantity;
    return {
      ...map,
      [key]: {
        ...existing,
        line_key: existing.line_key ?? item.line_key ?? newLineKey(),
        quantity: clampToMax(existing.quantity + safeQty, maxQ),
        max_quantity: maxQ ?? existing.max_quantity,
        product_slug: item.product_slug ?? existing.product_slug,
        price: item.price,
        name: item.name,
        image_url: item.image_url ?? existing.image_url,
        variant_public_id: item.variant_public_id ?? existing.variant_public_id,
        variant_details: item.variant_details ?? existing.variant_details,
        prepayment_type: item.prepayment_type ?? existing.prepayment_type,
      },
    };
  }

  const maxQ = item.max_quantity;
  return {
    ...map,
    [key]: {
      ...item,
      line_key: item.line_key ?? newLineKey(),
      quantity: clampToMax(safeQty, maxQ),
      max_quantity: maxQ,
    },
  };
}

export const useCartStore = create<CartState>((set, get) => ({
  itemsMap: {},
  hydrated: false,
  cartPanelOpen: false,
  buyNowMap: null,

  openCartPanel: () => set({ cartPanelOpen: true }),
  closeCartPanel: () => set({ cartPanelOpen: false }),

  hydrateCart: () => {
    const loaded = loadMapFromStorage();
    const { map, changed } = assignMissingLineKeys(loaded);
    if (changed) persistMap(map);
    set({ itemsMap: map, hydrated: true });
  },

  addItem: (item, quantity = 1) => {
    const nextMap = mergeItemIntoMap(get().itemsMap, item, quantity);
    persistMap(nextMap);
    set({ itemsMap: nextMap });
  },

  removeItem: (productPublicId, variantPublicId) => {
    const key = getItemKey(productPublicId, variantPublicId);
    const { [key]: _removed, ...nextMap } = get().itemsMap;
    persistMap(nextMap);
    set({ itemsMap: nextMap });
  },

  increment: (productPublicId, variantPublicId) => {
    const key = getItemKey(productPublicId, variantPublicId);
    const existing = get().itemsMap[key];
    if (!existing) return;
    const cap = existing.max_quantity ?? Number.MAX_SAFE_INTEGER;
    if (existing.quantity >= cap) return;
    const nextMap = {
      ...get().itemsMap,
      [key]: { ...existing, quantity: existing.quantity + 1 },
    };
    persistMap(nextMap);
    set({ itemsMap: nextMap });
  },

  decrement: (productPublicId, variantPublicId) => {
    const key = getItemKey(productPublicId, variantPublicId);
    const existing = get().itemsMap[key];
    if (!existing || existing.quantity <= 1) return;
    const nextMap = {
      ...get().itemsMap,
      [key]: { ...existing, quantity: existing.quantity - 1 },
    };
    persistMap(nextMap);
    set({ itemsMap: nextMap });
  },

  clear: () => {
    persistMap({});
    set({ itemsMap: {} });
  },

  startBuyNow: (item, quantity = 1) => {
    const merged = mergeItemIntoMap(get().itemsMap, item, quantity);
    const { map } = assignMissingLineKeys(merged);
    set({ buyNowMap: map });
  },

  clearBuyNow: () => set({ buyNowMap: null }),

  updateItemVariant: (productPublicId, oldVariantPublicId, updates) => {
    const state = get();
    const isBuyNow = state.buyNowMap != null;
    const sourceMap = isBuyNow ? state.buyNowMap! : state.itemsMap;
    const oldKey = getItemKey(productPublicId, oldVariantPublicId);
    const existing = sourceMap[oldKey];
    if (!existing) return;

    const newKey = getItemKey(productPublicId, updates.variant_public_id);
    const merged: CartItem = {
      ...existing,
      ...updates,
      quantity: existing.quantity,
    };
    const clampedQty = clampToMax(merged.quantity, merged.max_quantity);
    const nextItem: CartItem = { ...merged, quantity: clampedQty };

    let nextMap: CartMap;
    if (newKey === oldKey) {
      nextMap = { ...sourceMap, [oldKey]: nextItem };
    } else {
      const rest = { ...sourceMap };
      delete rest[oldKey];
      const { quantity: qty, ...payload } = nextItem;
      nextMap = mergeItemIntoMap(rest, payload, qty);
    }

    if (isBuyNow) {
      set({ buyNowMap: nextMap });
    } else {
      persistMap(nextMap);
      set({ itemsMap: nextMap });
    }
  },
}));
