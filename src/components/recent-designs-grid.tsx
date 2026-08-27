"use client";

import { useEffect, useState } from "react";

type Design = { reference: string; teamName: string | null; image: string };

// Grid of approved mockups; click any tile to magnify it in a lightbox.
export function RecentDesignsGrid({ designs }: { designs: Design[] }) {
  const [zoom, setZoom] = useState<Design | null>(null);

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
      <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {designs.map((d) => (
          <button
            key={d.reference}
            type="button"
            onClick={() => setZoom(d)}
            className="group bg-ink border border-line overflow-hidden text-left cursor-zoom-in"
            aria-label={`Enlarge ${d.teamName ?? "design"} mockup`}
          >
            <div className="relative aspect-square bg-white overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={d.image}
                alt={`${d.teamName ?? "Custom"} design mockup`}
                loading="lazy"
                className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
              />
            </div>
            {d.teamName ? (
              <p className="px-3 py-2.5 display text-sm text-foreground truncate" title={d.teamName}>
                {d.teamName}
              </p>
            ) : null}
          </button>
        ))}
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
