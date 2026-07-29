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

/** Frame shape per product. A hanging hype-chain necklace reads best tall;
 *  everything else is the side-by-side landscape front/back. */
export function productAspect(p: ProductType): string {
  return p === "hype-chain" ? "3:4" : "4:3";
}

const COMMON_TAIL =
  "Frame the product large and close-up so it fills most of the image with only a small even margin; do not leave big empty white space or push it far into the distance. Premium, print-ready, tasteful. No mannequin, no human, no watermark. Do NOT add any MLB, NBA, NFL, or other league logos, no pro-team marks, no swooshes or brand logos - use ONLY the team's own name and any logo the customer provided.";

type PromptInput = {
  sport?: string | null;
  style?: string;
  colors: string; // comma-separated
  teamName?: string | null;
  vision?: string | null;
  instruction?: string;
  hasRef?: boolean;
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
      lines.push(
        "Professional product mockup of a custom 3D-PRINTED team hype chain - a chunky plastic novelty dugout-celebration necklace. This is NOT metal jewelry, NOT a gold rope chain, and has NO gemstones.",
        "Show the ENTIRE necklace as one complete closed loop, laid flat and fully in frame, with a flat 3D-printed nameplate pendant hanging at the bottom center.",
        "The chain is built from thick, rounded, oversized oval links that ALTERNATE between the two team colors. Every link and the pendant have a smooth matte 3D-printed plastic finish with clear dimensional depth, rounded edges, and soft drop shadows, so the whole piece obviously reads as a solid 3D object sitting on the surface.",
        "The pendant is a bold block-letter nameplate in the team colors with a contrasting outline.",
        `Colors: ${i.colors} (alternating links and the nameplate).`,
        team ? `Nameplate wording, in bold block letters: "${team}".` : "",
        "Top-down flat-lay view, evenly lit, the whole necklace and pendant fully visible with a small margin. No person, no neck, no mannequin, no metal, no rope, no jewels.",
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

  if (i.vision) lines.push(`Design direction: ${i.vision.slice(0, 500)}.`);
  if (i.instruction) lines.push(`Additional direction: ${i.instruction}.`);
  if (i.hasRef) {
    lines.push(
      product === "hype-chain"
        ? "A REFERENCE PHOTO of our actual 3D-printed chain is provided: match its construction, link shape, thickness, chunkiness, and matte printed finish EXACTLY. Change ONLY the colors and the nameplate wording - keep it the same style of 3D-printed chain."
        : "A REFERENCE image is provided: use its design language, colors, and vibe as inspiration for a new original design.",
    );
  }
  lines.push(COMMON_TAIL);
  return lines.filter(Boolean).join(" ");
}

/** Build the "edit the current version" prompt for a product type. */
export function buildRefinePrompt(product: ProductType, sport: string | null | undefined, instruction: string): string {
  const noun = productNoun(product);
  return `Edit this custom ${sport ?? "team"} ${noun} mockup. Keep it a professional product shot on a pure white background, same framing and views. Apply this change: ${instruction}. Change only what's asked; keep everything else identical. Do not add any league/MLB/pro-team logos or third-party brand marks.`;
}
