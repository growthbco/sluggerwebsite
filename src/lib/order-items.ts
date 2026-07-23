// Item types a team order can include, each with its own size scale.
// Jerseys are the primary product; pants/shorts/hoodies/socks are add-ons.

export const APPAREL_SIZES = [
  "Youth Small", "Youth Medium", "Youth Large", "Youth X-Large",
  "Small", "Medium", "Large", "X-Large",
  "2X-Large", "3X-Large", "4X-Large", "5X-Large",
];

export const SOCK_SIZES = ["Youth S/M", "Youth L/XL", "Adult S/M", "Adult L/XL"];

// Flexfit i8503 size range; snapbacks are one size fits most.
export const FITTED_HAT_SIZES = ["XS", "S/M", "L/XL", "XXL"];
export const SNAPBACK_HAT_SIZES = ["One Size"];

// inHouse: embroidered in the Ocala shop, NOT produced by the overseas
// designer/factory. In-house items are kept out of everything designer-facing
// (Discord roster posts, print-file QA) and surfaced on the admin page instead.
export type ItemType = { key: string; label: string; sizes: string[]; inHouse?: boolean };

export const ITEM_TYPES: ItemType[] = [
  { key: "jersey", label: "Jersey", sizes: APPAREL_SIZES },
  { key: "knickers", label: "Knickers", sizes: APPAREL_SIZES },
  { key: "long_pants", label: "Long Pants", sizes: APPAREL_SIZES },
  { key: "shorts", label: "Shorts", sizes: APPAREL_SIZES },
  { key: "hoodie", label: "Hoodie", sizes: APPAREL_SIZES },
  { key: "socks", label: "Socks", sizes: SOCK_SIZES },
  { key: "fitted_hat", label: "Fitted Hat", sizes: FITTED_HAT_SIZES, inHouse: true },
  { key: "snapback_hat", label: "Snapback Hat", sizes: SNAPBACK_HAT_SIZES, inHouse: true },
];

export function isInHouseItem(key: string): boolean {
  return Boolean(ITEM_TYPES.find((t) => t.key === key)?.inHouse);
}

/** Map design-request product labels ("Hoodie", "Jersey / Shirt", free-typed
 *  "Other" text...) onto team-order item keys, so the order form pre-selects
 *  what was actually designed instead of defaulting to a jersey. Labels with
 *  no matching item type (bags, custom pieces) are skipped - those get quoted
 *  manually. */
export function itemKeysFromDesignProducts(productTypes?: string[] | null): string[] {
  const keys: string[] = [];
  const push = (k: string) => { if (!keys.includes(k)) keys.push(k); };
  for (const raw of productTypes ?? []) {
    const p = raw.toLowerCase();
    if (/jersey|shirt/.test(p)) push("jersey");
    else if (/hoodie|sweat/.test(p)) push("hoodie");
    else if (/knicker/.test(p)) push("knickers");
    else if (/pant/.test(p)) push("long_pants");
    else if (/short/.test(p)) push("shorts");
    else if (/sock/.test(p)) push("socks");
    else if (/fitted/.test(p)) push("fitted_hat");
    else if (/snap|trucker|hat|cap/.test(p)) push("snapback_hat");
  }
  return keys;
}

// Jersey fabric options with plain-language descriptions for shoppers.
export type JerseyMaterial = { key: string; label: string; description: string };
export const JERSEY_MATERIALS: JerseyMaterial[] = [
  {
    key: "dry-fit",
    label: "Dry-Fit",
    description:
      "A smooth, soft, moisture-wicking fabric - like a performance dry-fit shirt. Sleek next-to-skin feel that pulls sweat away to keep players dry and cool.",
  },
  {
    key: "mesh",
    label: "Mesh (Birdseye)",
    description:
      "A lightweight knit with tiny textured holes (birdseye) for maximum airflow. Extra breathable and durable - a great pick for hot Florida game days.",
  },
];

export function itemLabel(key: string): string {
  return ITEM_TYPES.find((t) => t.key === key)?.label ?? key;
}

export function sizesFor(key: string): string[] {
  return ITEM_TYPES.find((t) => t.key === key)?.sizes ?? APPAREL_SIZES;
}
