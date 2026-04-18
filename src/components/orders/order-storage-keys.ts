import type { PaperbaseOrderReceipt } from "@/types/paperbase";

/**
 * sessionStorage key prefix for the last-known order receipt, keyed by `public_id`.
 *
 * The storefront API intentionally exposes no GET endpoint for orders — the
 * payment view is therefore driven entirely from the receipt returned by
 * `POST /orders/` (on entry) and `POST /orders/<id>/payment/` (on submission).
 * We cache the latest receipt in sessionStorage so that a refresh on this page
 * preserves the correct state (form / awaiting / confirmed) instead of crashing.
 */
export const ORDER_RECEIPT_STORAGE_KEY_PREFIX = "paperbase-order-receipt:";

/** flag key (per order) to dedupe `triggerPurchase` across refreshes. */
export const PURCHASE_FIRED_KEY_PREFIX = "paperbase-purchase-fired:";

function storageKey(publicId: string) {
  return `${ORDER_RECEIPT_STORAGE_KEY_PREFIX}${publicId}`;
}

export function readStoredOrder(publicId: string): PaperbaseOrderReceipt | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey(publicId));
    if (!raw) return null;
    return JSON.parse(raw) as PaperbaseOrderReceipt;
  } catch {
    return null;
  }
}

export function writeStoredOrder(order: PaperbaseOrderReceipt): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(storageKey(order.public_id), JSON.stringify(order));
  } catch {
    // sessionStorage unavailable — best effort only.
  }
}
