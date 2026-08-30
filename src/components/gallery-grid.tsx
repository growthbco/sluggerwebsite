"use client";

import { useMemo, useState } from "react";
import { ExpandableImage } from "@/components/expandable-image";
import type { GalleryCategory, GalleryPhoto } from "@/lib/gallery";

const categories: Array<"All work" | GalleryCategory> = ["All work", "Youth Baseball", "Softball", "Custom Jerseys"];

export function GalleryGrid({ photos }: { photos: GalleryPhoto[] }) {
  const [category, setCategory] = useState<(typeof categories)[number]>("All work");
  const visible = useMemo(
    () => category === "All work" ? photos : photos.filter((photo) => photo.category === category),
    [category, photos],
  );

  return (
    <div className="mt-8">
      <div className="flex flex-wrap gap-2" aria-label="Filter gallery by category">
        {categories.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setCategory(option)}
            aria-pressed={category === option}
            className={`min-h-11 rounded-full border px-4 text-sm transition-colors ${category === option ? "border-brand bg-brand text-on-brand" : "border-line bg-steel text-foreground hover:border-brand/60"}`}
          >
            {option}
          </button>
        ))}
      </div>

      <div className="mt-6 columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4 [column-fill:_balance]">
        {visible.map((photo) => (
          <figure key={photo.id} className="mb-4 break-inside-avoid overflow-hidden rounded-lg border border-line bg-steel">
            <ExpandableImage src={photo.file} alt={photo.alt} block imgClassName="object-cover" />
            <figcaption className="border-t border-line px-3 py-2.5">
              <span className="display text-xs uppercase tracking-wider text-brand">{photo.category}</span>
              <p className="mt-0.5 text-sm text-muted">{photo.caption}</p>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
