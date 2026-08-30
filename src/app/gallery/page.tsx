import type { Metadata } from "next";
import { galleryPhotos } from "@/lib/gallery";
import { GalleryGrid } from "@/components/gallery-grid";

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

      <GalleryGrid photos={galleryPhotos} />
    </div>
  );
}
