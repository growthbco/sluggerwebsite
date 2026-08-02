"use client";

import { useState } from "react";

/** An image on a white background that opens full-screen on tap (zoom). */
export function ZoomableImage({ src, alt }: { src: string; alt: string }) {
  const [zoom, setZoom] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setZoom(true)} className="relative block w-full aspect-[4/3] bg-white" title="Tap to zoom">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="absolute inset-0 h-full w-full object-contain p-2" />
        <span className="absolute bottom-1 right-2 text-[11px] bg-ink/80 text-foreground px-1.5 py-0.5 rounded">🔍 tap to zoom</span>
      </button>
      {zoom && (
        <div className="fixed inset-0 z-[90] bg-black/85 grid place-items-center p-3" onClick={() => setZoom(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} className="max-h-[95vh] max-w-[98vw] object-contain bg-white rounded" />
          <button type="button" className="absolute top-4 right-4 text-white text-3xl" aria-label="Close">×</button>
        </div>
      )}
    </>
  );
}
