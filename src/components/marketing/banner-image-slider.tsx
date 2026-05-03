"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type BannerImageSlide = {
  public_id: string;
  image_url: string | null;
  order: number;
};

type BannerImageSliderProps = {
  title: string;
  headlineFallback: string;
  images: BannerImageSlide[];
  priority?: boolean;
  showTitleOverlay?: boolean;
  viewportClassName?: string;
};

const AUTO_SLIDE_MS = 4500;

export function BannerImageSlider({
  title,
  headlineFallback,
  images,
  priority = false,
  showTitleOverlay = false,
  viewportClassName = "h-[220px] sm:h-[280px] md:h-[380px] lg:h-[460px]",
}: BannerImageSliderProps) {
  const slides = useMemo(
    () => images.filter((item) => Boolean(item.image_url)),
    [images],
  );
  const [index, setIndex] = useState(0);
  const [previousIndex, setPreviousIndex] = useState<number | null>(null);
  const [crossfadeActive, setCrossfadeActive] = useState(false);
  const transitionTimerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const CROSSFADE_MS = 400;

  useEffect(() => {
    queueMicrotask(() => {
      setIndex(0);
      setPreviousIndex(null);
      setCrossfadeActive(false);
    });
  }, [slides.length]);

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current != null) {
        window.clearTimeout(transitionTimerRef.current);
      }
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (slides.length <= 1) return;
    const nextIdx = (index + 1) % slides.length;
    const nextSrc = slides[nextIdx]?.image_url;
    if (!nextSrc) return;
    const preload = new window.Image();
    preload.src = nextSrc;
  }, [index, slides]);

  const goTo = (nextIndex: number) => {
    if (slides.length <= 1) {
      setIndex(nextIndex);
      return;
    }
    if (nextIndex === index) return;
    if (transitionTimerRef.current != null) {
      window.clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
    if (rafRef.current != null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    setPreviousIndex(index);
    setIndex(nextIndex);
    setCrossfadeActive(false);
    rafRef.current = window.requestAnimationFrame(() => {
      setCrossfadeActive(true);
      transitionTimerRef.current = window.setTimeout(() => {
        setCrossfadeActive(false);
        setPreviousIndex(null);
      }, CROSSFADE_MS);
    });
  };

  useEffect(() => {
    if (slides.length <= 1) {
      return;
    }
    const timer = window.setInterval(() => {
      const nextIdx = (index + 1) % slides.length;
      goTo(nextIdx);
    }, AUTO_SLIDE_MS);
    return () => window.clearInterval(timer);
  }, [index, slides.length]);

  if (!slides.length) {
    return null;
  }

  return (
    <div className={`relative w-full overflow-hidden ${viewportClassName}`}>
      <div className="absolute inset-0">
        {previousIndex != null && slides[previousIndex]?.image_url ? (
          <div
            className={`absolute inset-0 transition-opacity duration-[400ms] ease-out ${
              crossfadeActive ? "opacity-0" : "opacity-100"
            }`}
          >
            <Image
              src={slides[previousIndex].image_url!}
              alt={title?.trim() ? title : headlineFallback}
              fill
              priority={priority && previousIndex === 0}
              sizes="100vw"
              className="object-cover"
            />
          </div>
        ) : null}
        <div
          className={`absolute inset-0 transition-opacity duration-[400ms] ease-out ${
            previousIndex != null ? (crossfadeActive ? "opacity-100" : "opacity-0") : "opacity-100"
          }`}
        >
          <Image
            src={slides[index].image_url!}
            alt={title?.trim() ? title : headlineFallback}
            fill
            priority={priority && index === 0}
            sizes="100vw"
            className="object-cover"
          />
        </div>
      </div>

      {showTitleOverlay && title?.trim() ? (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 via-black/25 to-transparent px-4 pb-4 pt-10 text-white md:px-6 md:pb-6">
          <p className="text-pretty text-base font-semibold leading-snug md:text-lg">{title}</p>
        </div>
      ) : null}

      {slides.length > 1 ? (
        <>
          <button
            type="button"
            aria-label="Previous banner image"
            onClick={() => goTo((index - 1 + slides.length) % slides.length)}
            className="absolute left-3 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white transition hover:bg-black/50"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Next banner image"
            onClick={() => goTo((index + 1) % slides.length)}
            className="absolute right-3 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white transition hover:bg-black/50"
          >
            <ChevronRight className="size-5" aria-hidden />
          </button>
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2">
            {slides.map((slide, dotIdx) => (
              <button
                key={`${slide.public_id}-dot`}
                type="button"
                aria-label={`Go to banner image ${dotIdx + 1}`}
                onClick={() => goTo(dotIdx)}
                className={`h-1.5 rounded-full transition ${
                  dotIdx === index ? "w-5 bg-primary-foreground" : "w-2.5 bg-primary-foreground/55"
                }`}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
