import "server-only";

import type { PaperbaseStorePublic } from "@/types/paperbase";

/**
 * Paperbase storefront tracking uses hosted `tracker.js` + their ingest.
 * Do not add custom Meta Pixel / CAPI here.
 */
export function getTrackerScriptSrc(store: PaperbaseStorePublic): string {
  if (!store.tracking_enabled) {
    return "";
  }
  return store.tracker_script_src ?? "";
}
