export const HALLOWEEN_DESIGNS = {
  "neon-halloween": {
    title: "Neon Halloween",
    brief: "Adapt the Neon Halloween example for our team. We will provide our team name, colors, logos, and preferred details.",
    reference: "/media/NeonHalloweenTransparentJerseyFront.png",
  },
  "mamba-halloween-black": {
    title: "Mamba Halloween Black",
    brief: "Use the Mamba Halloween Black full-button jersey as inspiration for our own team. Customize the team name, colors, logos, and player details.",
    reference: "https://wnbdipjkyfozqxrj.public.blob.vercel-storage.com/design-proofs/mamba-store-full-button-blood-qJytaaZ0JQ9VwzKHJZ9Tmd9fvVLZ4M.png",
  },
  "mamba-halloween-white": {
    title: "Mamba Halloween White",
    brief: "Use the Mamba Halloween White full-button jersey as inspiration for our own team. Customize the team name, colors, logos, and player details.",
    reference: "https://wnbdipjkyfozqxrj.public.blob.vercel-storage.com/design-studio/DR-0YPBP5-2026-08-11T15-10-58-265Z-9uJsQ7aq2OSF7SLxLzcXgfxy2BPeAv.png",
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
    design.reference ? `Example: ${new URL(design.reference, "https://sluggerathletics.com").href}` : "Original concept requested.",
    vision,
  ].join("\n\n");
}
