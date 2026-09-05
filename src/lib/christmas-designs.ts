export const CHRISTMAS_DESIGNS = {
  "christmas-crewneck": {
    title: "Christmas Crewneck",
    brief: "Use the Christmas crewneck example as inspiration for our team. Customize our team name, colors, logos, and player details.",
    reference: "/mockups/sa-christmas-jersey-hero.png",
  },
  "christmas-long-sleeve": {
    title: "Christmas Long Sleeve",
    brief: "Use the Christmas long-sleeve example as inspiration for our team. Please quote the long-sleeve option and customize our team name, colors, logos, and player details.",
    reference: "/mockups/sa-christmas-jersey-ls-hero.png",
  },
  original: {
    title: "Original Christmas design",
    brief: "Create an original Christmas jersey for our team. We will describe our holiday theme, colors, and team details.",
    reference: null,
  },
} as const;

export type ChristmasConcept = keyof typeof CHRISTMAS_DESIGNS;

export function resolveChristmasConcept(campaign: unknown, concept: unknown): ChristmasConcept | undefined {
  if (campaign !== "christmas" || typeof concept !== "string") return undefined;
  return Object.hasOwn(CHRISTMAS_DESIGNS, concept) ? concept as ChristmasConcept : undefined;
}

export function christmasDesignUrl(concept: ChristmasConcept) {
  return `/design?campaign=christmas&concept=${concept}`;
}

/** Preserve the selected example even when the customer rewrites their brief. */
export function withChristmasContext(concept: ChristmasConcept | undefined, vision: string) {
  if (!concept) return vision;
  const design = CHRISTMAS_DESIGNS[concept];
  return [
    `Christmas campaign — ${design.title}`,
    design.reference ? `Example: https://sluggerathletics.com${design.reference}` : "Original concept requested.",
    vision,
  ].join("\n\n");
}
