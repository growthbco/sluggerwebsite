"use client";

import { useEffect } from "react";
import Image from "next/image";

type Props = {
  src: string;
  alt?: string;
  onClose: () => void;
};

/** Fullscreen lightbox for inspecting a proof up close. Closes on X, backdrop click, or Escape. */
export function ProofLightbox({ src, alt = "Proof", onClose }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    // Lock page scroll while the lightbox is open
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 p-4 sm:p-10"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Proof preview"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close preview"
        className="absolute top-4 right-4 z-10 grid place-items-center h-11 w-11 clip-slant bg-brand text-on-brand display text-lg hover:bg-brand-dark transition-colors"
      >
        ✕
      </button>
      <div className="relative h-full w-full cursor-zoom-out">
        <Image src={src} alt={alt} fill sizes="100vw" className="object-contain" unoptimized />
      </div>
      <p className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs text-white/70 pointer-events-none">
        Click anywhere or press Esc to close
      </p>
    </div>
  );
}
