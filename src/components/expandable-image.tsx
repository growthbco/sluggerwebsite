"use client";

import { useState } from "react";
import Image from "next/image";

/** Click-to-expand product image: thumbnail in place, full-size lightbox on
 *  tap (click anywhere or press Escape to close). */
export function ExpandableImage({ src, alt, sizes }: { src: string; alt: string; sizes?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Expand image: ${alt}`}
        className="absolute inset-0 cursor-zoom-in"
      >
        <Image src={src} alt={alt} fill sizes={sizes ?? "(max-width: 1024px) 50vw, 25vw"} className="object-cover" />
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black/85 grid place-items-center p-4 cursor-zoom-out"
          onClick={() => setOpen(false)}
          onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} className="max-h-[90vh] max-w-[92vw] object-contain bg-white rounded" />
          <button type="button" aria-label="Close" className="absolute top-4 right-4 h-10 w-10 grid place-items-center bg-black/60 text-white rounded-full text-xl">×</button>
        </div>
      )}
    </>
  );
}
