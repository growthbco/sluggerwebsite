// Product-aware mockup prompts. One AI image engine, many products: jerseys,
// embroidered hats, hype chains, hoodies, pants, socks. Each product needs its
// own scene description (embroidered vs sublimated, which views to show, what
// "floating ghost" means for that item) so the concept reads like a real
// e-commerce product shot.

export type ProductType = "jersey" | "hat" | "hype-chain" | "hoodie" | "pants" | "socks" | "cheer" | "shorts" | "jacket";

// Shared Sport -> Item -> Style taxonomy for BOTH the staff studio and the
// customer-facing Jersey Maker, so they never drift. Each item maps to a mockup
// `product` + the `sport` string fed to the AI + its style choices. Add a sport
// or item here and both pickers update. "Standard" style = the default look
// (sent to the API as no explicit style).
// Consistent Slugger branding + layout appended to EVERY jersey mockup, so the
// output is always ONE image (front + back) with our logo placement - never two
// separate images and never a random AI-invented brand mark.
export const JERSEY_BRANDING =
  "LAYOUT (critical): the FRONT (left) and BACK (right) of the SAME jersey MUST appear together in ONE single landscape image - never output two separate images. BRANDING: place a small Slugger Athletics 'SA' logo centered at the TOP of the BACK just below the collar, and a small woven SA size/jock tag at the FRONT bottom-right hem. Do NOT add any other brand mark, swoosh, or invented team-manufacturer logo.";

export type StudioItem = { product: ProductType; label: string; sport?: string; styles: string[] };
export type StudioSport = { key: string; label: string; items: StudioItem[] };

export type HatReferenceAsset = {
  src: string;
  mime: "image/png" | "image/jpeg";
  label: string;
};

const FITTED_HAT_REFERENCE: HatReferenceAsset = {
  src: "/products/hats/mamba-m-flexfit.jpg",
  mime: "image/jpeg",
  label: "Fitted Flexfit sample",
};

const SNAPBACK_HAT_REFERENCE: HatReferenceAsset = {
  src: "/media/90s-Snap-Back.png",
  mime: "image/png",
  label: "Structured mesh-back snapback sample",
};

/** The real hat blank/photo used to hold the correct silhouette during image
 * generation. The AI is told to copy only its construction, never its existing
 * embroidery, colors, labels, or stickers. */
export function hatReferenceAsset(style?: string | null): HatReferenceAsset {
  return /snap|trucker/i.test(style ?? "") ? SNAPBACK_HAT_REFERENCE : FITTED_HAT_REFERENCE;
}

