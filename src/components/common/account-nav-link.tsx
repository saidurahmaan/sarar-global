"use client";

import { CircleUser } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/routing";

type AccountNavLinkProps = {
  variant: "mobile" | "desktop";
};

/** Account area placeholder until auth is added. */
export function AccountNavLink({ variant }: AccountNavLinkProps) {
  const t = useTranslations("nav");

  const link = (
    <Link
      href="/account"
      aria-label={t("account")}
      className={
        variant === "mobile"
          ? "inline-flex h-10 w-10 shrink-0 items-center justify-center border-0 bg-transparent p-0 text-header-foreground transition-transform duration-150 hover:scale-[1.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-header-foreground/80 md:hidden"
          : "hidden h-9 items-center gap-2 rounded-lg border border-header-foreground/20 bg-transparent px-3 text-sm font-medium text-header-foreground transition-colors hover:bg-header-foreground/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-header-foreground/40 md:inline-flex"
      }
    >
      <CircleUser className="size-[20px] shrink-0" strokeWidth={1.75} aria-hidden />
      <span className="hidden lg:inline">{t("signIn")}</span>
    </Link>
  );

  if (variant === "mobile") {
    return link;
  }

  return <div className="hidden md:contents">{link}</div>;
}
