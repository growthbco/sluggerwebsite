export const HALLOWEEN_DESIGNS = {
  "neon-halloween": {
    title: "Neon Halloween",
    brief: "Adapt the Neon Halloween example for our team. We will provide our team name, colors, logos, and preferred details.",
    reference: "/media/NeonHalloweenTransparentJerseyFront.png",
  },
  original: {
    title: "Original Halloween design",
    brief: "Create an original Halloween jersey for our team. We will describe our theme, colors, and team details.",
    reference: null,
  },
} as const;

export type HalloweenConcept = keyof typeof HALLOWEEN_DESIGNS;

export function resolveHalloweenConcept(campaign: unknown, concept: unknown): HalloweenConcept | undefined {
  if (campaign !== "halloween" || typeof concept !== "string") return undefined;
  return Object.hasOwn(HALLOWEEN_DESIGNS, concept) ? concept as HalloweenConcept : undefined;
}

export function halloweenDesignUrl(concept: HalloweenConcept) {
  return `/design?campaign=halloween&concept=${concept}`;
}

/** Keep the selected example in the existing designer brief even if the
 * customer rewrites the editable description. No new order workflow. */
export function withHalloweenContext(concept: HalloweenConcept | undefined, vision: string) {
  if (!concept) return vision;
  const design = HALLOWEEN_DESIGNS[concept];
  return [
    `Halloween campaign — ${design.title}`,
    design.reference ? `Example: https://sluggerathletics.com${design.reference}` : "Original concept requested.",
    vision,
  ].join("\n\n");
}