export const SPORT_MENU: StudioSport[] = [
  {
    key: "baseball",
    label: "Baseball / Softball",
    items: [
      { product: "jersey", label: "Jersey", sport: "baseball", styles: ["Standard Crew Neck", "V-Neck", "Two Button", "Full Button", "Quarter-Zip"] },
      { product: "pants", label: "Pants", sport: "baseball", styles: ["Standard", "Knicker"] },
      { product: "hat", label: "Hat", sport: "baseball", styles: ["Fitted", "Snapback"] },
      { product: "socks", label: "Socks", sport: "baseball", styles: ["Standard"] },
    ],
  },
  {
    key: "cheer",
    label: "Cheer",
    items: [
      { product: "cheer", label: "Sideline Set", sport: "cheer", styles: ["Shell + Skirt", "Rhinestone Shell + Skirt"] },
      { product: "cheer", label: "Competition Set", sport: "cheer", styles: ["Crop Top + Shorts (all-star)", "Rhinestone Crop + Shorts"] },
    ],
  },
  {
    key: "basketball",
    label: "Basketball",
    items: [
      { product: "jersey", label: "Jersey", sport: "basketball", styles: ["Reversible", "Single-Layer"] },
      { product: "shorts", label: "Shorts", sport: "basketball", styles: ["Standard"] },
    ],
  },
  {
    key: "flag_football",
    label: "Flag Football",
    items: [
      { product: "jersey", label: "Jersey (Sleeveless)", sport: "flag football", styles: ["V-Neck", "Crew Neck"] },
      { product: "shorts", label: "Shorts", sport: "flag football", styles: ["Standard"] },
    ],
  },
  {
    key: "soccer",
    label: "Soccer",
    items: [
      { product: "jersey", label: "Jersey", sport: "soccer", styles: ["V-Neck", "Crew Neck"] },
      { product: "shorts", label: "Shorts", sport: "soccer", styles: ["Standard"] },
      { product: "socks", label: "Socks", sport: "soccer", styles: ["Standard"] },
    ],
  },
  {
    key: "volleyball",
    label: "Volleyball",
    items: [
      { product: "jersey", label: "Jersey", sport: "volleyball", styles: ["Standard Crew Neck", "V-Neck"] },
      { product: "shorts", label: "Spandex Shorts", sport: "volleyball", styles: ["Standard"] },
    ],
  },
  {
    key: "pickleball",
    label: "Pickleball",
    items: [
      // Pickleball jersey is essentially a softball crew-neck.
      { product: "jersey", label: "Jersey", sport: "pickleball", styles: ["Standard Crew Neck", "V-Neck"] },
    ],
  },
  {
    key: "bowling",
    label: "Bowling",
    items: [
      // Bowling shirts run button-up OR crew - offer both.
      { product: "jersey", label: "Shirt", sport: "bowling", styles: ["Two Button", "Full Button", "Standard Crew Neck"] },
    ],
  },
  {
    key: "hockey",
    label: "Hockey",
    items: [
      // Hockey "jersey" is a sweater; the prompt renders proper hockey styling.
      { product: "jersey", label: "Jersey", sport: "hockey", styles: ["Standard Collar", "Lace-Up Collar"] },
    ],
  },
  {
    key: "hats",
    label: "Hats",
    items: [
      { product: "hat", label: "Fitted Hat", sport: "baseball", styles: ["Fitted"] },
      { product: "hat", label: "Snapback Hat", sport: "baseball", styles: ["Snapback"] },
    ],
  },
  {
    key: "extras",
    label: "Extras (any sport)",
    items: [
      { product: "hoodie", label: "Hoodie", styles: ["Pullover", "Quarter-Zip"] },
      { product: "jacket", label: "Warm-Up Jacket", styles: ["Full-Zip", "Quarter-Zip"] },
      { product: "hat", label: "Hat", styles: ["Fitted", "Snapback"] },
      { product: "socks", label: "Socks", styles: ["Standard"] },
      { product: "hype-chain", label: "Hype Chain", styles: ["Standard"] },
    ],
  },
];

export const PRODUCTS: { id: ProductType; label: string; noun: string }[] = [
  { id: "jersey", label: "Jersey", noun: "jersey" },
  { id: "cheer", label: "Cheer uniform", noun: "cheer uniform" },
  { id: "hat", label: "Embroidered hat", noun: "cap" },
  { id: "hype-chain", label: "Hype chain", noun: "hype chain" },
  { id: "hoodie", label: "Hoodie", noun: "hoodie" },
  { id: "jacket", label: "Warm-up jacket", noun: "warm-up jacket" },
  { id: "pants", label: "Pants", noun: "pants" },
  { id: "shorts", label: "Shorts", noun: "shorts" },
  { id: "socks", label: "Socks", noun: "socks" },
];

export function productNoun(p: ProductType): string {
  return PRODUCTS.find((x) => x.id === p)?.noun ?? "product";
}

