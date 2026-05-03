"use client";

import { Search, X } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { StorefrontLiveSearch } from "@/components/layout/storefront-live-search";

type MobileSearchOverlayProps = {
  placeholder: string;
  openSearchAriaLabel: string;
  submitAriaLabel: string;
  closeLabel: string;
  compact?: boolean;
};

export function MobileSearchOverlay({
  placeholder,
  openSearchAriaLabel,
  submitAriaLabel,
  closeLabel,
  compact = false,
}: MobileSearchOverlayProps) {
  const [open, setOpen] = useState(false);
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      {compact ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={openSearchAriaLabel}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="inline-flex size-10 shrink-0 items-center justify-center border-0 bg-transparent p-0 text-header-foreground transition-transform duration-150 hover:scale-[1.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-header-foreground/80 md:hidden"
        >
          <Search className="size-6 shrink-0" strokeWidth={1.75} aria-hidden />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={openSearchAriaLabel}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="flex w-full min-w-0 items-center rounded-md border border-border/60 bg-background py-1 pl-4 pr-1 text-start shadow-sm transition hover:bg-card"
        >
          <span className="min-h-9 min-w-0 flex-1 truncate py-2 text-sm text-foreground/45">{placeholder}</span>
          <span
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-header text-header-foreground"
            aria-hidden
          >
            <Search className="size-[18px]" strokeWidth={2} />
          </span>
        </button>
      )}

      {open && isClient
        ? createPortal(
            <div
              className="fixed inset-0 z-[110] flex min-h-0 flex-col bg-background pt-[env(safe-area-inset-top,0px)] md:hidden"
              role="dialog"
              aria-modal="true"
              aria-label={openSearchAriaLabel}
            >
              <div className="flex shrink-0 justify-end px-3 pt-2 pb-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label={closeLabel}
                  className="flex size-11 items-center justify-center rounded-md text-foreground transition hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <X className="size-6" strokeWidth={2} aria-hidden />
                </button>
              </div>

              <div className="flex min-h-0 flex-1 flex-col px-4 pb-[env(safe-area-inset-bottom,12px)] pt-1">
                <StorefrontLiveSearch
                  mode="mobile"
                  placeholder={placeholder}
                  submitAriaLabel={submitAriaLabel}
                  onAfterNavigate={() => setOpen(false)}
                />
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
