// Migrated marketing / team / drop photography from the original site.
import media from "@/data/site-media.json";
import keep from "@/data/gallery-keep.json";

export type MediaItem = { id: number; file: string; alt: string; title: string; sourceUrl: string };
export type GalleryCategory = "Youth Baseball" | "Softball" | "Custom Jerseys";
export type GalleryPhoto = MediaItem & { category: GalleryCategory; caption: string };

export const allMedia: MediaItem[] = media as MediaItem[];

// Per the owner: the gallery should ONLY show photos of real people wearing /
// holding the gear - not flat product mockups. This keep-list was produced by
// visually classifying every migrated image.
const keepSet = new Set(keep as string[]);

const youthBaseballIds = new Set([2463, 2163, 2095, 2094, 2093, 2092, 2091, 2090, 2089, 2088, 2087, 2086, 2085, 2084]);
const softballActionIds = new Set([2622, 1921, 1815, 1814, 1807, 1799, 1798, 1797, 1796]);

export const galleryPhotos: GalleryPhoto[] = allMedia
  .filter((m) => keepSet.has(m.file))
  .map((m) => {
    const category: GalleryCategory = youthBaseballIds.has(m.id)
      ? "Youth Baseball"
      : softballActionIds.has(m.id)
        ? "Softball"
        : "Custom Jerseys";
    const caption = category === "Youth Baseball"
      ? "Youth baseball uniforms in game action"
      : category === "Softball"
        ? "Custom softball jerseys on the field"
        : "Slugger Athletics custom jersey detail";
    return {
      ...m,
      category,
      caption,
      alt: `${caption} by Slugger Athletics`,
    };
  });

// Use the SAME hero banner as the current sluggerathletics.com (team-with-bats
// group photo), falling back to other real team photos if it's ever removed.
export const heroPhoto =
  allMedia.find((m) => /455266330_495425179888463/i.test(m.file))?.file ??
  galleryPhotos.find((m) => /dscf/i.test(m.file))?.file ??
  galleryPhotos[0]?.file ??
  null;
