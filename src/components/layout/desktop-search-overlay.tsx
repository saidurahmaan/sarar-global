"use client";

import { Search, X } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { StorefrontLiveSearch } from "@/components/layout/storefront-live-search";

type DesktopSearchOverlayProps = {
  placeholder: string;
  openSearchAriaLabel: string;
  submitAriaLabel: string;
  closeLabel: string;
};

export function DesktopSearchOverlay({
  placeholder,
  openSearchAriaLabel,
  submitAriaLabel,
  closeLabel,
}: DesktopSearchOverlayProps) {
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

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
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
      <button
        type="button"
        aria-label={openSearchAriaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="hidden size-10 items-center justify-center text-header-foreground transition-transform duration-150 hover:scale-[1.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-header-foreground/40 md:inline-flex"
      >
        <Search className="size-5" strokeWidth={1.9} aria-hidden />
      </button>

      {open && isClient
        ? createPortal(
            <div
              className="fixed inset-0 z-[120] hidden min-h-0 flex-col bg-background pt-[env(safe-area-inset-top,0px)] md:flex"
              role="dialog"
              aria-modal="true"
              aria-label={openSearchAriaLabel}
            >
              <div className="flex shrink-0 justify-end px-4 pt-3 pb-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label={closeLabel}
                  className="flex size-11 items-center justify-center rounded-full text-foreground transition hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <X className="size-6" strokeWidth={2} aria-hidden />
                </button>
              </div>

              <div className="flex min-h-0 flex-1 flex-col px-6 pb-[env(safe-area-inset-bottom,12px)] pt-2">
                <div className="mx-auto w-full max-w-3xl">
                  <StorefrontLiveSearch
                    mode="desktop"
                    placeholder={placeholder}
                    submitAriaLabel={submitAriaLabel}
                    onAfterNavigate={() => setOpen(false)}
                  />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
