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

// Shared across metro pages: real jersey shots for "Recent Custom Work" and the
// ordering-process block (city name templated in). Keeps the city entries DRY.
const PORTFOLIO_PHOTOS = [
  { src: "/styles/basketball-reversible.jpg", alt: "Custom reversible basketball uniform, black and royal blue, made by Slugger Athletics" },
  { src: "/styles/basketball-pink-sets.jpg", alt: "Custom sublimated basketball uniforms, pink jersey and shorts sets by Slugger Athletics" },
  { src: "/styles/soccer-kit-black.jpg", alt: "Custom sublimated soccer kit, black and white striped jersey and shorts by Slugger Athletics" },
  { src: "/styles/football-game-jersey.jpg", alt: "Custom sublimated football game jersey by Slugger Athletics" },
];

const metroProcess = (city: string) => [
  { t: "1. Free design mockup", d: `Send your logo, colors, or an idea. Our designer sends back a ${city}-ready mockup, revisions included, before you pay anything.` },
  { t: "2. Share the roster link", d: `Approve the design, then share one link so every ${city} player picks their own size, name, and number. No spreadsheets, no chasing parents.` },
  { t: "3. Deposit and production", d: "A 50% deposit starts full sublimation production. Standard turnaround is 2 to 3 weeks, with rush available when your season sneaks up." },
  { t: `4. Delivery to ${city}`, d: `We deliver the finished set to your ${city} team or ship it, and each family keeps ordering through your free team store.` },
];

