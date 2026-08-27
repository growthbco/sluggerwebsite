import type { Metadata } from "next";
import { ExpandableImage } from "@/components/expandable-image";
import { galleryPhotos } from "@/lib/gallery";

export const metadata: Metadata = {
  alternates: { canonical: "/gallery" },
  title: "Gallery - Custom Uniforms, Jerseys & Drops",
  description:
    "See custom team uniforms, embroidered hats, hype chains, and limited drops made by Slugger Athletics.",
};

export default function GalleryPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-14">
      <header className="max-w-2xl">
        <span className="display text-brand text-sm">Our Work</span>
        <h1 className="display text-4xl sm:text-5xl text-foreground mt-1">Gallery</h1>
        <p className="mt-3 text-muted">
          Real teams, real drops. Browse custom jerseys, uniforms, embroidered
          hats, and the themed collections we&apos;ve shipped.
        </p>
      </header>

      <div className="mt-10 columns-2 sm:columns-3 lg:columns-4 gap-3 [column-fill:_balance]">
        {galleryPhotos.map((m) => (
          <div
            key={m.id}
            className="mb-3 break-inside-avoid overflow-hidden bg-steel border border-line"
          >
            <ExpandableImage src={m.file} alt={m.alt || "Slugger Athletics custom gear"} block imgClassName="object-cover" />
          </div>
        ))}
      </div>
    </div>
  );
}
