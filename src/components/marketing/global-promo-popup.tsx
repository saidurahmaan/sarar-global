"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { usePathname } from "@/i18n/routing";

import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PaperbaseStorePopup } from "@/types/paperbase";

function formatLocalYmd(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function truncateWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text.trim();
  return `${words.slice(0, maxWords).join(" ")}...`;
}

export function GlobalPromoPopup({ popup }: { popup: PaperbaseStorePopup | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const images = useMemo(() => {
    const list = (popup?.images ?? []).slice().sort((a, b) => a.order - b.order).slice(0, 3);
    return list.filter((img) => Boolean(img.image_url));
  }, [popup]);

  const heroImage = images[0]?.image_url ?? null;
  const buttonText = popup?.button_text?.trim() ?? "";
  const buttonLink = popup?.button_link?.trim() ?? "";
  const descriptionPreview = truncateWords(popup?.description ?? "", 30);
  const isHomePage = pathname === "/";
  const shouldShowOnCurrentPage = Boolean(popup && (popup.show_on_all_pages || isHomePage));

  useEffect(() => {
    queueMicrotask(() => {
      setOpen(false);
    });
    if (!shouldShowOnCurrentPage || !popup) return;

    const baseKey = `store_popup_${popup.public_id}`;
    const today = formatLocalYmd(new Date());

    if (popup.show_frequency === "session") {
      if (sessionStorage.getItem(`${baseKey}_shown_session`)) return;
    } else if (popup.show_frequency === "daily") {
      if (localStorage.getItem(`${baseKey}_shown_daily_${today}`)) return;
    }

    const delayMs = Math.max(0, Number(popup.delay_seconds ?? 0)) * 1000;
    const timeoutId = window.setTimeout(() => {
      setOpen(true);
      if (popup.show_frequency === "session") {
        sessionStorage.setItem(`${baseKey}_shown_session`, "1");
      } else if (popup.show_frequency === "daily") {
        localStorage.setItem(`${baseKey}_shown_daily_${today}`, "1");
      }
    }, delayMs);

    return () => window.clearTimeout(timeoutId);
  }, [popup, shouldShowOnCurrentPage]);

  if (!shouldShowOnCurrentPage || !popup) return null;

  return (
    <DialogRoot open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        className="rounded-none !px-0 !pt-0 sm:max-w-lg sm:rounded-none"
      >
        <div className="relative overflow-hidden border border-border bg-muted">
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close popup"
            className="absolute right-3 top-3 z-10 inline-flex size-8 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
          >
            <X className="size-4" strokeWidth={2.5} aria-hidden />
          </button>
          {heroImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={heroImage}
              alt=""
              draggable={false}
              className="h-60 w-full object-cover sm:h-72"
            />
          ) : (
            <div className="h-60 w-full bg-muted sm:h-72" />
          )}
        </div>
        <div className="px-5 pb-4 pt-5">
          <DialogHeader className="text-center">
            <DialogTitle className="text-xl">{popup.title}</DialogTitle>
            <DialogDescription className="mt-1 text-sm text-muted-foreground">
              {descriptionPreview}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-3 flex items-center justify-center gap-2">
            {buttonText && buttonLink ? (
              <a
                href={buttonLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                {buttonText}
              </a>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </DialogRoot>
  );
}