// Common closing FAQs every metro shares (cost, minimum, drive, turnaround).
const metroCommonFaqs = (city: string) => [
  { q: `How much do custom uniforms cost in ${city}?`, a: "Sublimated jerseys start at $28 with the design, names, and numbers included: $32 two-button, $35 full-button, $38 quarter-zip. Pants are $40 and embroidered hats $25 to $30. The same price applies to every size, and there are no per-color charges." },
  { q: "Is there a minimum order?", a: `We run a six-piece minimum per design, which most ${city} teams clear easily. Embroidered hats have a six-hat minimum per design and are often ready in days.` },
  { q: "Do I have to drive to Ocala to order?", a: `No. We deliver finished orders to ${city} or ship them, and the whole design and roster process happens online, so you never have to make the drive.` },
  { q: `How long does a ${city} uniform order take?`, a: "Most orders are ready 2 to 3 weeks after you approve the design and pay the 50% deposit. Rush production is available when your season sneaks up on you." },
];

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
    slug: "tampa",
    city: "Tampa",
    metro: true,
    proximity: "about 90 minutes south of our Ocala shop",
    metaTitle: "Custom Sports Uniforms Tampa FL | Slugger Athletics",
    metaDescription:
      "Custom sports uniforms in Tampa, FL: fully sublimated jerseys for baseball, softball, basketball, soccer, flag football, and volleyball. Free design, names and numbers included, from $28, delivered to Tampa teams.",
    h1: "Custom Sports Uniforms in Tampa, FL",
    intro:
      "Slugger Athletics builds custom sports uniforms for Tampa, FL teams: fully sublimated jerseys, complete uniform sets, and in-house embroidered hats, designed free and produced in our Central Florida shop. Tampa is one of the deepest travel baseball and softball markets in the state, and we outfit clubs across it with names, numbers, and unlimited colors sublimated in, honest 2026 pricing from $28, and delivery to the Bay.",
    blurb:
      "Tampa teams have no shortage of uniform options, and most are either an overpriced local printer or a national website that ships whatever the spreadsheet said. Slugger is the Central Florida alternative: real design proofs with revisions, per-player roster entry so nobody chases sizes, a free team store for parent orders, and delivery right to Tampa. Big-shop sublimation, small-shop service.",
    deepDive: [
      "Tampa is a travel-ball town, and travel teams live in their uniforms all summer. Ours are fully sublimated, so your colors, logos, numbers, and pinstripes are dyed into the fabric instead of pressed on top. It is the same construction the top programs wear, and it holds up through a Florida season of heat and back-to-back tournaments with no cracked numbers and no peeling logos.",
      "We outfit Tampa teams across every sport from one process. Send your logo and colors, or just an idea, and our in-house designer sends a mockup before you spend a dollar. Approve it, and your coaches and parents fill a shared roster link so every player's name, number, and size lands right, with a print-file check on every piece before production starts.",
    ],
    process: metroProcess("Tampa"),
    delivery:
      "Tampa is about 90 minutes from our Ocala shop, so distance is a non-issue. Full uniform sets are delivered to your Tampa team or shipped directly, and the whole design and roster process happens online. Central Florida service, no drive required.",
    faqs: [
      { q: "Do you outfit Tampa travel baseball and softball teams?", a: "That is most of what we do. Full-dye sublimated jerseys and complete sets for travel ball, rec league, high school, and adult league, with a free team store so each family orders their own gear." },
      ...metroCommonFaqs("Tampa"),
    ],
    realPhotos: PORTFOLIO_PHOTOS,
  },
  {
    slug: "st-petersburg",
    city: "St. Petersburg",
    metro: true,
    proximity: "about two hours south of our Ocala shop",
    metaTitle: "Custom Sports Uniforms St. Petersburg FL | Slugger Athletics",
    metaDescription:
      "Custom sports uniforms in St. Petersburg, FL: fully sublimated baseball, softball, basketball, soccer, and volleyball jerseys. Free design, names and numbers included, from $28, delivered to St. Pete teams.",
    h1: "Custom Sports Uniforms in St. Petersburg, FL",
    intro:
      "Slugger Athletics designs and produces custom sports uniforms for St. Petersburg, FL teams: fully sublimated jerseys, full uniform sets, and embroidered hats, made in our Central Florida shop. Pinellas County runs one of the busiest youth and adult ball scenes on the Gulf coast, from rec softball to travel baseball, and we outfit teams across it with free design and 2026 pricing from $28.",
    blurb:
      "St. Pete teams deserve better than an overpriced local printer or a national site that ships whatever the spreadsheet said. Slugger gives you real design proofs with revisions, per-player roster entry so nobody chases sizes, a free team store for parent orders, and delivery to St. Petersburg. Same big-shop sublimation, small-shop service.",
    deepDive: [
      "St. Petersburg softball and baseball run nearly year-round on the Gulf coast, and full sun is hard on cheap uniforms. Ours are fully sublimated, with your colors, logos, and numbers dyed into the fabric, so a St. Pete season of heat and tournaments will not crack a number or fade a logo. Racerback, sleeveless, or short-sleeve, every player picks her own cut while the design stays identical across the team.",
      "One process handles the whole roster. Send your logo and colors and our in-house designer sends a free mockup, revisions included. Approve it, share one roster link, and every St. Pete player picks their own size, name, and number, verified against a print-file check before anything is produced.",
    ],
    process: metroProcess("St. Petersburg"),
    delivery:
      "St. Petersburg is about two hours from our Ocala shop, so we make distance a non-issue. Full sets are delivered to your St. Pete team or shipped directly, and the entire design and roster process happens online.",
    faqs: [
      { q: "Do you make custom softball uniforms for St. Petersburg leagues?", a: "Yes. Racerback, sleeveless, or short-sleeve sublimated softball jerseys, plus full sets, for St. Pete rec and travel leagues. Every player picks her own cut and size through one roster link while the design stays the same." },
      ...metroCommonFaqs("St. Petersburg"),
    ],
    realPhotos: PORTFOLIO_PHOTOS,
  },
  {
    slug: "clearwater",
    city: "Clearwater",
    metro: true,
    proximity: "about two hours south of our Ocala shop",
    metaTitle: "Custom Sports Uniforms Clearwater FL | Slugger Athletics",
    metaDescription:
      "Custom sports uniforms in Clearwater, FL: fully sublimated baseball, softball, basketball, soccer, and volleyball jerseys. Free design, names and numbers included, from $28, delivered to Clearwater teams.",
    h1: "Custom Sports Uniforms in Clearwater, FL",
    intro:
      "Slugger Athletics builds custom sports uniforms for Clearwater, FL teams: fully sublimated jerseys, complete sets, and embroidered hats, designed free and produced in our Central Florida shop. Clearwater is a Pinellas ball town with a packed youth-sports calendar, and we outfit its teams with names, numbers, and unlimited colors sublimated in, at honest 2026 pricing from $28.",
    blurb:
      "Clearwater teams get big-shop custom uniforms with small-shop service from Slugger: free design proofs with revisions, per-player roster entry, a free team store for parent orders, and delivery right to Clearwater. No per-color charges, no surprises on price.",
    deepDive: [
      "Between the beaches and the ballfields, Clearwater teams put their uniforms through a lot of sun. Fully sublimated construction is why ours last: your colors, logos, numbers, and pinstripes are dyed into the polyester instead of pressed on top, so nothing cracks or peels through a full Clearwater season.",
      "Ordering is one clean process for the whole team. Our in-house designer sends a free mockup from your logo and colors, you approve it, and a shared roster link lets every Clearwater player pick their own size, name, and number, checked against a print file before production.",
    ],
    process: metroProcess("Clearwater"),
    delivery:
      "Clearwater is about two hours from our Ocala shop, so distance is a non-issue. We deliver your finished set to Clearwater or ship it directly, and the whole design and roster process is online.",
    faqs: [
      { q: "Can you match our Clearwater team's colors exactly?", a: "Yes. You pick exact colors from our color wheel, and everything, logos, numbers, and pinstripes, is dyed in with no per-color charge, so your whole set matches head to toe." },
      ...metroCommonFaqs("Clearwater"),
    ],
    realPhotos: PORTFOLIO_PHOTOS,
  },
  {
    slug: "lakeland",
    city: "Lakeland",
    metro: true,
    proximity: "about an hour south of our Ocala shop",
    metaTitle: "Custom Sports Uniforms Lakeland FL | Slugger Athletics",
    metaDescription:
      "Custom sports uniforms in Lakeland, FL: fully sublimated baseball, softball, basketball, soccer, and volleyball jerseys. Free design, names and numbers included, from $28, delivered to or picked up near Lakeland.",
    h1: "Custom Sports Uniforms in Lakeland, FL",
    intro:
      "Slugger Athletics builds custom sports uniforms for Lakeland, FL teams: fully sublimated jerseys, complete sets, and in-house embroidered hats, designed free and produced right up the road in our Ocala shop. Polk County is ball country, and we outfit its travel, rec, school, and adult teams with names, numbers, and unlimited colors sublimated in, at honest 2026 pricing from $28.",
    blurb:
      "Lakeland teams are close enough that Slugger feels like a local uniform shop: free design proofs with revisions, per-player roster entry, a free team store for parent orders, and either delivery to Lakeland or pickup at our Ocala shop. Same week on embroidered hats, no surprises on price.",
    deepDive: [
      "Lakeland teams play a long Florida season, and cheap heat-pressed jerseys do not survive it. Ours are fully sublimated: your colors, logos, numbers, and pinstripes are dyed into the fabric, so they hold up tournament after tournament with no cracking or peeling.",
      "The whole team orders from one process. Our in-house designer sends a free mockup from your logo and colors, you approve it, and a shared roster link lets every Lakeland player pick their own size, name, and number, verified against a print file before production starts.",
    ],
    process: metroProcess("Lakeland"),
    delivery:
      "Lakeland is only about an hour from our Ocala shop, so you get the closest thing to a local uniform shop: we deliver to your Lakeland team, or you swing by Ocala and grab the set, whichever is easier for your season.",
    faqs: [
      { q: "Are you close enough to Lakeland for pickup?", a: "Lakeland is about an hour from our Ocala shop, so you can pick up in Ocala or we deliver to you, whichever is easier for your team." },
      ...metroCommonFaqs("Lakeland"),
    ],
    realPhotos: PORTFOLIO_PHOTOS,
  },
  {
    slug: "kissimmee",
    city: "Kissimmee",
    metro: true,
    proximity: "about an hour and fifteen minutes southeast of our Ocala shop",
    metaTitle: "Custom Sports Uniforms Kissimmee FL | Slugger Athletics",
    metaDescription:
      "Custom sports uniforms in Kissimmee, FL: fully sublimated baseball, softball, basketball, soccer, and volleyball jerseys built for tournament teams. Free design, names and numbers included, from $28.",
    h1: "Custom Sports Uniforms in Kissimmee, FL",
    intro:
      "Slugger Athletics builds custom sports uniforms for Kissimmee, FL teams: fully sublimated jerseys, complete sets, and embroidered hats, designed free and produced in our Central Florida shop. Osceola County sits at the center of Florida's tournament scene, and we outfit its travel teams with names, numbers, and unlimited colors sublimated in, at honest 2026 pricing from $28.",
    blurb:
      "Kissimmee travel teams play weekend after weekend, and their uniforms have to keep up. Slugger delivers real design proofs with revisions, per-player roster entry so nobody chases sizes, a free team store for parent orders, and delivery to Kissimmee. Big-shop sublimation, small-shop service.",
    deepDive: [
      "Kissimmee is tournament country, and tournament teams wear their uniforms harder than anyone. Fully sublimated construction is built for it: your colors, logos, numbers, and pinstripes are dyed into the fabric, so a full weekend-after-weekend season will not crack a number or peel a logo. Home-and-away bundles give your team two looks in one order.",
      "One process outfits the whole roster. Our in-house designer sends a free mockup, you approve it, and a shared roster link lets every Kissimmee player pick their own size, name, and number, checked against a print file before anything is produced.",
    ],
    process: metroProcess("Kissimmee"),
    delivery:
      "Kissimmee is about an hour and fifteen minutes from our Ocala shop, so distance is a non-issue. We deliver your finished set to Kissimmee or ship it, and the whole design and roster process happens online.",
    faqs: [
      { q: "Do you outfit Kissimmee travel and tournament teams?", a: "Constantly. Full-dye sublimated sets built to survive a full tournament season, with a free team store so every family orders their own gear, and home-and-away bundles for teams that need two looks." },
      ...metroCommonFaqs("Kissimmee"),
    ],
    realPhotos: PORTFOLIO_PHOTOS,
  },
  {
    slug: "clermont",
    city: "Clermont",
    metro: true,
    proximity: "about 45 minutes southeast of our Ocala shop",
    metaTitle: "Custom Sports Uniforms Clermont FL | Slugger Athletics",
    metaDescription:
      "Custom sports uniforms in Clermont, FL: fully sublimated baseball, softball, basketball, soccer, and volleyball jerseys. Free design, names and numbers included, from $28, delivered to or picked up near Clermont.",
    h1: "Custom Sports Uniforms in Clermont, FL",
    intro:
      "Slugger Athletics builds custom sports uniforms for Clermont, FL teams: fully sublimated jerseys, complete sets, and in-house embroidered hats, designed free and produced just up the road in our Ocala shop. Lake County's sports scene is growing fast, anchored by the National Training Center, and we outfit its teams with names, numbers, and unlimited colors sublimated in, at honest 2026 pricing from $28.",
    blurb:
      "Clermont is close enough that Slugger is practically your local uniform shop: free design proofs with revisions, per-player roster entry, a free team store for parent orders, and either delivery to Clermont or pickup at our Ocala shop. No per-color charges, no surprises on price.",
    deepDive: [
      "Clermont teams train and compete hard, and their uniforms should match. Fully sublimated construction dyes your colors, logos, numbers, and pinstripes into the fabric instead of pressing them on top, so they hold up season after season with no cracking or peeling.",
      "The whole team orders from one simple process. Our in-house designer sends a free mockup from your logo and colors, you approve it, and a shared roster link lets every Clermont player pick their own size, name, and number, verified against a print file before production.",
    ],
    process: metroProcess("Clermont"),
    delivery:
      "Clermont is only about 45 minutes from our Ocala shop, so pickup is easy, or we deliver your finished set right to your Clermont team. The design and roster process is all online either way.",
    faqs: [
      { q: "Are you local to Clermont?", a: "Just about. Clermont is roughly 45 minutes from our Ocala shop, so you can pick up in Ocala or we deliver, and the design and roster process is all online." },
      ...metroCommonFaqs("Clermont"),
    ],
    realPhotos: PORTFOLIO_PHOTOS,
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
