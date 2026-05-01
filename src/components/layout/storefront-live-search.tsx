"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { Link, useRouter } from "@/i18n/routing";
import { formatMoney } from "@/lib/format";
import { resolveStorefrontImageUrl, storefrontImageUnoptimized } from "@/lib/storefront-image";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

type LiveSearchProduct = {
  public_id: string;
  name: string;
  slug: string;
  price: string;
  original_price: string | null;
  image_url: string | null;
  brand: string | null;
  category_name: string;
};

type LiveSearchCategory = {
  public_id: string;
  name: string;
  slug: string;
};

type LiveSearchPayload = {
  products: LiveSearchProduct[];
  categories: LiveSearchCategory[];
  suggestions: string[];
  trending: boolean;
};

const DEBOUNCE_MS = 280;

function useDebouncedForSearch(trimmed: string): string {
  const [debounced, setDebounced] = useState(trimmed);
  const delay = trimmed.length >= 2 ? DEBOUNCE_MS : 0;

  useEffect(() => {
    const t = setTimeout(() => setDebounced(trimmed), delay);
    return () => clearTimeout(t);
  }, [trimmed, delay]);

  return debounced;
}

type StorefrontLiveSearchProps = {
  mode: "desktop" | "mobile";
  placeholder: string;
  submitAriaLabel: string;
  onAfterNavigate?: () => void;
};

