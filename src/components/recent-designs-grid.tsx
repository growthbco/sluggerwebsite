"use client";

import { useEffect, useRef, useState } from "react";

type Design = { reference: string; teamName: string | null; image: string };

// Swipeable showcase of approved mockups; click any tile to magnify it.
export function RecentDesignsGrid({ designs }: { designs: Design[] }) {
  const [zoom, setZoom] = useState<Design | null>(null);
  const railRef = useRef<HTMLDivElement>(null);

  function moveRail(direction: -1 | 1) {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({ left: direction * rail.clientWidth * 0.85, behavior: "smooth" });
  }

  // Close the lightbox on Escape and lock body scroll while it's open.
  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoom(null);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [zoom]);

  return (
    <>
      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between gap-4">
          <p className="text-xs text-muted sm:text-sm">Swipe or browse the latest team designs</p>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => moveRail(-1)}
              aria-label="Show previous designs"
              className="grid h-10 w-10 place-items-center border border-line bg-ink text-lg text-foreground transition-colors hover:border-brand hover:text-brand"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => moveRail(1)}
              aria-label="Show more designs"
              className="grid h-10 w-10 place-items-center border border-line bg-ink text-lg text-foreground transition-colors hover:border-brand hover:text-brand"
            >
              →
            </button>
          </div>
        </div>

        <div
          ref={railRef}
          role="region"
          aria-label="Recent team designs"
          className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {designs.map((d) => (
            <button
              key={d.reference}
              type="button"
              onClick={() => setZoom(d)}
              className="group w-[78vw] shrink-0 snap-start overflow-hidden border border-line bg-ink text-left cursor-zoom-in sm:w-[calc((100%-0.75rem)/2)] lg:w-[calc((100%-2.25rem)/4)]"
              aria-label={`Enlarge ${d.teamName ?? "design"} mockup`}
            >
              <div className="relative aspect-square overflow-hidden bg-white">
                {/* Approved mockups are remote uploads and may not be hosted on
                    an image domain known at build time. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={d.image}
                  alt={`${d.teamName ?? "Custom"} design mockup`}
                  loading="lazy"
                  className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.03]"
                />
              </div>
              {d.teamName ? (
                <p className="truncate px-3 py-2.5 display text-sm text-foreground" title={d.teamName}>
                  {d.teamName}
                </p>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {zoom && (
        <div
          className="fixed inset-0 z-[90] bg-black/90 grid place-items-center p-4 sm:p-8 cursor-zoom-out"
          onClick={() => setZoom(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={() => setZoom(null)}
            className="absolute top-4 right-5 text-white/80 hover:text-white text-3xl leading-none"
            aria-label="Close"
          >
            &times;
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={zoom.image}
            alt={`${zoom.teamName ?? "Custom"} design mockup`}
            className="max-h-[90vh] max-w-[95vw] object-contain bg-white"
          />
        </div>
      )}
    </>
  );
}
