"use client";

import { useState } from "react";
import Image from "next/image";

/** Approved-design gallery for team stores: mockups shown object-contain on
 *  white (unlike ProductGallery's cover-cropped square product shots). */
export function ProofGallery({ images, teamName }: { images: string[]; teamName: string }) {
  const [active, setActive] = useState(0);
  const main = images[active] ?? images[0];
  if (!main) return null;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="relative bg-white border border-line" style={{ aspectRatio: "4 / 3" }}>
        <Image
          src={main}
          alt={`${teamName} custom design`}
          fill
          sizes="(max-width: 768px) 100vw, 672px"
          className="object-contain p-2"
          priority
          unoptimized
        />
      </div>
      {images.length > 1 && (
        <div className="mt-3 grid grid-cols-5 gap-2">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setActive(i)}
              className={`relative aspect-[4/3] bg-white border overflow-hidden ${
                i === active ? "border-brand" : "border-line hover:border-brand/50"
              }`}
              aria-label={`View design image ${i + 1}`}
            >
              <Image src={src} alt="" fill sizes="15vw" className="object-contain p-1" unoptimized />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
