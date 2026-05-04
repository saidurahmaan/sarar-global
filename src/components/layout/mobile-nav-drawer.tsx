"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/routing";
import type { HeaderCategoryNav } from "@/lib/storefront";
import { Menu } from "lucide-react";

/** Locale-prefixed navigation (same as desktop mega nav); raw `/categories/...` 404s with `localePrefix: "always"`. */
function CategoryNavLink({
  href,
  className,
  style,
  onClick,
  children,
}: {
  href: string;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  children: ReactNode;
}) {
  const isAppPath = href.startsWith("/") && !href.startsWith("//");
  if (isAppPath) {
    return (
      <Link href={href} className={className} style={style} onClick={onClick}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={className} style={style} onClick={onClick}>
      {children}
    </a>
  );
}

type MobileNavDrawerProps = {
  menuTitle: string;
  categories: HeaderCategoryNav[];
};

type SlideTransitionState = {
  direction: "forward" | "back";
  fromTrail: HeaderCategoryNav[];
  toTrail: HeaderCategoryNav[];
  phase: "start" | "run";
};

function CategoryScreen({
  nodes,
  parent,
  onEnterSubmenu,
  onBack,
  onNavigate,
}: {
  nodes: HeaderCategoryNav[];
  parent: HeaderCategoryNav | null;
  onEnterSubmenu: (node: HeaderCategoryNav) => void;
  onBack: () => void;
  onNavigate: () => void;
}) {
  return (
    <div className="pt-3">
      {parent ? (
        <div className="flex h-10 items-center bg-header-foreground/15 px-4">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm uppercase tracking-wide text-header-foreground/90"
          >
            <ArrowLeft className="size-4" aria-hidden />
            <span>{parent.label}</span>
          </button>
        </div>
      ) : null}
      {nodes.map((node) => (
        <div key={node.id} className="flex items-center">
          <CategoryNavLink
            href={node.href}
            className="min-w-0 flex-1 px-4 py-3.5 text-[17px] text-header-foreground/95 hover:bg-header-foreground/10"
            onClick={onNavigate}
          >
            {node.label}
          </CategoryNavLink>
          {node.children?.length ? (
            <button
              type="button"
              aria-label={node.label}
              onClick={() => onEnterSubmenu(node)}
              className="flex size-12 shrink-0 items-center justify-center hover:bg-header-foreground/10"
            >
              <ArrowRight className="size-4 shrink-0 text-header-foreground/70" aria-hidden />
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function MobileNavDrawer({
  menuTitle,
  categories,
}: MobileNavDrawerProps) {
  const tNav = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const [trail, setTrail] = useState<HeaderCategoryNav[]>([]);
  const [slide, setSlide] = useState<SlideTransitionState | null>(null);
  const [panelTop, setPanelTop] = useState(0);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const headingId = useId();
  const panelId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  function close() {
    setOpen(false);
    setTrail([]);
    setSlide(null);
  }

  function syncPanelTop() {
    const trigger = triggerRef.current;
    if (!trigger) {
      return;
    }
    const nextTop = Math.round(trigger.getBoundingClientRect().bottom);
    setPanelTop(nextTop);
  }

  function openMenu() {
    syncPanelTop();
    setTrail([]);
    setSlide(null);
    setOpen(true);
  }

  function getLevelData(currentTrail: HeaderCategoryNav[]) {
    const parent = currentTrail.length ? currentTrail[currentTrail.length - 1] : null;
    const nodes = parent?.children ?? categories;
    return { parent, nodes };
  }

  function startSlide(nextTrail: HeaderCategoryNav[], direction: "forward" | "back") {
    const fromTrail = trail;
    setSlide({ direction, fromTrail, toTrail: nextTrail, phase: "start" });
    setTrail(nextTrail);
    requestAnimationFrame(() => {
      setSlide((prev) => (prev ? { ...prev, phase: "run" } : prev));
    });
  }

  const currentLevel = getLevelData(trail);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onViewportChange() {
      syncPanelTop();
    }

    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
    return () => {
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex h-10 w-10 shrink-0 appearance-none items-center justify-start border-0 bg-transparent p-0 text-header-foreground md:hidden hover:bg-header-foreground/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-header-foreground/80 self-center rounded-md"
        aria-label={open ? tNav("closeMenu") : menuTitle}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          if (open) {
            close();
            return;
          }
          openMenu();
        }}
      >
        {open ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="size-6"
            aria-hidden
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <Menu className="size-6" strokeWidth={1.9} aria-hidden />
        )}
      </button>

      {isClient
        ? createPortal(
            <div
              className={`fixed inset-x-0 bottom-0 z-30 md:hidden ${open ? "pointer-events-auto" : "pointer-events-none"}`}
              style={{ top: `${panelTop}px` }}
              inert={open ? undefined : true}
            >
              <button
                type="button"
                className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${
                  open ? "opacity-100" : "opacity-0"
                }`}
                aria-label={tNav("closeMenu")}
                tabIndex={open ? 0 : -1}
                onClick={close}
              />

              <aside
                id={panelId}
                role="dialog"
                aria-modal="true"
                aria-labelledby={headingId}
                inert={open ? undefined : true}
                className={`absolute left-0 top-0 flex h-full w-full max-w-none flex-col border-t border-header-foreground/15 bg-header text-header-foreground shadow-2xl transition-transform duration-300 ease-out ${
                  open ? "translate-x-0" : "-translate-x-full"
                }`}
              >
                <h2 id={headingId} className="sr-only">
                  {menuTitle}
                </h2>

                <div className="h-px w-full bg-header-foreground/15" />

                <nav className="relative min-h-0 flex-1 overflow-hidden overscroll-contain">
                  {slide ? (
                    <>
                      <div
                        className={`absolute inset-0 overflow-y-auto overscroll-contain transition-transform duration-300 ease-out ${
                          slide.direction === "forward"
                            ? slide.phase === "run"
                              ? "-translate-x-1/4"
                              : "translate-x-0"
                            : slide.phase === "run"
                              ? "translate-x-full"
                              : "translate-x-0"
                        }`}
                      >
                        <CategoryScreen
                          nodes={getLevelData(slide.fromTrail).nodes}
                          parent={getLevelData(slide.fromTrail).parent}
                          onEnterSubmenu={(node) =>
                            startSlide([...slide.fromTrail, node], "forward")
                          }
                          onBack={() => startSlide(slide.fromTrail.slice(0, -1), "back")}
                          onNavigate={close}
                        />
                      </div>
                      <div
                        className={`absolute inset-0 overflow-y-auto overscroll-contain transition-transform duration-300 ease-out ${
                          slide.direction === "forward"
                            ? slide.phase === "run"
                              ? "translate-x-0"
                              : "translate-x-full"
                            : slide.phase === "run"
                              ? "translate-x-0"
                              : "-translate-x-1/4"
                        }`}
                        onTransitionEnd={() => setSlide(null)}
                      >
                        <CategoryScreen
                          nodes={getLevelData(slide.toTrail).nodes}
                          parent={getLevelData(slide.toTrail).parent}
                          onEnterSubmenu={(node) => startSlide([...slide.toTrail, node], "forward")}
                          onBack={() => startSlide(slide.toTrail.slice(0, -1), "back")}
                          onNavigate={close}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="absolute inset-0 overflow-y-auto overscroll-contain">
                      <CategoryScreen
                        nodes={currentLevel.nodes}
                        parent={currentLevel.parent}
                        onEnterSubmenu={(node) => startSlide([...trail, node], "forward")}
                        onBack={() => startSlide(trail.slice(0, -1), "back")}
                        onNavigate={close}
                      />
                    </div>
                  )}
                </nav>
              </aside>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
