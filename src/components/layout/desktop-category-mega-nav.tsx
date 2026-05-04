"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { PageContainer } from "@/components/layout/page-container";
import { Link } from "@/i18n/routing";
import { categoryNavBlurb } from "@/lib/category-display";
import type { HeaderCategoryNav } from "@/lib/storefront";
import { cn } from "@/lib/utils";

const CLOSE_DELAY_MS = 160;

/** Category strip: background lives on `<li>` (card = mega panel) so the link never stacks a second bg. */
const categoryBarLinkClass =
  "inline-flex h-full min-h-9 w-full max-w-none items-center border-0 bg-transparent px-2 py-1 text-sm font-medium leading-tight whitespace-nowrap md:px-2.5";

type NavHrefProps = {
  href: string;
  className?: string;
  children: ReactNode;
};

function NavHref({ href, className, children }: NavHrefProps) {
  const isAppPath = href.startsWith("/") && !href.startsWith("//");
  if (isAppPath) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

function flattenCategoryLinks(nodes: HeaderCategoryNav[]): { id: string; href: string; label: string }[] {
  const out: { id: string; href: string; label: string }[] = [];
  function walk(node: HeaderCategoryNav) {
    out.push({ id: node.id, href: node.href, label: node.label });
    for (const child of node.children ?? []) walk(child);
  }
  for (const n of nodes) walk(n);
  return out;
}

function CategoryNavFlatStack({ items }: { items: HeaderCategoryNav[] }) {
  const links = flattenCategoryLinks(items);
  if (!links.length) {
    return null;
  }

  return (
    <div className="flex min-w-0 flex-col gap-2 text-sm">
      {links.map((link) => (
        <NavHref
          key={link.id}
          href={link.href}
          className="block w-fit font-normal leading-snug text-foreground underline decoration-foreground/45 underline-offset-[0.2em] transition-colors hover:text-primary hover:decoration-primary/60"
        >
          {link.label}
        </NavHref>
      ))}
    </div>
  );
}

type DesktopCategoryMegaNavProps = {
  categories: HeaderCategoryNav[];
  ariaLabel: string;
  browseEyebrow: string;
  newBadgeLabel: string;
};

export function DesktopCategoryMegaNav({
  categories,
  ariaLabel,
  browseEyebrow,
  newBadgeLabel,
}: DesktopCategoryMegaNavProps) {
  const tNav = useTranslations("nav");
  const [openId, setOpenId] = useState<string | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current != null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => setOpenId(null), CLOSE_DELAY_MS);
  }, [clearCloseTimer]);

  const open = useCallback(
    (id: string) => {
      clearCloseTimer();
      setOpenId(id);
    },
    [clearCloseTimer],
  );

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenId(null);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function onBlurRoot(event: React.FocusEvent<HTMLDivElement>) {
    const next = event.relatedTarget;
    if (next instanceof Node && rootRef.current?.contains(next)) {
      return;
    }
    scheduleClose();
  }

  const active = categories.find((c) => c.id === openId) ?? null;
  const activeChildren = active?.children;
  const showPanel = Boolean(active && activeChildren?.length);

  return (
    <div
      ref={rootRef}
      className="relative w-full"
      onMouseEnter={clearCloseTimer}
      onMouseLeave={scheduleClose}
      onBlur={onBlurRoot}
    >
      <PageContainer>
        <nav
          className="desktop-category-scroll w-full min-w-0 overflow-x-auto overflow-y-hidden overscroll-x-contain scroll-smooth py-2.5"
          aria-label={ariaLabel}
        >
          <ul className="mx-auto flex w-max max-w-full min-w-0 flex-nowrap items-stretch justify-center gap-x-0.5 md:gap-x-1.5">
            {categories.map((category) => {
              const expandable = Boolean(category.children?.length);
              const isOpen = openId === category.id;

              return (
                <li
                  key={category.id}
                  className={cn(
                    "group flex min-h-9 shrink-0 items-stretch rounded-md",
                    expandable && "hover:bg-card has-[a:focus-visible]:bg-card",
                    isOpen &&
                      expandable &&
                      "relative z-[35] -my-2 rounded-none bg-card py-2 !shadow-none ring-0",
                  )}
                  onMouseEnter={() => {
                    open(category.id);
                  }}
                  onFocusCapture={() => {
                    open(category.id);
                  }}
                >
                  {expandable ? (
                    <NavHref
                      href={category.href}
                      className={cn(
                        categoryBarLinkClass,
                        "cursor-pointer transition-[color,text-decoration-color]",
                        isOpen
                          ? "rounded-none text-card-foreground decoration-transparent"
                          : "text-header-foreground/90 underline decoration-transparent decoration-1 underline-offset-8 group-hover:text-card-foreground group-hover:decoration-card-foreground/50 group-has-[a:focus-visible]:text-card-foreground group-has-[a:focus-visible]:decoration-card-foreground/50",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                        isOpen && "focus-visible:ring-primary/20",
                      )}
                    >
                      <span id={`desktop-cat-trigger-${category.id}`}>{category.label}</span>
                    </NavHref>
                  ) : (
                    <NavHref
                      href={category.href}
                      className={cn(
                        categoryBarLinkClass,
                        "text-header-foreground/90 transition-[color,text-decoration-color]",
                        "underline decoration-transparent decoration-1 underline-offset-8 hover:text-header-foreground hover:decoration-header-foreground/50",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                      )}
                    >
                      {category.label}
                    </NavHref>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
      </PageContainer>

      {showPanel && active && activeChildren && (
        <div
          id={panelId}
          role="region"
          aria-labelledby={`desktop-cat-trigger-${active.id}`}
          className="absolute inset-x-0 top-full z-[30] -mt-px pb-6"
        >
          <PageContainer>
            <div
              className={cn(
                "origin-top overflow-hidden rounded-b-lg rounded-t-none border-x border-b border-border/60 border-t-0 bg-card text-foreground shadow-[0_20px_50px_-16px_rgba(15,23,42,0.22)]",
                "motion-safe:transition-[opacity,transform] motion-safe:duration-150 motion-safe:ease-out",
              )}
            >
              <div className="max-h-[min(70vh,520px)] overflow-y-auto overscroll-y-contain p-5 sm:p-6">
                <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="text-[11px] font-normal tracking-wide text-muted-foreground uppercase">{browseEyebrow}</p>
                  </div>
                  <NavHref
                    href={active.href}
                    className="shrink-0 text-sm font-normal text-primary underline decoration-primary underline-offset-4 hover:text-primary/90"
                  >
                    {tNav("megaMenuSeeAllFromCategory")}
                  </NavHref>
                </div>

                <div className="mt-6 grid gap-8 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
                  {activeChildren.map((item) => {
                    const blurb = categoryNavBlurb(item.label, item.description);
                    return (
                      <section key={item.id} className="min-w-0">
                        <NavHref
                          href={item.href}
                          className="block w-fit pb-3 text-base font-normal uppercase tracking-wide text-foreground underline decoration-foreground/50 underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-2"
                        >
                          <span className="inline-flex flex-wrap items-center gap-2">
                            {item.label}
                            {item.isNew ? (
                              <Badge className="bg-success px-2 py-0.5 text-[10px] font-normal tracking-wide text-white">
                                {newBadgeLabel}
                              </Badge>
                            ) : null}
                          </span>
                        </NavHref>
                        {item.children?.length ? (
                          <div className="pt-1">
                            <CategoryNavFlatStack items={item.children} />
                          </div>
                        ) : blurb ? (
                          <p className="mt-3 text-sm leading-snug text-muted-foreground">{blurb}</p>
                        ) : null}
                      </section>
                    );
                  })}
                </div>
              </div>
            </div>
          </PageContainer>
        </div>
      )}
    </div>
  );
}
