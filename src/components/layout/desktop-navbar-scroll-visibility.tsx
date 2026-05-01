"use client";

import { useEffect, useRef } from "react";

type DesktopNavbarScrollVisibilityProps = {
  targetId: string;
};

export function DesktopNavbarScrollVisibility({ targetId }: DesktopNavbarScrollVisibilityProps) {
  const lastYRef = useRef(0);
  const latestYRef = useRef(0);
  const isHiddenRef = useRef(false);
  const tickingRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);
  const velocityRef = useRef(0);

  useEffect(() => {
    const el = document.getElementById(targetId);
    if (!el) return;

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

    const desktopMql = window.matchMedia?.("(min-width: 768px)");

    const VELOCITY_THRESHOLD = 4;
    const HIDE_THRESHOLD = 80;

    const setHidden = (hide: boolean) => {
      const header = document.getElementById(targetId);
      if (!header) return;

      if (!desktopMql?.matches) {
        // Ensure visible when not on desktop.
        header.style.transition = "";
        header.style.transform = "";
        isHiddenRef.current = false;
        return;
      }

      if (hide === isHiddenRef.current) return;
      isHiddenRef.current = hide;

      if (prefersReducedMotion) {
        header.style.transition = "none";
      } else if (hide) {
        header.style.transition = "transform 180ms cubic-bezier(0.4, 0, 1, 1)";
      } else {
        header.style.transition = "transform 280ms cubic-bezier(0.22, 1, 0.36, 1)";
        header.offsetHeight; // force reflow so transition reliably fires
      }

      header.style.transform = hide ? "translateY(-100%)" : "translateY(0)";
    };

    const processScroll = () => {
      tickingRef.current = false;

      if (!desktopMql?.matches) {
        setHidden(false);
        lastYRef.current = window.scrollY;
        latestYRef.current = window.scrollY;
        velocityRef.current = 0;
        return;
      }

      const currentY = latestYRef.current;
      const delta = currentY - lastYRef.current;
      velocityRef.current = velocityRef.current * 0.6 + delta * 0.4;

      if (currentY <= HIDE_THRESHOLD) {
        setHidden(false);
        lastYRef.current = currentY;
        velocityRef.current = 0;
        return;
      }

      if (velocityRef.current > VELOCITY_THRESHOLD && !isHiddenRef.current) {
        setHidden(true);
      } else if (velocityRef.current < -VELOCITY_THRESHOLD && isHiddenRef.current) {
        setHidden(false);
      }

      lastYRef.current = currentY;
    };

    const onScroll = () => {
      latestYRef.current = window.scrollY;
      if (!tickingRef.current) {
        tickingRef.current = true;
        rafIdRef.current = requestAnimationFrame(processScroll);
      }
    };

    // Initialize.
    el.style.willChange = "transform";
    el.style.transform = "translateY(0)";
    lastYRef.current = window.scrollY;
    latestYRef.current = window.scrollY;

    window.addEventListener("scroll", onScroll, { passive: true });

    const onMediaChange = () => {
      setHidden(false);
    };
    desktopMql?.addEventListener?.("change", onMediaChange);

    return () => {
      window.removeEventListener("scroll", onScroll);
      desktopMql?.removeEventListener?.("change", onMediaChange);
      if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current);
    };
  }, [targetId]);

  return null;
}

