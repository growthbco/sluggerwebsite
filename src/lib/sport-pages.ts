// Sport-specific uniform landing pages (multi-sport expansion). Shared data
// consumed by the /custom-<sport>-uniforms pages.

import type { Metadata } from "next";

export type SportPage = {
  slug: string; // URL path segment, e.g. "custom-basketball-uniforms"
  sport: string;
  h1: string;
  metaTitle: string;
  metaDescription: string;
  intro: string;
  mockup: string; // Slugger-branded mockup image
  offerings: { t: string; d: string }[];
  localBody: string;
  /** 2 sport-specific paragraphs of real content. */
  deepDive: string[];
  /** Sport-specific FAQs (rendered + FAQPage JSON-LD). */
  faqs: { q: string; a: string }[];
  /** Real product photos of gear we actually made (shown before gallery). */
  realPhotos?: { src: string; alt: string }[];
  /** Sport-specific rows for the pricing strip (from the 2026 price sheet). */
  pricing?: { label: string; cents: number }[];
};

export const SPORT_PAGES: SportPage[] = [
  {
    slug: "custom-baseball-uniforms",
    sport: "Baseball",
    h1: "Custom Baseball Uniforms",
    metaTitle: "Custom Baseball Uniforms & Jerseys - From $28, Free Design",
    metaDescription:
      "Custom sublimated baseball uniforms and jerseys from $28 - crew, two-button, full-button, and quarter-zip styles with names and numbers included. Free design, 6-piece minimum, made in Ocala FL.",
    intro:
      "Fully sublimated baseball jerseys and complete uniform sets - crew neck from $28, two-button $32, full-button $35 - with names, numbers, and unlimited colors included in the price. Travel ball, rec league, high school, or adult league: free design mockup first, production after you approve.",
    mockup: "/styles/full-button.jpg",
    offerings: [
      { t: "Every Jersey Style", d: "Crew neck, two-button, full-button, and quarter-zip - all fully custom sublimated with your design baked into the fabric." },
      { t: "Travel Ball Ready", d: "Home & Away bundles from $90 per player, matching hats, and per-player roster entry built for travel team parents." },
      { t: "Pants, Hats & Socks", d: "Complete the kit: baseball pants, in-house embroidered caps, and custom socks that match your design." },
      { t: "Print-File Verified", d: "Every roster is AI-checked against the print file before production - names and numbers come out right." },
    ],
    localBody:
      "We outfit baseball teams across Ocala, Marion County, and Central Florida - and ship nationwide. Local travel ball clubs get free design proofs, a team store for parent orders, and pickup at our Ocala shop.",
    deepDive: ["Baseball is where Slugger started, and it is still most of what leaves our shop. We build full-dye sublimated jerseys - the same construction the big travel programs wear - where your colors, logos, pinstripes, and numbers are dyed into the polyester instead of pressed on top. That means a 10U team's jerseys look as sharp in the last tournament of the season as the first, with no cracked numbers and no peeling logos.", "Every order starts with a free mockup from our in-house designer: send your logo and colors (or just an idea) and you will see your exact uniform before spending a dollar on production. Once you approve, your coaches and parents use a shared roster link so every player's name, number, and size lands correctly - and our AI print-file check verifies every piece against the roster before production starts."],
    faqs: [{"q": "How much do custom baseball uniforms cost?", "a": "Jerseys run $28 (crew), $32 (two-button), $35 (full-button), and $38 (quarter-zip) with the design included. Pants are $40, hats $25-30. Our Game Day bundle (jersey + pants + hat) starts at $85 per player."}, {"q": "How long does a baseball uniform order take?", "a": "Most orders ship 2-3 weeks after you approve the design and pay the deposit. Rush production is about a week when your season sneaks up on you."}, {"q": "Do you do travel ball home and away sets?", "a": "All the time - our Home & Away bundle (2 jerseys + pants) starts at $90 per player, and each family can buy their own set through your free team store."}],
    pricing: [{ label: "Jerseys from", cents: 2800 }, { label: "Full-button jerseys", cents: 3500 }, { label: "Custom pants", cents: 4000 }, { label: "Hats from", cents: 2500 }],
  },
  {
    slug: "custom-softball-uniforms",
    sport: "Softball",
    h1: "Custom Softball Uniforms",
    metaTitle: "Custom Softball Uniforms & Jerseys - Racerbacks, Free Design",
    metaDescription:
      "Custom sublimated softball uniforms - racerback and short-sleeve jerseys with names and numbers included, from $28. Free design mockup, fast turnaround, made in Ocala FL.",
    intro:
      "Custom sublimated softball jerseys - racerback, sleeveless, or short-sleeve - designed free and produced with your whole roster's names, numbers, and sizes. Fastpitch, slowpitch, church league, or The Villages rec ball: one roster link outfits the team.",
    mockup: "/styles/sport-softball.jpg",
    offerings: [
      { t: "Racerbacks & Sleeves", d: "Women's racerback, sleeveless, and short-sleeve cuts in the same custom design - every player picks their fit." },
      { t: "Matching Everything", d: "Pants, shorts, visors, snapbacks, and custom socks to complete the look." },
      { t: "Team Bundles", d: "Per-player bundle pricing - jersey, pants, and hat from $85." },
      { t: "Free Design, Real Proof", d: "See your exact design on a mockup before a single piece is produced - revisions included." },
    ],
    localBody:
      "From Ocala fastpitch to The Villages' massive rec softball scene, we outfit Central Florida softball teams with free design work and local pickup - and ship anywhere in the US.",
    deepDive: ["Softball uniforms have their own rules: racerbacks and sleeveless cuts have to fit right, colors run brighter, and half the roster wants a different cut than the other half. Our sublimated softball jerseys handle all of it - every player picks her own cut and size through the roster link while the design stays identical across the team.", "From Ocala fastpitch to The Villages' senior leagues, we outfit programs with a free design mockup first, revisions included, and production only after you approve. Names, numbers, and unlimited colors are part of the price - no per-color charges, ever."],
    faqs: [{"q": "How much do custom softball uniforms cost?", "a": "Sublimated jerseys start at $28 with the design, names, and numbers included. Racerback and sleeveless cuts price the same as short-sleeve - no upcharges by cut or size."}, {"q": "Can players choose different cuts in the same design?", "a": "Yes - racerback, sleeveless, or short-sleeve per player. Everyone picks their own cut and size through your team's roster link, and the design stays consistent."}, {"q": "Do you make matching visors and hats?", "a": "Yes - embroidered visors, snapbacks, and fitted caps are made in-house in Ocala with a 6-hat minimum per design, often ready in days."}],
    pricing: [{ label: "Jerseys from", cents: 2800 }, { label: "Practice jerseys", cents: 2000 }, { label: "Hats & visors from", cents: 2500 }, { label: "Bundles from", cents: 8500 }],
  },
  {
    slug: "custom-basketball-uniforms",
    sport: "Basketball",
    h1: "Custom Basketball Uniforms",
    metaTitle: "Custom Basketball Uniforms & Jerseys - Reversibles $85",
    metaDescription:
      "Custom sublimated basketball uniforms and reversible jerseys ($85 for two looks in one) with names and numbers included. Free design, made in Ocala FL, shipped nationwide.",
    intro:
      "Custom sublimated basketball jerseys and shorts - including reversible uniforms at $85 that give your squad home and away looks in a single piece. AAU, church league, school, or rec: free design mockup first, then production.",
    mockup: "/styles/sport-basketball.jpg",
    offerings: [
      { t: "Reversible Uniforms", d: "Two looks in one - our $85 reversible is the AAU favorite: flip it and you're in away colors." },
      { t: "Jersey + Shorts Sets", d: "Fully sublimated tops and matching shorts with your logos and player numbers." },
      { t: "Warmups & Shooters", d: "Hoodies, practice jerseys ($20), and shooting shirts that match your set." },
      { t: "Per-Player Roster Entry", d: "Share one link - every player enters their own name, number, and sizes." },
    ],
    localBody:
      "Ocala and Central Florida basketball programs get free design proofs, honest per-piece pricing, and local pickup - AAU clubs nationwide get the same design work with shipping to your gym.",
    deepDive: ["Basketball programs love one thing above all: the reversible. Ours is $85 for a fully sublimated uniform with home colors on one side and away on the other - one purchase, two looks, no second order halfway through the season. AAU clubs run them all year.", "Standard jersey-and-shorts sets are fully custom too, from youth rec leagues to men's league teams that want to look like they mean it. Free design mockup first, per-player sizing through the roster link, and matching practice jerseys at $20 for scrimmage nights."],
    faqs: [{"q": "How much are custom basketball uniforms?", "a": "Reversible uniforms are $85 (two looks in one). Standard sublimated jerseys start at $28, with matching shorts and $20 practice jerseys available in the same design."}, {"q": "Do you outfit AAU teams outside Florida?", "a": "Yes - design and approval happen online, and we ship nationwide. Central Florida teams can pick up at our Ocala shop."}, {"q": "Can we get names and numbers on both sides of a reversible?", "a": "Numbers yes - both sides are fully sublimated, so numbers on each side are included in the price. We will lay it out in your free mockup."}],
    realPhotos: [{ src: "/styles/basketball-reversible.jpg", alt: "Reversible custom basketball jersey - black side and royal blue MAVS side, made by Slugger Athletics" }, { src: "/styles/basketball-pink-sets.jpg", alt: "Custom sublimated basketball uniforms - pink and white and pink and purple claw-design jersey and shorts sets by Slugger Athletics" }, { src: "/styles/basketball-eagles-nightmare.jpg", alt: "Custom basketball uniforms - white and navy Eagles set and purple Nightmare jersey and shorts by Slugger Athletics" }, { src: "/styles/basketball-invention.jpg", alt: "Custom basketball uniform - black and orange hex-pattern corporate team jersey and shorts by Slugger Athletics" }],
    pricing: [{ label: "Reversible uniform", cents: 8500 }, { label: "Jerseys from", cents: 2800 }, { label: "Custom shorts", cents: 2500 }, { label: "Practice jerseys", cents: 2000 }],
  },
  {
    slug: "custom-soccer-uniforms",
    sport: "Soccer",
    h1: "Custom Soccer Uniforms",
    metaTitle: "Custom Soccer Uniforms & Kits - Jerseys from $28, Free Design",
    metaDescription:
      "Custom sublimated soccer jerseys and full kits from $28 - names, numbers, and club crests included. Free design mockup, made in Ocala FL, shipped nationwide.",
    intro:
      "Custom sublimated soccer kits - jerseys from $28 with your crest, sponsor logos, names, and numbers dyed into the fabric so they never peel or crack. Club, school, adult league, or co-ed rec: free design first, production after approval.",
    mockup: "/styles/sport-soccer.jpg",
    offerings: [
      { t: "Full Kits", d: "Jerseys, shorts, and custom socks in one matching design - per-player bundle pricing available." },
      { t: "Crests & Sponsors", d: "Unlimited colors and logos included - sponsor patches cost nothing extra with sublimation." },
      { t: "Keeper Kits", d: "Distinct goalkeeper colors in the same design language, sized per player." },
      { t: "Youth Through Adult", d: "Youth Small to 5X-Large at the same flat price - no size upcharges." },
    ],
    localBody:
      "We outfit soccer clubs across Marion County and Central Florida with free design work, per-player roster entry, and local pickup - and ship kits to clubs nationwide.",
    deepDive: ["Soccer kits live and die on the details: the crest has to be crisp, the sponsor logos have to be right, and the keeper needs to stand out without looking like a different team. Because our kits are fully sublimated, crests, sponsors, and pattern work cost nothing extra - the whole design is dyed into the fabric in one pass.", "We build kits for clubs, schools, and adult leagues: jerseys from $28, shorts and custom socks to match, and keeper kits in contrast colors within the same design language. Free mockup first, sizes youth through 5X at one price."],
    faqs: [{"q": "How much does a custom soccer kit cost?", "a": "Jerseys start at $28 with crests, sponsors, names, and numbers included. Add shorts ($25) and custom socks ($15) for a full kit - bundle pricing available per player."}, {"q": "Are sponsor logos extra?", "a": "No - sublimation prints the whole design at once, so sponsor logos, crests, and patterns are included no matter how many you add."}, {"q": "Can you do goalkeeper kits?", "a": "Yes - keeper kits come in contrast colors within your team's design so the ref is happy and the kit still looks like yours."}],
    realPhotos: [{ src: "/styles/soccer-kit-black.jpg", alt: "Custom sublimated soccer kit - black and white striped jersey and shorts made by Slugger Athletics" }, { src: "/styles/soccer-kit-blue.jpg", alt: "Custom sublimated soccer kit - royal blue and white youth jersey and shorts made by Slugger Athletics" }],
    pricing: [{ label: "Jerseys from", cents: 2800 }, { label: "Custom shorts", cents: 2500 }, { label: "Custom socks", cents: 1500 }, { label: "Practice jerseys", cents: 2000 }],
  },
  {
    slug: "custom-flag-football-uniforms",
    sport: "Flag Football",
    h1: "Custom Flag Football Uniforms",
    metaTitle: "Custom Flag Football Uniforms & Jerseys - Free Design",
    metaDescription:
      "Custom sublimated flag football jerseys with names and numbers included, from $28. Youth and adult leagues, free design mockup, made in Ocala FL.",
    intro:
      "Flag football is exploding across Florida - and your squad should look the part. Custom sublimated flag jerseys from $28 with names, numbers, and team colors dyed in, sized youth through adult at one flat price. Free design mockup before anything is produced.",
    mockup: "/styles/sport-flag-football.jpg",
    offerings: [
      { t: "Youth & Adult Leagues", d: "Same flat pricing from Youth Small to 5X-Large - outfit the whole league bracket." },
      { t: "Loose Game-Ready Fit", d: "Relaxed cuts built for flag pulls and Florida heat - breathable dry-fit fabric." },
      { t: "Matching Extras", d: "Shorts, snapbacks, and practice jerseys ($20) to complete the sideline look." },
      { t: "Fast Season Turnaround", d: "Most orders ship in 2-3 weeks after design approval - rush available for short seasons." },
    ],
    localBody:
      "From Ocala youth leagues to adult flag nights, we keep Central Florida flag teams looking sharp - free designs, per-player sizing, and pickup at the shop.",
    deepDive: ["Flag football is the fastest-growing team sport in Florida - youth leagues, adult co-ed nights, and now girls' high school flag. We build loose, breathable sublimated jerseys made for flag pulls and July humidity, with names and numbers dyed in so they survive a whole season of turf.", "Leagues love ordering with us because every team can run its own colorway inside one design family, and each roster fills itself through a shared link - no size spreadsheets, no collecting cash."],
    faqs: [{"q": "How much are custom flag football jerseys?", "a": "Sublimated jerseys start at $28 with names and numbers included, youth through adult sizes at one flat price. Practice-weight dry-fit shirts are $20."}, {"q": "Can you outfit an entire league?", "a": "Yes - we run one design family with a different colorway per team, and each team gets its own roster link. Ask about league pricing on the total piece count."}, {"q": "How fast can a flag order turn around?", "a": "Most orders ship 2-3 weeks after design approval; rush is about a week. Short season? Start the free design now and lock sizes later."}],
    pricing: [{ label: "Jerseys from", cents: 2800 }, { label: "Custom shorts", cents: 2500 }, { label: "Practice jerseys", cents: 2000 }, { label: "Hats from", cents: 2500 }],
  },
  {
    slug: "custom-football-uniforms",
    sport: "Football",
    h1: "Custom Football Uniforms",
    metaTitle: "Custom Football Uniforms & Jerseys - Free Design, Ocala FL",
    metaDescription:
      "Custom sublimated football jerseys and uniforms with names and numbers included. Youth leagues to adult flag and 7v7 - free design mockup, made in Ocala FL.",
    intro:
      "Custom sublimated football jerseys built for Friday nights and Saturday mornings - names, numbers, and team colors dyed into breathable performance fabric. Youth tackle, 7v7, or adult league: free design mockup first, production after you approve.",
    mockup: "/styles/sport-football.jpg",
    offerings: [
      { t: "Game & Practice Jerseys", d: "Sublimated game jerseys plus $20 dry-fit practice shirts in the same design language." },
      { t: "7v7 & Tournament Sets", d: "Lightweight kits built for passing leagues and tournament weekends." },
      { t: "Sideline Gear", d: "Hoodies, quarter-zips, and embroidered caps for coaches and the sideline crew." },
      { t: "Youth Through Adult", d: "Youth Small to 5X-Large at the same flat price - no size upcharges." },
    ],
    localBody:
      "From Marion County youth football to adult leagues across Central Florida, we outfit programs with free design work and local pickup - and ship nationwide.",
    deepDive: ["From youth tackle programs to 7v7 circuits, football uniforms take the most abuse of any sport we make - which is exactly why sublimation matters. Numbers and logos dyed into the fabric cannot crack in a pile-up or peel in the wash, and the breathable poly holds up under pads.", "We outfit full programs: game jerseys, $20 dry-fit practice shirts in team colors, and sideline gear - hoodies, quarter-zips, and embroidered caps for coaches and staff, all in one design language."],
    faqs: [{"q": "How much are custom football jerseys?", "a": "Sublimated game jerseys start at $28 with numbers and names included; practice-weight dry-fit shirts are $20. Sideline hoodies are $40 and embroidered caps $25-30."}, {"q": "Do the jerseys work with pads?", "a": "Yes - we size for over-pads wear on tackle orders. Tell us the age group and we will recommend sizing in your free mockup review."}, {"q": "Can you outfit coaches and staff to match?", "a": "Absolutely - matching polos, quarter-zips, hoodies, and caps in the same design family, added to the same team order."}],
    realPhotos: [{ src: "/styles/football-game-jersey.jpg", alt: "Custom sublimated tackle football game jersey - red Georgia design with over-pads cut and mesh panels, made by Slugger Athletics" }, { src: "/styles/football-palms.jpg", alt: "Custom youth football game jersey - black with blue and purple palm tree sublimation, Slugger Athletics house design" }],
    pricing: [{ label: "Game jerseys from", cents: 2800 }, { label: "Practice jerseys", cents: 2000 }, { label: "Sideline hoodies", cents: 4000 }, { label: "Hats from", cents: 2500 }],
  },
  {
    slug: "custom-pickleball-shirts",
    sport: "Pickleball",
    h1: "Custom Pickleball Shirts",
    metaTitle: "Custom Pickleball Shirts & Team Jerseys - Free Design",
    metaDescription:
      "Custom pickleball shirts and club jerseys - dry-fit performance fabric with your club name and colors, from $20. Free design, made in Ocala FL near The Villages.",
    intro:
      "Pickleball clubs deserve better than plain tees. Custom dry-fit pickleball shirts from $20 - your club name, colors, and sponsors sublimated into breathable performance fabric that handles Florida heat. Free design mockup before anything is produced.",
    mockup: "/styles/sport-pickleball.jpg",
    offerings: [
      { t: "Club Shirts from $20", d: "Dry-fit practice-weight shirts for the whole club, or premium jersey builds from $28." },
      { t: "Ladder & League Sets", d: "Distinct colorways per team within one club design - great for intramural ladders." },
      { t: "The Villages Ready", d: "We are minutes from the biggest pickleball scene in America - local pickup or delivery." },
      { t: "Hats & Visors", d: "In-house embroidered caps and visors that match the shirts - 6 per design gets you started." },
    ],
    localBody:
      "Between Ocala, Top of the World, and The Villages, Central Florida is pickleball country - and we are its local custom shirt shop. Club orders get free design and quick local turnaround.",
    deepDive: ["Central Florida is the pickleball capital of America, and club shirts are how you tell your ladder from the visitors. Our $20 dry-fit shirts carry your club name, colors, and sponsors in full sublimation - breathable enough for an August round-robin, sharp enough for tournament photos.", "Clubs order with one shared link: every member picks their own size (and name on the back if you want), pays for their own shirt through your free club store, and we produce the whole batch in one run. No treasurer required."],
    faqs: [{"q": "How much are custom pickleball shirts?", "a": "Quality dry-fit club shirts are $20 each with your design included. Premium jersey builds start at $28, and matching embroidered visors and hats start at 6 per design."}, {"q": "Can members buy their own shirts?", "a": "Yes - we set up a free online club store where every member orders and pays for their own shirt and size. The club never collects money."}, {"q": "Do you serve The Villages?", "a": "We are about 40 minutes north in Ocala - delivery to The Villages or pickup at the shop, whichever your club prefers."}],
    pricing: [{ label: "Dry-fit club shirts", cents: 2000 }, { label: "Premium jerseys from", cents: 2800 }, { label: "Hats & visors from", cents: 2500 }, { label: "Quarter-zips", cents: 3800 }],
  },
  {
    slug: "custom-volleyball-uniforms",
    sport: "Volleyball",
    h1: "Custom Volleyball Uniforms",
    metaTitle: "Custom Volleyball Uniforms & Jerseys - Free Design",
    metaDescription:
      "Custom sublimated volleyball jerseys and uniforms with names and numbers included, from $28. Club, school, and beach teams - free design, made in Ocala FL.",
    intro:
      "Custom sublimated volleyball jerseys - indoor, beach, or club - with numbers, names, and libero sets handled correctly. From $28 per jersey with the design included, sized youth through adult at one flat price.",
    mockup: "/styles/sport-volleyball.jpg",
    offerings: [
      { t: "Indoor & Beach Kits", d: "Jerseys, shorts, and tanks in matching designs - libero contrast sets included." },
      { t: "Club Season Packages", d: "Home & away bundle pricing per player for club season schedules." },
      { t: "Practice Gear", d: "$20 dry-fit practice shirts in your club design for every gym session." },
      { t: "Fast School Turnaround", d: "Most orders ship 2-3 weeks after approval - rush available for season starts." },
    ],
    localBody:
      "We outfit school and club volleyball across Marion County and Central Florida with free designs and local pickup - and ship club kits nationwide.",
    deepDive: ["Volleyball kits need to move - and the libero needs contrast that officials accept. We build sublimated indoor and beach kits where every jersey, tank, and short comes from one design, with libero sets handled correctly from the first mockup.", "Club seasons are long: our bundles price a home-and-away set per player, and $20 practice shirts in the same design keep every gym session on brand."],
    faqs: [{"q": "How much do custom volleyball jerseys cost?", "a": "Sublimated jerseys start at $28 with numbers and names included; shorts and tanks match in the same design. Practice shirts are $20."}, {"q": "Do you handle libero jerseys?", "a": "Yes - libero contrast sets come standard in our layouts so your kit passes officials' checks without looking like an afterthought."}, {"q": "Can each player pick her own size?", "a": "Yes - share one roster link and every player enters her own name, number, and sizes. No spreadsheets."}],
    pricing: [{ label: "Jerseys from", cents: 2800 }, { label: "Custom shorts", cents: 2500 }, { label: "Practice jerseys", cents: 2000 }, { label: "Quarter-zips", cents: 3800 }],
  },
  {
    slug: "custom-hockey-jerseys",
    sport: "Hockey",
    h1: "Custom Hockey Jerseys",
    metaTitle: "Custom Hockey Jerseys - Sublimated, Free Design",
    metaDescription:
      "Custom sublimated hockey jerseys with names and numbers included. Ice, roller, and ball hockey teams - free design mockup, made in Ocala FL.",
    intro:
      "Custom sublimated hockey jerseys for ice, roller, and ball hockey - full team designs with names, numbers, and shoulder yokes dyed in, never cracked or peeled. Free design mockup first; beer league logos welcome.",
    mockup: "/styles/sport-hockey.jpg",
    offerings: [
      { t: "Ice, Roller & Ball", d: "Loose athletic cuts sized for pads or none - your call per roster." },
      { t: "Home & Away Sets", d: "Two-jersey bundles per player so your squad matches on both ends of the schedule." },
      { t: "Beer League Friendly", d: "Bold logos, nicknames on the back, no judgment - 6-piece minimum per design." },
      { t: "Matching Extras", d: "Hoodies, practice shirts, and embroidered beanies-to-caps for the bench." },
    ],
    localBody:
      "Florida hockey is real - from Central Florida roller rinks to travel ice programs, we build custom jerseys with free design work, local pickup in Ocala, and nationwide shipping.",
    deepDive: ["Florida hockey is real - roller rinks, ball hockey leagues, and travel ice programs all over the state. We make loose-cut sublimated hockey jerseys with proper shoulder yokes and lace-collar looks, sized for pads or none, with every logo and number dyed in.", "Beer leagues get the same treatment as travel programs: bold logos, nicknames on the back if that is your thing, and a free mockup before anything is produced. 6-piece minimum per design."],
    faqs: [{"q": "How much are custom hockey jerseys?", "a": "Sublimated hockey jerseys start at $28 with names, numbers, and unlimited colors included in the design."}, {"q": "Are they cut for pads?", "a": "Your call per roster - we size loose for ice with pads or trimmer for roller and ball hockey. Mixed rosters are fine."}, {"q": "Can we put nicknames instead of last names?", "a": "Yes - whatever your league allows, we print. Each player enters their own name through the roster link."}],
    pricing: [{ label: "Jerseys from", cents: 2800 }, { label: "Practice jerseys", cents: 2000 }, { label: "Hoodies", cents: 4000 }, { label: "Hats from", cents: 2500 }],
  },
  {
    slug: "custom-bowling-shirts",
    sport: "Bowling",
    h1: "Custom Bowling Shirts",
    metaTitle: "Custom Bowling Shirts - Retro & Modern, Free Design",
    metaDescription:
      "Custom bowling shirts - retro camp-collar or modern jersey styles with your league name and sponsors, from $28. Free design, made in Ocala FL.",
    intro:
      "League night deserves a proper shirt. Custom bowling shirts in retro camp-collar or modern jersey styles - names, nicknames, and sponsor logos sublimated in, from $28 with the design included. Free mockup before production.",
    mockup: "/styles/sport-bowling.jpg",
    offerings: [
      { t: "Retro Camp Collars", d: "The classic bowling look - two-tone panels, back graphics, and embroidered-style names." },
      { t: "Modern Jersey Cuts", d: "Dry-fit crew and button styles for leagues that want the athletic look." },
      { t: "Sponsor Logos Free", d: "Sublimation means sponsor logos and back panels cost nothing extra." },
      { t: "League Packages", d: "Outfit the whole league - per-team colorways within one design family." },
    ],
    localBody:
      "From Ocala league nights to tournament travel teams, we make custom bowling shirts with free design work and local pickup - and ship to leagues nationwide.",
    deepDive: ["A league team in matching custom shirts just bowls better - that is science we refuse to check. We make both the classic retro camp-collar bowling shirt and modern dry-fit jersey cuts, with team names, nicknames, and sponsor logos sublimated into the fabric.", "Sponsor bars love us: logos cost nothing extra with sublimation, so your backer gets prime real estate on the back panel without changing the price of the shirt."],
    faqs: [{"q": "How much are custom bowling shirts?", "a": "Custom bowling shirts start at $28 with your full design - team name, nicknames, and sponsor logos - included. 6-piece minimum per design."}, {"q": "Can you do the retro camp-collar style?", "a": "Yes - the classic two-tone camp collar look is our favorite bowling build, alongside modern dry-fit crews for teams that want the athletic cut."}, {"q": "Are sponsor logos extra?", "a": "No - sublimation prints everything at once, so sponsor logos and back panels are included."}],
    pricing: [{ label: "Bowling shirts from", cents: 2800 }, { label: "Dry-fit shirts", cents: 2000 }, { label: "Hats from", cents: 2500 }, { label: "Quarter-zips", cents: 3800 }],
  },
];

/** Full page metadata for a sport landing page, including a sport-specific
 *  Open Graph / Twitter card image (the mockup) so a shared link shows that
 *  sport's uniform instead of a generic logo. */
export function sportMetadata(page: SportPage): Metadata {
  const url = `https://sluggerathletics.com/${page.slug}`;
  return {
    title: page.metaTitle,
    description: page.metaDescription,
    alternates: { canonical: `/${page.slug}` },
    openGraph: {
      type: "website",
      siteName: "Slugger Athletics",
      title: page.metaTitle,
      description: page.metaDescription,
      url,
      images: [{ url: page.mockup, width: 1200, height: 630, alt: page.h1 }],
    },
    twitter: { card: "summary_large_image", title: page.metaTitle, description: page.metaDescription, images: [page.mockup] },
  };
}
