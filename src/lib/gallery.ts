// Migrated marketing / team / drop photography from the original site.
import media from "@/data/site-media.json";
import keep from "@/data/gallery-keep.json";

export type MediaItem = { id: number; file: string; alt: string; title: string; sourceUrl: string };

export const allMedia: MediaItem[] = media as MediaItem[];

// Per the owner: the gallery should ONLY show photos of real people wearing /
// holding the gear - not flat product mockups. This keep-list was produced by
// visually classifying every migrated image.
const keepSet = new Set(keep as string[]);

export const galleryPhotos: MediaItem[] = allMedia.filter((m) => keepSet.has(m.file));

// Use the SAME hero banner as the current sluggerathletics.com (team-with-bats
// group photo), falling back to other real team photos if it's ever removed.
export const heroPhoto =
  allMedia.find((m) => /455266330_495425179888463/i.test(m.file))?.file ??
  galleryPhotos.find((m) => /dscf/i.test(m.file))?.file ??
  galleryPhotos[0]?.file ??
  null;