// Image models don't reliably understand raw hex, so describe each color in
// words before it hits the prompt. A plain nearest-neighbor against a coarse
// palette badly mislabels PASTELS (e.g. #E292FE pale purple -> "silver",
// #B1DD8B pale green -> "tan"), which painted whole jerseys the wrong color.
// Instead: derive the true HUE from HSL and add a light/dark qualifier, and
// append the exact hex so a capable model can lock the shade. Non-hex input
// (already a name) passes through.
export function colorName(input: string): string {
  const s = input.trim();
  const m = s.match(/^#?([0-9a-fA-F]{6})$/);
  if (!m) return s; // already a name
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const hex = `#${m[1].toUpperCase()}`;

  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn), d = max - min;
  const L = (max + min) / 2;
  const S = d === 0 ? 0 : d / (1 - Math.abs(2 * L - 1));

  // Near-neutral: name by lightness, not hue.
  if (S < 0.12) {
    const grayName = L > 0.85 ? "white" : L > 0.6 ? "light gray" : L > 0.32 ? "gray" : L > 0.1 ? "charcoal" : "black";
    return `${grayName} (${hex})`;
  }

  let H = 0;
  if (max === rn) H = ((gn - bn) / d) % 6;
  else if (max === gn) H = (bn - rn) / d + 2;
  else H = (rn - gn) / d + 4;
  H = H * 60; if (H < 0) H += 360;

  const hue =
    H < 15 ? "red" : H < 40 ? "orange" : H < 65 ? "yellow" :
    H < 85 ? "yellow-green" : H < 160 ? "green" : H < 195 ? "teal" :
    H < 250 ? "blue" : H < 290 ? "purple" : H < 330 ? "magenta" : "red";
  const qualifier = L > 0.7 ? "light " : L < 0.3 ? "dark " : "";
  return `${qualifier}${hue} (${hex})`;
}

/** Frame shape per product. A hanging hype-chain necklace reads best tall;
 *  everything else is the side-by-side landscape front/back. */
export function productAspect(p: ProductType): string {
  return p === "hype-chain" ? "3:4" : "4:3";
}

// Framing: most products fill the frame; the hype chain must instead show the
// WHOLE necklace + pendant without cropping, so it gets its own framing line.
const FRAME_TIGHT =
  "Frame the product large and close-up so it fills most of the image with only a small even margin; do not leave big empty white space or push it far into the distance.";
const FRAME_FULL =
  "Zoom out enough that the ENTIRE piece - the whole chain loop AND the complete pendant - is fully visible with clear empty margin on ALL sides. Nothing is cropped or touching any edge; the bottom of the pendant must have space beneath it.";
const GUARDRAIL =
  "Premium, print-ready, tasteful. No mannequin, no human, no watermark. Do NOT add any MLB, NBA, NFL, or other league logos, no pro-team marks, no swooshes or brand logos - use ONLY the team's own name and any logo the customer provided.";

type PromptInput = {
  sport?: string | null;
  style?: string;
  colors: string; // comma-separated
  teamName?: string | null;
  backNumber?: string | null;
  vision?: string | null;
  instruction?: string;
  hasRef?: boolean;
  hasPendantLogo?: boolean; // hype chain: a logo image was supplied for the pendant
};

