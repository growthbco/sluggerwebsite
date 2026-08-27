"use client";

import { useState } from "react";
import Image from "next/image";

export function ProductGallery({ images, name }: { images: { src: string; alt: string }[]; name: string }) {
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState(false);
  const main = images[active] ?? images[0];

  return (
    <div>
      <div className="relative aspect-square bg-steel border border-line overflow-hidden">
        {main && (
          <button type="button" onClick={() => setZoom(true)} className="absolute inset-0 cursor-zoom-in group" title="Click to expand" aria-label={`Expand ${main.alt || name}`}>
            <Image src={main.src} alt={main.alt || name} fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" priority unoptimized />
            <span className="absolute bottom-2 right-2 grid h-7 w-7 place-items-center rounded-full bg-ink/75 text-foreground opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
            </span>
          </button>
        )}
      </div>
      {zoom && main && (
        <div className="fixed inset-0 z-[90] bg-black/85 grid place-items-center p-3" role="dialog" aria-modal="true" onClick={() => setZoom(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={main.src} alt={main.alt || name} className="max-h-[95vh] max-w-[98vw] object-contain rounded bg-white" />
          <button type="button" className="absolute top-4 right-4 text-white text-3xl leading-none" aria-label="Close">×</button>
        </div>
      )}
      {images.length > 1 && (
        <div className="mt-3 grid grid-cols-5 gap-2">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`relative aspect-square bg-steel border overflow-hidden ${
                i === active ? "border-brand" : "border-line hover:border-brand/50"
              }`}
            >
              <Image src={img.src} alt={img.alt || name} fill sizes="20vw" className="object-cover" unoptimized />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
