// Local service-area pages: nearby towns Slugger serves from the Ocala shop.
// Each entry gets its own landing page at /custom-uniforms/[slug] with
// distinct copy - these are real service pages, not doorway spam.

export type ServiceArea = {
  slug: string;
  city: string;
  /** "20 minutes south of our Ocala shop" - the local hook. */
  proximity: string;
  /** One paragraph of city-specific context (leagues, scene, delivery). */
  blurb: string;
};

export const SERVICE_AREAS: ServiceArea[] = [
  {
    slug: "the-villages",
    city: "The Villages",
    proximity: "about 40 minutes south of our Ocala shop",
    blurb:
      "The Villages runs one of the biggest recreation softball scenes in Florida, and we outfit teams across its leagues - custom softball jerseys, matching hats, and full uniform sets with every player's name and number sublimated in. Order online with our player self-entry roster, and we deliver or you can swing by the Ocala shop.",
  },
  {
    slug: "gainesville",
    city: "Gainesville",
    proximity: "under an hour north of our Ocala shop",
    blurb:
      "From Gainesville youth leagues to UF club and intramural squads, we build full custom uniform sets with free design mockups you approve before production. College club teams love the per-player self-entry roster - share one link and every player picks their own size, name, and number.",
  },
  {
    slug: "belleview",
    city: "Belleview",
    proximity: "just 15 minutes south of our Ocala shop",
    blurb:
      "Belleview teams are practically neighbors - order custom jerseys and hats and pick them up in Ocala the same week for embroidered caps, or have full uniform sets delivered when production wraps. Free design, no surprises on price.",
  },
  {
    slug: "summerfield",
    city: "Summerfield",
    proximity: "about 20 minutes southeast of our Ocala shop",
    blurb:
      "Summerfield ball clubs and rec teams get the full Slugger treatment: custom sublimated uniforms designed free, hats embroidered in-house, and local pickup that saves the whole team shipping. One roster link outfits everyone.",
  },
  {
    slug: "dunnellon",
    city: "Dunnellon",
    proximity: "about 25 minutes southwest of our Ocala shop",
    blurb:
      "Dunnellon teams don't need to mail-order uniforms from out of state - we design, produce, and hand them over locally. Custom jerseys from $28, embroidered hats often ready in days, and a free mockup before you commit to anything.",
  },
  {
    slug: "leesburg",
    city: "Leesburg",
    proximity: "about 45 minutes south of our Ocala shop",
    blurb:
      "Leesburg and Lake County teams get big-shop custom uniforms with small-shop service: free design proofs, per-player roster entry, transparent 2026 pricing, and delivery or Ocala pickup - whichever is easier for your season.",
  },
];

export function getServiceArea(slug: string): ServiceArea | undefined {
  return SERVICE_AREAS.find((a) => a.slug === slug);
}