/** Build the "generate a fresh mockup" prompt for a given product type. */
export function buildProductPrompt(product: ProductType, i: PromptInput): string {
  const sport = i.sport || "baseball";
  const style = (i.style ?? "").trim();
  const team = i.teamName?.trim();
  const lines: string[] = [];

  switch (product) {
    case "hat":
      if (/snap|trucker/i.test(style)) {
        lines.push(
          "Professional e-commerce product mockup of a custom EMBROIDERED structured trucker-style SNAPBACK cap, floating on a pure white background with studio lighting. Show a FRONT three-quarter view (left) and a REAR three-quarter view (right) of the same cap so the adjustable snap closure is visible.",
          "Construction must be a high-profile structured solid front crown, breathable mesh back panels, curved stitched brim, and adjustable plastic snap closure. It is one-size-fits-most; it is NOT a closed-back fitted cap.",
        );
      } else {
        lines.push(
          "Professional e-commerce product mockup of a custom EMBROIDERED Flexfit-style FITTED cap, floating on a pure white background with studio lighting. Show a FRONT three-quarter view (left) and a REAR/SIDE three-quarter view (right) of the same cap.",
          "Construction must be a structured six-panel stretch-fit cap with a closed fabric back, no opening and no plastic snap closure, clean stitched eyelets, and a structured flat-to-gently-curved brim.",
        );
      }
      lines.push(
        "The team emblem is EMBROIDERED on the front crown with realistic raised 3D thread texture and stitching; add a small matching embroidered mark on one side panel.",
        i.backNumber ? `Embroider player number "${i.backNumber}" small and centered on the back of the cap.` : "",
        `Colors: ${i.colors} (crown, brim, mesh when applicable, and emblem thread).`,
        team ? `Team emblem/name: "${team}".` : "",
      );
      break;
    case "hype-chain":
      // Kept deliberately short: the REFERENCE CHAIN photo and PENDANT LOGO
      // images (sent by the caller) carry the design. Over-prompting hurts.
      lines.push(
        "A custom 3D-printed plastic hype chain necklace, same style and construction as the REFERENCE CHAIN photo.",
        i.hasPendantLogo
          ? `The pendant hanging at the bottom is a flat 3D-printed piece of the provided PENDANT LOGO. Chain links in ${i.colors}.`
          : team
            ? `The pendant is a flat 3D-printed "${team}" nameplate. Chain links in ${i.colors}.`
            : `The pendant is a flat 3D-printed team logo. Chain links in ${i.colors}.`,
        "Show the whole necklace laid flat, fully in frame.",
      );
      break;
    case "hoodie":
      lines.push(
        `Professional e-commerce product mockup of a custom fully SUBLIMATED (all-over dye-sublimation print, not embroidery or screen print) team ${sport} hoodie (pullover hooded sweatshirt)${style ? `, ${style}` : ""}, floating ghost-mannequin style on a pure white background with studio lighting. Show the FRONT (left) and BACK (right) side by side.`,
        team ? `Team name "${team}" across the chest and a larger graphic across the back in bold athletic lettering.` : "Bold athletic team graphic on chest and back.",
        `Colors: ${i.colors}.`,
      );
      break;
    case "pants":
      lines.push(
        `Professional e-commerce product mockup of custom fully SUBLIMATED (all-over dye-sublimation print, not embroidery or screen print) team ${sport} pants (athletic game pants)${style ? `, ${style}` : ""}, floating ghost-mannequin style on a pure white background with studio lighting. Show a FRONT view and a SIDE/BACK view side by side.`,
        "Tasteful contrast piping/braid down the outside seam in the accent color; clean waistband and belt loops.",
        `Colors: ${i.colors} (base and piping).`,
      );
      break;
    case "socks":
      lines.push(
        "Professional e-commerce product mockup of custom fully SUBLIMATED (all-over dye-sublimation print, not embroidery or screen print) team athletic socks - a matching PAIR standing side by side - on a pure white background with studio lighting, front view.",
        "Bold stripes/pattern and a small woven team monogram near the top; crew-height athletic knit texture.",
        `Colors: ${i.colors}.`,
        team ? `Team monogram: "${team}".` : "",
        "No legs, no feet, no human - just the socks.",
      );
      break;
    case "cheer": {
      const rhinestone = /rhinestone|bling|crystal|stone/i.test(style);
      lines.push(
        `Professional e-commerce product mockup of a custom fully SUBLIMATED (all-over dye-sublimation print, not embroidery) two-piece cheerleading uniform SET${style ? `, ${style}` : ""}, floating ghost-mannequin style on a pure white background with studio lighting. Show the fitted shell TOP and the matching pleated skirt (with a built-in brief) TOGETHER - the top above the skirt, both front-facing.`,
        team ? `Team name "${team}" across the chest of the shell in bold athletic lettering.` : "",
        `Colors: ${i.colors}.`,
        "Classic cheer styling: a V-neck or scoop-neck shell with contrast chevron / stripe accents across the waist, and matching accents on an A-line pleated skirt.",
        rhinestone
          ? "RHINESTONES (make them prominent and sparkly, catching the light): a dense band of rhinestones / crystals along the collar and neckline, running the full chevron across the shell, all along the skirt waistband, and edging the skirt hem, with rhinestone accents down the sleeves - competition-quality bling, like a premium all-star cheer uniform."
          : "",
      );
      break;
    }
    case "jacket": {
      const quarterZip = /quarter|1\/4/i.test(style);
      lines.push(
        `Professional e-commerce product mockup of a custom fully SUBLIMATED (all-over dye-sublimation print, not embroidery or screen print) LIGHTWEIGHT team ${sport} warm-up jacket (a thin athletic ${quarterZip ? "quarter-zip pullover warmup with a short zip at the stand-up collar" : "full-zip track/warmup jacket with a front zipper running the full length and a stand-up collar"}, ribbed cuffs and hem), floating ghost-mannequin style on a pure white background with studio lighting. Show the FRONT (left) and BACK (right) side by side, zipper closed.`,
        team ? `Team name "${team}" on the left chest and a larger graphic across the back in bold athletic lettering.` : "Team graphic on the left chest and across the back.",
        `Colors: ${i.colors} (body, sleeves, collar, and zipper trim).`,
      );
      break;
    }
    case "shorts":
      lines.push(
        `Professional e-commerce product mockup of custom fully SUBLIMATED (all-over dye-sublimation print, not embroidery or screen print) team ${sport} athletic shorts${style ? `, ${style}` : ""}, floating ghost-mannequin style on a pure white background with studio lighting. Show a FRONT view and a BACK view side by side.`,
        "Elastic waistband; contrast side panels or stripe in the accent color.",
        team ? `Small team mark "${team}" on the leg or hip.` : "",
        `Colors: ${i.colors}.`,
      );
      break;
    case "jersey":
    default: {
      const isBasketball = /basket/i.test(sport);
      const isHockey = /hockey/i.test(sport);
      const isFlagFootball = /flag[\s-]?football/i.test(sport);
      const reversible = /reversible/i.test(style);
      if (isBasketball) {
        lines.push(
          `Professional e-commerce product mockup of a fully custom sublimated BASKETBALL jersey - a sleeveless athletic tank top${reversible ? " (REVERSIBLE, show both the home side and the away side)" : ""}, floating ghost-mannequin style, pure white background, studio lighting. Show FRONT (left) and BACK (right) side by side.`,
          team ? `Team name "${team}" across the chest and a bold player number on the front and back.` : "",
          `Colors: ${i.colors}.`,
        );
      } else if (isFlagFootball) {
        // Flag football = SLEEVELESS COMPRESSION game shirt (form-fitting, no
        // sleeves), not a loose sleeved jersey.
        lines.push(
          `Professional e-commerce product mockup of a fully custom sublimated FLAG FOOTBALL jersey - a SLEEVELESS, form-fitting COMPRESSION game shirt (tight athletic fit, no sleeves, cut off at the shoulder like a compression tank), floating ghost-mannequin style, pure white background, studio lighting. Show FRONT (left) and BACK (right) side by side.`,
          team ? `Team name "${team}" across the chest and a bold player number on the front and back.` : "",
          `Colors: ${i.colors}. Sleek all-over sublimated pattern with contrast side panels.`,
        );
      } else if (isHockey) {
        const laceUp = /lace/i.test(style);
        lines.push(
          `Professional e-commerce product mockup of a fully custom sublimated ICE HOCKEY jersey (hockey sweater) with a ${laceUp ? "lace-up front collar" : "standard rib-knit V-collar"}, long set-in sleeves, a shoulder yoke, and classic hockey striping across the chest, sleeves, and hem, floating ghost-mannequin style, pure white background, studio lighting. Show FRONT (left) and BACK (right) side by side.`,
          team ? `Team crest / name "${team}" centered on the chest; a large player number on the back with a nameplate above it and numbers on the sleeves.` : "A bold team crest on the chest and a large player number on the back.",
          `Colors: ${i.colors}.`,
        );
      } else {
        lines.push(
          `Professional e-commerce product mockup of a fully custom sublimated ${sport} jersey${style ? `, ${style} cut` : ""}, floating ghost-mannequin style, pure white background, studio lighting. Show FRONT (left) and BACK (right) side by side.`,
          team ? `Team name "${team}" across the chest in bold athletic lettering.` : "",
          `Colors: ${i.colors}.`,
        );
      }
      lines.push(JERSEY_BRANDING);
      break;
    }
  }

  // Strict color guard for garments (where hex->name drift caused stray gold);
  // the hype chain states its colors inline and leans on its reference images.
  if (product !== "hype-chain") {
    lines.push(`Use ONLY these colors: ${i.colors}, plus neutral white/black/gray where needed. Do NOT introduce any other color - no gold or extra accent colors unless they are explicitly listed here.`);
  }
  if (i.vision) lines.push(`Design direction: ${i.vision.slice(0, 500)}.`);
  if (i.instruction) lines.push(`Additional direction: ${i.instruction}.`);
  // Hype chain images are labeled inline by the caller (REFERENCE CHAIN /
  // PENDANT LOGO), so it doesn't use this generic reference line.
  if (i.hasRef && product !== "hype-chain") {
    lines.push("A REFERENCE image is provided: use its design language, colors, and vibe as inspiration for a new original design.");
  }
  lines.push(product === "hype-chain" ? FRAME_FULL : FRAME_TIGHT);
  // One product per mockup: each product the client wants gets its OWN proof.
  // Without this, inspiration images of other pieces (a hat photo on a jersey
  // brief) leak into the shot and the model lumps products together.
  lines.push(product === "hat"
    ? "Show ONLY the cap in the requested two-view layout. Both views must depict the SAME cap design and construction; do not add a jersey, hoodie, pants, socks, chain, or any other product."
    : `Show ONLY the ${productNoun(product)} - exactly one product in the frame. Do NOT include any other items (no hats, jerseys, hoodies, pants, socks, or chains that aren't the ${productNoun(product)} itself), even if reference or inspiration images show them.`);
  lines.push(GUARDRAIL);
  return lines.filter(Boolean).join(" ");
}

