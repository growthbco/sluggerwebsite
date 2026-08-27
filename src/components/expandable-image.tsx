"use client";

import { useState } from "react";
import Image from "next/image";

/** A clickable image that opens full-screen in a lightbox so people can see the
 *  whole jersey (front + back) instead of a cropped tile.
 *  - Default (fill): fills its relative, aspect-sized parent cell.
 *  - block: renders at natural width/height (for masonry / flowing layouts). */
export function ExpandableImage({
  src,
  alt,
  unoptimized,
  imgClassName = "object-cover",
  sizes = "(max-width: 768px) 50vw, 33vw",
  block = false,
}: {
  src: string;
  alt: string;
  unoptimized?: boolean;
  imgClassName?: string;
  sizes?: string;
  block?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const expandIcon = (
    <span className="absolute bottom-2 right-2 grid h-7 w-7 place-items-center rounded-full bg-ink/75 text-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity" aria-hidden>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
      </svg>
    </span>
  );
  return (
    <>
      {block ? (
        <button type="button" onClick={() => setOpen(true)} className="relative block w-full cursor-zoom-in group" title="Click to expand" aria-label={`Expand image: ${alt}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} className={`w-full h-auto ${imgClassName}`} />
          {expandIcon}
        </button>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="absolute inset-0 cursor-zoom-in group" title="Click to expand" aria-label={`Expand image: ${alt}`}>
          <Image src={src} alt={alt} fill sizes={sizes} className={imgClassName} unoptimized={unoptimized} />
          {expandIcon}
        </button>
      )}
      {open && (
        <div className="fixed inset-0 z-[90] bg-black/85 grid place-items-center p-3" role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} className="max-h-[95vh] max-w-[98vw] object-contain rounded bg-white" />
          <button type="button" className="absolute top-4 right-4 text-white text-3xl leading-none" aria-label="Close">×</button>
        </div>
      )}
    </>
  );
}
