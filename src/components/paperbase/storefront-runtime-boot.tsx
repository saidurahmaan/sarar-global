"use client";

import { useEffect } from "react";

import {
  getBrowserPaperbaseBackendOrigin,
  PAPERBASE_PRODUCTION_API_ORIGIN,
} from "@/lib/paperbase-public";

type StorefrontRuntimeBootProps = {
  publishableKey: string;
  trackerSrc: string | null;
};

export function StorefrontRuntimeBoot({ publishableKey, trackerSrc }: StorefrontRuntimeBootProps) {
  useEffect(() => {
    const runtimeWindow = window as { PAPERBASE_PUBLISHABLE_KEY?: string };
    if (!publishableKey) {
      delete runtimeWindow.PAPERBASE_PUBLISHABLE_KEY;
      return;
    }
    runtimeWindow.PAPERBASE_PUBLISHABLE_KEY = publishableKey;
  }, [publishableKey]);

  useEffect(() => {
    const rewriteOrigin = getBrowserPaperbaseBackendOrigin();
    if (!rewriteOrigin) return;

    const w = window as Window & { __storefrontFetchPatched?: boolean };
    if (w.__storefrontFetchPatched) return;
    w.__storefrontFetchPatched = true;

    const originalFetch = window.fetch;
    if (typeof originalFetch !== "function") return;

    window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
      const inputUrl =
        typeof input === "string"
          ? input
          : typeof Request !== "undefined" && input instanceof Request
            ? input.url
            : "";
      if (!inputUrl || !inputUrl.startsWith(PAPERBASE_PRODUCTION_API_ORIGIN)) {
        return originalFetch.call(this, input as RequestInfo | URL, init);
      }
      const rewrittenUrl = rewriteOrigin + inputUrl.slice(PAPERBASE_PRODUCTION_API_ORIGIN.length);
      if (typeof input === "string") {
        return originalFetch.call(this, rewrittenUrl, init);
      }
      if (typeof Request !== "undefined" && input instanceof Request) {
        return originalFetch.call(this, new Request(rewrittenUrl, input), init);
      }
      return originalFetch.call(this, rewrittenUrl, init);
    };
  }, []);

  useEffect(() => {
    if (!trackerSrc) return;
    const script = document.createElement("script");
    script.src = trackerSrc;
    script.async = true;
    document.head.appendChild(script);
    return () => {
      script.remove();
    };
  }, [trackerSrc]);

  return null;
}
