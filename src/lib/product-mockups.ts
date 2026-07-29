// Product-aware mockup prompts. One AI image engine, many products: jerseys,
// embroidered hats, hype chains, hoodies, pants, socks. Each product needs its
// own scene description (embroidered vs sublimated, which views to show, what
// "floating ghost" means for that item) so the concept reads like a real
// e-commerce product shot.

export type ProductType = "jersey" | "hat" | "hype-chain" | "hoodie" | "pants" | "socks";

export const PRODUCTS: { id: ProductType; label: string; noun: string }[] = [
  { id: "jersey", label: "Jersey", noun: "jersey" },
  { id: "hat", label: "Embroidered hat", noun: "cap" },
  { id: "hype-chain", label: "Hype chain", noun: "hype chain" },
  { id: "hoodie", label: "Hoodie", noun: "hoodie" },
  { id: "pants", label: "Pants", noun: "pants" },
  { id: "socks", label: "Socks", noun: "socks" },
];

export function productNoun(p: ProductType): string {
  return PRODUCTS.find((x) => x.id === p)?.noun ?? "product";
}

// Image models don't reliably understand hex codes (a "#d81f1f" gets ignored
// or free-associated), so map any hex to the nearest human color NAME before
// it hits the prompt. Non-hex input (already a name) passes through.
const NAMED_COLORS: [string, number, number, number][] = [
  ["white", 255, 255, 255], ["black", 20, 20, 20], ["gray", 128, 128, 128], ["silver", 200, 200, 205],
  ["red", 210, 30, 30], ["maroon", 100, 25, 25], ["orange", 232, 121, 43],
  ["gold", 200, 165, 60], ["yellow", 240, 208, 40],
  ["green", 40, 150, 50], ["dark green", 20, 80, 45], ["teal", 23, 145, 155], ["lime", 140, 200, 60],
  ["royal blue", 31, 79, 216], ["navy", 25, 40, 90], ["light blue", 120, 170, 220], ["cyan", 40, 190, 210],
  ["purple", 110, 50, 180], ["pink", 224, 95, 160], ["brown", 107, 68, 35], ["tan", 200, 176, 107],
];

export function colorName(input: string): string {
  const m = input.trim().match(/^#?([0-9a-fA-F]{6})$/);
  if (!m) return input.trim(); // already a name
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  let best = input.trim(), bd = Infinity;
  for (const [name, cr, cg, cb] of NAMED_COLORS) {
    const d = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
    if (d < bd) { bd = d; best = name; }
  }
  return best;
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
      lines.push(
        `Professional e-commerce product mockup of a custom EMBROIDERED team cap (structured baseball / Flexfit-style fitted hat)${style ? `, ${style}` : ""}, floating on a pure white background with studio lighting. Show a FRONT three-quarter view (left) and a SIDE view (right) of the same cap.`,
        "The team emblem is EMBROIDERED on the front crown with realistic raised 3D thread texture and stitching; add a small matching embroidered mark on the side panel. Clean stitched eyelets and a structured brim.",
        `Colors: ${i.colors} (crown, brim, and emblem thread).`,
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
    case "jersey":
    default:
      lines.push(
        `Professional e-commerce product mockup of a fully custom sublimated ${sport} jersey${style ? `, ${style} cut` : ""}, floating ghost-mannequin style, pure white background, studio lighting. Show FRONT (left) and BACK (right) side by side.`,
        team ? `Team name "${team}" across the chest in bold athletic lettering.` : "",
        `Colors: ${i.colors}.`,
      );
      break;
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
  lines.push(GUARDRAIL);
  return lines.filter(Boolean).join(" ");
}

/** Build the "edit the current version" prompt. The FIRST image is the current
 *  mockup to keep; if hasAsset, a second image is a logo/graphic to incorporate
 *  per the instruction (e.g. "add this logo to the sleeves"). */
export function buildRefinePrompt(product: ProductType, sport: string | null | undefined, instruction: string, hasAsset = false): string {
  const noun = productNoun(product);
  return `Edit the FIRST image, which is the current ${noun} mockup. Apply this change: ${instruction}. Change ONLY what's asked; keep everything else - the design, colors, patterns, lettering, layout, and framing - exactly identical.${hasAsset ? " A SECOND image is provided as a logo/graphic: use it ONLY as directed in the change (e.g. place it where asked). Do not otherwise redesign the mockup from it." : ""} Do not add any team name, text, or logo that is not already in the mockup or explicitly requested.`;
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
    "Do not add any team name or text that is not in the reference or requested. No MLB/NBA/NFL or other brand logos.",
  ].filter(Boolean).join(" ");
}