export function StorefrontLiveSearch({
  mode,
  placeholder,
  submitAriaLabel,
  onAfterNavigate,
}: StorefrontLiveSearchProps) {
  const router = useRouter();
  const locale = useLocale() as Locale;
  const t = useTranslations("search");
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-focus whenever this search UI mounts (mobile drawer or desktop overlay).
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [mode]);

  const [query, setQuery] = useState("");
  const trimmed = query.trim();
  const debounced = useDebouncedForSearch(trimmed);
  const [panelOpen, setPanelOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [data, setData] = useState<LiveSearchPayload | null>(null);

  const fetchPayload = useCallback(async (signal: AbortSignal) => {
    const res = await fetch(`/api/storefront/search?q=${encodeURIComponent(debounced)}`, { signal });
    if (!res.ok) {
      throw new Error("search failed");
    }
    return (await res.json()) as LiveSearchPayload;
  }, [debounced]);

  useEffect(() => {
    if (!panelOpen) {
      return;
    }

    if (debounced.length < 2) {
      setData(null);
      setLoading(false);
      setError(false);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(false);
      try {
        const payload = await fetchPayload(controller.signal);
        if (!cancelled) {
          setData(payload);
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") {
          return;
        }
        if (!cancelled) {
          setError(true);
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [panelOpen, debounced, fetchPayload]);

  useEffect(() => {
    if (!panelOpen) {
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPanelOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [panelOpen]);

  useEffect(() => {
    if (!panelOpen || mode !== "desktop") {
      return;
    }

    const onPointerDown = (e: PointerEvent) => {
      const node = rootRef.current;
      if (node && !node.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [panelOpen, mode]);

  const hasListContent =
    Boolean(data?.products.length) ||
    Boolean(data?.categories.length) ||
    Boolean(data?.suggestions.length);
  const showViewAll = trimmed.length >= 2 && !loading && !error;

  const goSearchPage = useCallback(() => {
    const q = trimmed;
    router.push(`/search${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    setPanelOpen(false);
    onAfterNavigate?.();
  }, [trimmed, router, onAfterNavigate]);

  const panelClass = cn(
    "live-search-panel-scroll overflow-y-auto rounded-lg border border-black/10 bg-white py-2",
    mode === "desktop"
      ? "absolute start-0 end-0 top-[calc(100%+0.35rem)] z-[60] max-h-[min(70vh,520px)] shadow-xl ring-1 ring-black/5"
      : "mt-3 min-h-0 flex-1 shadow-md",
  );

  return (
    <div
      ref={rootRef}
      className={cn("w-full", mode === "desktop" && "relative", mode === "mobile" && "flex min-h-0 flex-1 flex-col")}
    >
      <form
        role="search"
        className={cn(
          "flex w-full items-center rounded-md border border-black/5 bg-white py-1 ps-4 pe-1 shadow-sm",
          mode === "desktop" && "h-10 border-black/35 bg-transparent py-0 pe-2 shadow-none",
          mode === "mobile" && "relative border-violet-200 py-1 pe-2",
        )}
        onSubmit={(e) => {
          e.preventDefault();
          goSearchPage();
        }}
      >
        <input
          ref={inputRef}
          type="text"
          name="q"
          inputMode="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setPanelOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          enterKeyHint="search"
          role="combobox"
          aria-expanded={panelOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          className={cn(
            "min-h-9 min-w-0 flex-1 border-none bg-transparent py-2 text-sm text-text outline-none placeholder:text-text/45",
            mode === "desktop" && "min-h-0 py-1 text-[12px] placeholder:text-black/35",
            mode === "mobile" && "min-h-11 py-2 pe-11 placeholder:text-neutral-400",
          )}
        />
        <button
          type="submit"
          aria-label={submitAriaLabel}
          className={cn(
            "inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-white transition hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
            mode === "desktop" &&
              "size-7 rounded-sm bg-transparent text-black/55 hover:bg-transparent hover:text-black/70 focus-visible:outline-primary",
            mode === "mobile" &&
              "absolute end-2 top-1/2 z-[1] -translate-y-1/2 bg-transparent text-text hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          )}
        >
          {(mode === "desktop" || mode === "mobile") && trimmed.length > 0 ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-[18px]"
              aria-hidden
            >
              <path d="M5 12h14" />
              <path d="m13 6 6 6-6 6" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-[18px]"
              aria-hidden
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          )}
        </button>
      </form>

      {panelOpen && trimmed.length >= 2 ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label={t("livePanelAria")}
          className={panelClass}
          onMouseDown={(e) => e.preventDefault()}
        >

          {loading ? (
            <p className="px-4 py-3 text-sm text-neutral-500">{t("liveLoading")}</p>
          ) : null}

          {error ? (
            <p className="px-4 py-3 text-sm text-red-600">{t("liveError")}</p>
          ) : null}

          {data?.categories.length ? (
            <div className="border-b border-neutral-100 px-3 py-2">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                {t("matchingCategories")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {data.categories.map((cat) => (
                  <Link
                    key={cat.public_id}
                    href={`/categories/${cat.slug}`}
                    role="option"
                    aria-selected={false}
                    className="rounded-sm border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-medium text-text hover:bg-neutral-100"
                    onClick={() => {
                      setPanelOpen(false);
                      onAfterNavigate?.();
                    }}
                  >
                    {cat.name}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          {data?.suggestions.length ? (
            <div className="border-b border-neutral-100 px-3 py-2">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                {t("suggestions")}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {data.suggestions.map((label) => (
                  <button
                    key={label}
                    type="button"
                    role="option"
                    aria-selected={false}
                    className="rounded-sm border border-violet-200/80 bg-violet-50/90 px-3 py-1 text-xs font-medium text-text hover:bg-violet-100"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setQuery(label);
                      inputRef.current?.focus();
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {data?.products.map((p) => {
            const imageSrc = resolveStorefrontImageUrl(p.image_url);
            return (
              <Link
                key={p.public_id}
                href={`/products/${p.slug}`}
                role="option"
                aria-selected={false}
                className="flex gap-3 px-3 py-2.5 hover:bg-neutral-50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setPanelOpen(false);
                  onAfterNavigate?.();
                }}
              >
                <div className="relative size-12 shrink-0 overflow-hidden rounded-sm bg-neutral-100">
                  {imageSrc ? (
                    <Image
                      src={imageSrc}
                      alt=""
                      width={48}
                      height={48}
                      className="size-full object-cover"
                      unoptimized={storefrontImageUnoptimized(imageSrc)}
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1 text-start">
                  <p className="truncate text-sm font-medium text-text">{p.name}</p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {p.brand ? `${p.brand} · ` : null}
                    {formatMoney(p.price, locale)}
                  </p>
                </div>
              </Link>
            );
          })}

          {!loading && !error && trimmed.length >= 2 && data && !hasListContent ? (
            <p className="px-4 py-3 text-sm text-neutral-600">{t("liveNoMatches")}</p>
          ) : null}

          {showViewAll ? (
            <div className="border-t border-neutral-100 px-2 pt-1 pb-2">
              <button
                type="button"
                className="w-full rounded-md px-3 py-2.5 text-start text-sm font-semibold text-primary hover:bg-primary/5"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => goSearchPage()}
              >
                {t("liveViewAll")}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
