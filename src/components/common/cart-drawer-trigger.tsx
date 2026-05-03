"use client";

import { Handbag, ArrowUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { useCart } from "@/hooks/useCart";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";

type CartTriggerProps = {
  variant: "mobile" | "desktop";
};

export function CartTrigger({ variant }: CartTriggerProps) {
  const t = useTranslations("nav");
  const { itemCount } = useCart();

  const button = (
    <Button
      asChild
      variant="ghost"
      size="sm"
      aria-label={t("cart")}
      className={
        variant === "mobile"
          ? "h-10 w-10 shrink-0 cursor-pointer border-0 bg-transparent p-0 text-header-foreground transition-transform duration-150 hover:scale-[1.06] hover:bg-transparent active:bg-transparent md:hidden [&_svg]:text-header-foreground"
          : "cursor-pointer border-0 bg-transparent p-2 text-header-foreground transition-transform duration-150 hover:scale-[1.06] hover:bg-transparent active:bg-transparent [&_svg]:text-header-foreground"
      }
    >
      <Link href="/cart">
        <span className="relative inline-flex">
          <Handbag className="size-[26px] shrink-0" strokeWidth={1.75} aria-hidden />
          <span className="absolute -bottom-0.5 -right-0.5 flex h-[18px] min-w-[18px] translate-x-px translate-y-px items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-accent-foreground tabular-nums">
            {itemCount > 99 ? "99+" : itemCount}
          </span>
        </span>
      </Link>
    </Button>
  );

  if (variant === "mobile") {
    return button;
  }

  return <div className="hidden md:contents">{button}</div>;
}

/** Mobile-only scroll-to-top FAB; appears above the cart button when scrolled down (hidden from md up). */
export function MobileScrollToTopButton() {
  const tCommon = useTranslations("common");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label={tCommon("scrollToTop")}
      className="fixed z-40 flex size-12 items-center justify-center rounded-full border border-header-foreground/15 bg-header text-header-foreground shadow-lg transition-all duration-300 hover:scale-[1.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-header-foreground/80 md:hidden"
      style={{
        bottom: "calc(max(1rem, env(safe-area-inset-bottom, 0px)) + 3.75rem + 0.625rem)",
        right: "calc(max(1rem, env(safe-area-inset-right, 0px)) + 0.25rem)",
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
        transform: visible ? "translateY(0)" : "translateY(8px)",
      }}
    >
      <ArrowUp className="size-5 shrink-0" strokeWidth={2} aria-hidden />
    </button>
  );
}

/** Mobile-only FAB; opens the same cart drawer as header cart (hidden from md up). */
export function MobileFloatingCartButton() {
  const t = useTranslations("nav");
  const { itemCount } = useCart();

  return (
    <Link
      href="/cart"
      aria-label={t("cart")}
      className="fixed z-40 flex size-14 cursor-pointer items-center justify-center rounded-full border border-header-foreground/15 bg-header text-header-foreground shadow-lg transition-transform duration-150 hover:scale-[1.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-header-foreground/80 md:hidden [&_svg]:text-header-foreground"
      style={{
        bottom: "max(1rem, env(safe-area-inset-bottom, 0px))",
        right: "max(1rem, env(safe-area-inset-right, 0px))",
      }}
    >
      <span className="relative inline-flex">
        <Handbag className="size-7 shrink-0" strokeWidth={2} aria-hidden />
        <span className="absolute -bottom-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-accent-foreground tabular-nums">
          {itemCount > 99 ? "99+" : itemCount}
        </span>
      </span>
    </Link>
  );
}
