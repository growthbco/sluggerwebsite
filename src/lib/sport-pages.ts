// Sport-specific uniform landing pages (multi-sport expansion). Shared data
// consumed by the /custom-<sport>-uniforms pages.

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
      { t: "Hats & Visors", d: "In-house embroidered caps and visors that match the shirts, no minimum." },
    ],
    localBody:
      "Between Ocala, Top of the World, and The Villages, Central Florida is pickleball country - and we are its local custom shirt shop. Club orders get free design and quick local turnaround.",
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
  },
];
