"use client";

import { useState } from "react";
import Image from "next/image";

export function ProductGallery({ images, name }: { images: { src: string; alt: string }[]; name: string }) {
  const [active, setActive] = useState(0);
  const main = images[active] ?? images[0];

  return (
    <div>
      <div className="relative aspect-square bg-steel border border-line overflow-hidden">
        {main && (
          <Image
            src={main.src}
            alt={main.alt || name}
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover"
            priority
            unoptimized
          />
        )}
      </div>
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
