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
  // ── Optional "metro" fields ──────────────────────────────────────────
  // Major markets (e.g. Orlando) get a deeper page than the nearby-town
  // template: their own title/H1/intro, deep-dive copy, an ordering-process
  // block, a delivery note, and FAQs (which also emit FAQPage schema).
  metro?: boolean;
  metaTitle?: string;
  metaDescription?: string;
  h1?: string;
  intro?: string;
  deepDive?: string[];
  process?: { t: string; d: string }[];
  delivery?: string;
  faqs?: { q: string; a: string }[];
  /** Real jersey photos for the "Recent Custom Work" grid (full-photo tiles),
   *  instead of the generic catalog cutouts. Files live in /public/styles. */
  realPhotos?: { src: string; alt: string }[];
};

export const SERVICE_AREAS: ServiceArea[] = [
  {
    slug: "orlando",
    city: "Orlando",
    metro: true,
    proximity: "from our Central Florida shop in Ocala",
    metaTitle: "Custom Sports Uniforms Orlando FL | Slugger Athletics",
    metaDescription:
      "Custom sports uniforms in Orlando, FL - fully sublimated jerseys for baseball, softball, basketball, soccer, flag football, and volleyball. Free design, names and numbers included, from $28, delivered to Orlando teams.",
    h1: "Custom Sports Uniforms in Orlando, FL",
    intro:
      "Slugger Athletics builds custom sports uniforms for Orlando, FL teams: fully sublimated jerseys, complete uniform sets, and in-house embroidered hats, all designed free and produced in our Central Florida shop. From travel baseball and softball to basketball, soccer, flag football, and volleyball, Orlando teams get names, numbers, and unlimited colors sublimated in, with honest 2026 pricing from $28 and delivery straight to you.",
    blurb:
      "Ordering custom team uniforms in Orlando usually comes down to an overpriced local printer or a faceless national website that ships whatever the spreadsheet said. Slugger is the Central Florida alternative. You get real design proofs with revisions, per-player roster entry so nobody chases sizes, a free team store for parent orders, and delivery right to Orlando. Same big-shop sublimation, small-shop service.",
    deepDive: [
      "Every Orlando uniform we make is fully sublimated, which means your colors, logos, numbers, and pinstripes are dyed into the fabric instead of pressed on top. It is the same construction the big travel programs wear, and it is why a full season of Central Florida heat and back-to-back tournaments will not crack a number or peel a logo. Whether you run a youth rec team or a competitive travel club, your sublimated jerseys in Orlando look as sharp in the last game as the first.",
      "We outfit Orlando teams across every sport from one simple process. Send your logo and colors, or just an idea, and our in-house designer sends back a mockup before you spend a dollar. Once you approve it, coaches and parents fill a shared roster link so every player's name, number, and size lands correctly, and our print-file check verifies every piece against the roster before production starts.",
    ],
    process: [
      { t: "1. Free design mockup", d: "Send your logo, colors, or an idea. Our designer sends back an Orlando-ready mockup, revisions included, before you pay anything." },
      { t: "2. Share the roster link", d: "Approve the design, then share one link so every Orlando player picks their own size, name, and number. No spreadsheets, no chasing parents." },
      { t: "3. Deposit and production", d: "A 50% deposit starts full sublimation production. Standard turnaround is 2 to 3 weeks, with rush available when your season sneaks up." },
      { t: "4. Delivery to Orlando", d: "We deliver the finished set to your Orlando team or ship it, and each family keeps ordering through your free team store." },
    ],
    delivery:
      "Orlando sits about 90 minutes from our Ocala shop, so we make distance a non-issue. Full uniform sets are delivered to your Orlando team or shipped directly, and the entire design and roster process happens online. You get Central Florida service without anyone driving anywhere.",
    realPhotos: [
      { src: "/styles/basketball-reversible.jpg", alt: "Custom reversible basketball uniform, black and royal blue, made by Slugger Athletics" },
      { src: "/styles/basketball-pink-sets.jpg", alt: "Custom sublimated basketball uniforms, pink jersey and shorts sets by Slugger Athletics" },
      { src: "/styles/soccer-kit-black.jpg", alt: "Custom sublimated soccer kit, black and white striped jersey and shorts by Slugger Athletics" },
      { src: "/styles/football-game-jersey.jpg", alt: "Custom sublimated football game jersey by Slugger Athletics" },
    ],
    faqs: [
      { q: "How much do custom uniforms cost in Orlando?", a: "Sublimated jerseys start at $28 with the design, names, and numbers included: $32 two-button, $35 full-button, $38 quarter-zip. Pants are $40 and embroidered hats $25 to $30. The same price applies to every size, and there are no per-color charges." },
      { q: "What sports do you make uniforms for in Orlando?", a: "Baseball, softball, basketball, soccer, flag football, and volleyball, plus custom hats and full uniform bundles. Every sport uses the same free-design, roster-based ordering." },
      { q: "Is there a minimum order for Orlando teams?", a: "We run a six-piece minimum per design, which most Orlando teams clear easily. Embroidered hats have a six-hat minimum per design and are often ready in days." },
      { q: "Do I have to drive to Ocala to order?", a: "No. We deliver finished orders to Orlando or ship them, and the whole design and roster process happens online, so you never have to make the drive." },
      { q: "How long does an Orlando uniform order take?", a: "Most orders are ready 2 to 3 weeks after you approve the design and pay the 50% deposit. Rush production is available when your season sneaks up on you." },
      { q: "Are the jerseys really fully sublimated?", a: "Yes. Colors, logos, numbers, and pinstripes are dyed into the fabric, not pressed on top, so they will not crack or peel through an Orlando season." },
    ],
  },
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