/** Build the "edit the current version" prompt. The FIRST image is the current
 *  mockup to keep; if hasAsset, a second image is a logo/graphic to incorporate
 *  per the instruction (e.g. "add this logo to the sleeves"). */
export function buildRefinePrompt(product: ProductType, sport: string | null | undefined, instruction: string, hasAsset = false, colors = ""): string {
  const noun = productNoun(product);
  // Color handling is conditional: keep the palette untouched UNLESS the change
  // is about colors, in which case recolor to the team's real palette. (The old
  // prompt hard-said "keep colors identical", so "use our colors" never worked.)
  const colorLine = colors
    ? ` The team's official colors are ${colors}. If the requested change involves colors (for example "use our colors", "recolor", or matching a palette), recolor the design to use EXACTLY these colors while keeping the artwork, logos, patterns, lettering, and layout unchanged. If the change is NOT about colors, leave the existing colors exactly as they are.`
    : "";
  return `Edit the FIRST image, which is the current ${noun} mockup. Apply this change: ${instruction}. Change ONLY what's asked; keep everything else - the design, patterns, lettering, layout, and framing - exactly identical.${colorLine}${hasAsset ? " A SECOND image is provided as a logo/graphic: use it ONLY as directed in the change (e.g. place it where asked). Do not otherwise redesign the mockup from it." : ""} Do not add any team name, text, or logo that is not already in the mockup or explicitly requested.`;
}

/** Minimal, reference-driven prompt for when staff upload a reference image to
 *  riff on. Deliberately does NOT inject the design request's team name,
 *  colors, or vision - those forced "Orlando Avengers" onto everything and
 *  fought the uploaded image. Lean on the reference; let the instruction steer. */
export function buildReferencePrompt(product: ProductType, opts: { instruction?: string; colors?: string }): string {
  const noun = productNoun(product);
  return [
    `Create a clean e-commerce ${noun} product mockup on a pure white background based on the REFERENCE image.`,
    `If the reference is a full ${noun}, recreate its design, layout, and colors faithfully. If the reference is a logo or graphic, design a ${noun} that prominently features that logo.`,
    opts.colors ? `Colors: ${opts.colors}.` : "",
    opts.instruction ? `Make this change: ${opts.instruction}. Change ONLY that; keep everything else identical.` : "",
    `Show ONLY the ${noun} - exactly one product in the frame; no other garments, hats, or accessories even if the reference shows them.`,
    "Do not add any team name or text that is not in the reference or requested. No MLB/NBA/NFL or other brand logos.",
  ].filter(Boolean).join(" ");
}
