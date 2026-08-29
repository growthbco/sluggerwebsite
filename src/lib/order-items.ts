// Item types a team order can include, each with its own size scale.
// Jerseys are the primary product; pants/shorts/hoodies/socks are add-ons.

export const APPAREL_SIZES = [
  "Youth Small", "Youth Medium", "Youth Large", "Youth X-Large",
  "Small", "Medium", "Large", "X-Large",
  "2X-Large", "3X-Large", "4X-Large", "5X-Large",
];

export const SOCK_SIZES = ["Youth S/M", "Youth L/XL", "Adult S/M", "Adult L/XL"];

// Cheer uses the supplier's numbered scale. Tops and skirts are selected
// separately because a cheerleader may need a different size in each piece.
export const CHEER_SIZES = ["6", "8", "10", "12", "14", "16"];

const CHEER_ITEM_KEYS = new Set(["cheer_uniform", "cheer_uniform_rhinestone"]);
const CHEER_TOP_SUFFIX = "__top";
const CHEER_BOTTOM_SUFFIX = "__bottom";

export type SizeField = {
  key: string;
  itemKey: string;
  label: string;
  sizes: string[];
};

export function isCheerItem(key: string): boolean {
  return CHEER_ITEM_KEYS.has(key);
}

export function sizeFieldsForItem(key: string): SizeField[] {
  const item = ITEM_TYPES.find((t) => t.key === key);
  const sizes = item?.sizes ?? APPAREL_SIZES;
  const label = item?.label ?? key;
  if (!isCheerItem(key)) return [{ key, itemKey: key, label, sizes }];
  return [
    { key: `${key}${CHEER_TOP_SUFFIX}`, itemKey: key, label: `${label} Top`, sizes },
    { key: `${key}${CHEER_BOTTOM_SUFFIX}`, itemKey: key, label: `${label} Skirt`, sizes },
  ];
}

export function sizeFieldsForItems(keys: string[]): SizeField[] {
  return (keys.length ? keys : ["jersey"]).flatMap(sizeFieldsForItem);
}

export function itemKeyForSizeField(key: string): string {
  if (key.endsWith(CHEER_TOP_SUFFIX)) return key.slice(0, -CHEER_TOP_SUFFIX.length);
  if (key.endsWith(CHEER_BOTTOM_SUFFIX)) return key.slice(0, -CHEER_BOTTOM_SUFFIX.length);
  return key;
}

export function sizeValueForField(
  field: SizeField,
  sizes?: Record<string, string> | null,
  legacyJerseySize?: string | null,
): string {
  return sizes?.[field.key]
    ?? (isCheerItem(field.itemKey) ? sizes?.[field.itemKey] : undefined)
    ?? (field.itemKey === "jersey" ? legacyJerseySize ?? "" : "");
}

export function missingCheerSizeLabels(itemKeys: string[], sizes?: Record<string, string> | null): string[] {
  return sizeFieldsForItems(itemKeys)
    .filter((field) => isCheerItem(field.itemKey) && !sizeValueForField(field, sizes))
    .map((field) => field.label);
}

// Flag football uniforms are SLEEVELESS COMPRESSION - their own youth-to-3XL
// scale (chart in size-charts.tsx FLAG_FOOTBALL). A looser fit = a standard
// crew-neck jersey instead.
export const FLAG_FOOTBALL_SIZES = [
  "Youth XS", "Youth Small", "Youth Medium", "Youth Large", "Youth X-Large",
  "XS", "Small", "Medium", "Large", "X-Large", "2X-Large", "3X-Large",
];

// Flexfit i8503 size range; snapbacks are one size fits most.
export const FITTED_HAT_SIZES = ["XS", "S/M", "L/XL", "XXL"];
export const SNAPBACK_HAT_SIZES = ["One Size"];

// inHouse: embroidered in the Ocala shop. outsourced: bought finished from an
// outside supplier (e.g. Cap America custom knit beanies). BOTH are produced
// OUTSIDE the overseas jersey factory, so both are kept out of everything
// designer-facing (Discord roster posts, print-file QA) and off the designer's
// invoice. The difference is only WHO makes them - us (inHouse) vs a supplier
// (outsourced) - which the admin surfaces so staff know to place the order.
// minPieces: per-design order minimum for this item (default 6). Cheer sets
// require 12 - a squad orders together, not one at a time.
// noNames: this item doesn't carry a player name on the back (cheer sets), so a
// fresh order of only these items defaults the "names on back?" survey to No.
export type ItemType = { key: string; label: string; sizes: string[]; inHouse?: boolean; outsourced?: boolean; minPieces?: number; noNames?: boolean };

export const ITEM_TYPES: ItemType[] = [
  { key: "jersey", label: "Jersey", sizes: APPAREL_SIZES },
  // Ice-hockey jersey (sublimated sweater) - a premium, pricier garment than
  // the standard jersey; label keeps "Hockey" so the designer-cost lookup hits.
  { key: "hockey_jersey", label: "Hockey Jersey", sizes: APPAREL_SIZES },
  // Flag football game shirt: sleeveless compression, its own size scale.
  { key: "flag_football_jersey", label: "Flag Football Jersey", sizes: FLAG_FOOTBALL_SIZES },
  { key: "practice_jersey", label: "Practice Jersey", sizes: APPAREL_SIZES },
  { key: "polo", label: "Custom Polo - Dri-Fit", sizes: APPAREL_SIZES },
  { key: "polo_pin_dot", label: "Custom Polo - Pin-Dot", sizes: APPAREL_SIZES },
  { key: "knickers", label: "Knickers", sizes: APPAREL_SIZES },
  { key: "long_pants", label: "Long Pants", sizes: APPAREL_SIZES },
  { key: "shorts", label: "Shorts", sizes: APPAREL_SIZES },
  { key: "hoodie", label: "Heavyweight Hoodie", sizes: APPAREL_SIZES },
  { key: "lightweight_hoodie", label: "Lightweight Hoodie", sizes: APPAREL_SIZES },
  { key: "pullover", label: "1/4-Zip Pullover", sizes: APPAREL_SIZES },
  { key: "jacket", label: "Custom Jacket", sizes: APPAREL_SIZES },
  { key: "cheer_uniform", label: "Cheer Uniform (Set)", sizes: CHEER_SIZES, minPieces: 12, noNames: true },
  { key: "cheer_uniform_rhinestone", label: "Cheer Uniform (Rhinestone)", sizes: CHEER_SIZES, minPieces: 12, noNames: true },
  { key: "socks", label: "Socks", sizes: SOCK_SIZES },
  { key: "fitted_hat", label: "Fitted Hat", sizes: FITTED_HAT_SIZES, inHouse: true },
  { key: "snapback_hat", label: "Snapback Hat", sizes: SNAPBACK_HAT_SIZES, inHouse: true },
  // Cap America i8540: water-resistant, moisture-wicking performance cap, OSFM.
  // Limited stock colors (black, white, gray). Embroidered in-house like the
  // other caps; priced as the premium hat.
  { key: "performance_hat", label: "Performance Cap", sizes: SNAPBACK_HAT_SIZES, inHouse: true },
  // Custom knit beanie (Cap America Elite Knit style): SPECIAL-ORDERED finished
  // from Cap America - not made in-house and not by the overseas designer. OSFM.
  { key: "beanie", label: "Beanie", sizes: SNAPBACK_HAT_SIZES, outsourced: true },
];

// Apparel a team can add as an add-on to their existing order, even when the
// original order didn't include that piece - a coach who ordered jerseys can
// still add hats, hoodies, pants, or socks later on the same team design. The
// full set of common team gear so nobody is stuck with jersey-only. Excludes
// the sport-locked jerseys (hockey/flag-football), cheer sets (min 12), and the
// special-order beanie. Each MUST exist in ITEM_TYPES + the price map.
export const EXTRA_ADDON_KEYS = [
  "polo",
  "polo_pin_dot",
  "hoodie",
  "lightweight_hoodie",
  "pullover",
  "jacket",
  "fitted_hat",
  "snapback_hat",
  "performance_hat",
  "knickers",
  "long_pants",
  "shorts",
  "socks",
];

export function isInHouseItem(key: string): boolean {
  return Boolean(ITEM_TYPES.find((t) => t.key === itemKeyForSizeField(key))?.inHouse);
}

// Hats/caps - ordered by size, never personalized with a player name or number.
export const HAT_ITEM_KEYS = ["fitted_hat", "snapback_hat", "performance_hat", "beanie"];

/** Whether this item takes a per-piece player name/number. Hats and cheer sets
 *  don't - they're sized, not personalized - so their entry forms hide those
 *  fields. */
export function itemTakesName(key: string): boolean {
  if (HAT_ITEM_KEYS.includes(key)) return false;
  return !ITEM_TYPES.find((t) => t.key === key)?.noNames;
}

/** The per-design order minimum for an order, given its item keys. Defaults to
 *  6; cheer sets require 12. Returns the highest minimum among the items. */
export function minPiecesForItems(itemKeys: string[] | null | undefined): number {
  let min = 6;
  for (const k of itemKeys ?? []) {
    const m = ITEM_TYPES.find((t) => t.key === k)?.minPieces;
    if (m && m > min) min = m;
  }
  return min;
}

/** Whether a fresh order for these items should default to requiring names on
 *  the back. Cheer sets (noNames) default to No; any name-bearing item flips it
 *  to Yes. The coach can still override via the roster survey toggle. */
export function defaultRequiresNames(itemKeys: string[] | null | undefined): boolean {
  const keys = itemKeys?.length ? itemKeys : ["jersey"];
  return keys.some((k) => !ITEM_TYPES.find((t) => t.key === k)?.noNames);
}

export function isOutsourcedItem(key: string): boolean {
  return Boolean(ITEM_TYPES.find((t) => t.key === itemKeyForSizeField(key))?.outsourced);
}

/** True for items the overseas jersey designer does NOT produce - in-house
 *  (hats) OR outsourced (beanies). Use this for every designer-facing filter
 *  (roster posts, print QA, billing) so neither ever reaches him. */
export function notDesignerMade(key: string): boolean {
  const t = ITEM_TYPES.find((x) => x.key === itemKeyForSizeField(key));
  return Boolean(t?.inHouse || t?.outsourced);
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
    // Cheer FIRST - "cheerleading uniform shell and shirt" contains "shirt",
    // which would otherwise map to a jersey.
    if (/cheer/.test(p)) push(/rhinestone/.test(p) ? "cheer_uniform_rhinestone" : "cheer_uniform");
    else if (/polo/.test(p) && /pin[\s-]?dot/.test(p)) push("polo_pin_dot");
    else if (/polo/.test(p)) push("polo");
    else if (/jersey|shirt/.test(p)) push("jersey");
    else if (/jacket|warm[\s-]?up/.test(p)) push("jacket");
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
export type JerseyMaterial = { key: string; label: string; description: string; recommended?: boolean };
// Mesh is our recommended default: most breathable and durable, best for hot
// Florida play. Listed first and flagged so the order form pre-selects it.
export const JERSEY_MATERIALS: JerseyMaterial[] = [
  {
    key: "mesh",
    label: "Mesh (Birdseye)",
    recommended: true,
    description:
      "A lightweight knit with tiny textured holes (birdseye) for maximum airflow. Extra breathable and durable - a great pick for hot Florida game days.",
  },
  {
    key: "dry-fit",
    label: "Dry-Fit",
    description:
      "A smooth, soft, moisture-wicking fabric - like a performance dry-fit shirt. Sleek next-to-skin feel that pulls sweat away to keep players dry and cool.",
  },
  {
    key: "polyester",
    label: "Polyester",
    description:
      "A structured smooth polyester used for button-front and pro-style jerseys - holds its shape and prints crisp, not open-weave like mesh.",
  },
  {
    key: "microfiber",
    label: "Microfiber",
    description:
      "A soft, lightweight microfiber used for our bowling shirts - drapes like a camp shirt, prints vivid, and wears comfortably off the lanes too.",
  },
];

/** The fabric a jersey style is actually made in, so an order never defaults to
 *  Mesh when the style implies otherwise. Button-front and quarter-zip jerseys
 *  are smooth polyester, not birdseye mesh; crew / v-neck stay mesh (the
 *  breathable default). Returns a JERSEY_MATERIALS key. */
export function fabricForStyle(style?: string | null): string {
  const s = (style ?? "").toLowerCase();
  if (s.includes("full") || s.includes("two") || s.includes("zip")) return "polyester";
  return "mesh";
}

/** True when a design/order is a bowling shirt. Bowling uses a distinct
 *  microfiber fabric (and full-button bowling shirts carry their own price). */
export function isBowling(...hints: (string | null | undefined)[]): boolean {
  return hints.some((h) => (h ?? "").toLowerCase().includes("bowl"));
}

/** Fabric for an order, aware that bowling shirts are microfiber regardless of
 *  style. Falls back to the style-based default for every other sport. */
export function fabricFor(style?: string | null, ...sportHints: (string | null | undefined)[]): string {
  return isBowling(...sportHints) ? "microfiber" : fabricForStyle(style);
}

export function itemLabel(key: string): string {
  const itemKey = itemKeyForSizeField(key);
  const base = ITEM_TYPES.find((t) => t.key === itemKey)?.label ?? itemKey;
  if (key.endsWith(CHEER_TOP_SUFFIX)) return `${base} Top`;
  if (key.endsWith(CHEER_BOTTOM_SUFFIX)) return `${base} Skirt`;
  return base;
}

export function sizesFor(key: string): string[] {
  return ITEM_TYPES.find((t) => t.key === itemKeyForSizeField(key))?.sizes ?? APPAREL_SIZES;
}

/** Tally an ordered roster into a per-item size breakdown (e.g. Fitted Hat:
 *  5 S/M, 2 L/XL, 3 XXL). Sizes come out in the item's canonical size order,
 *  with any stray sizes appended. Only items that have at least one size go in. */
// Bare adult apparel sizes read ambiguously next to "Youth Medium" (is plain
// "Medium" adult or youth?). For DISPLAY only, prefix them with "Adult" so
// staff, customers, and print sheets can't confuse them. Stored values stay
// bare ("Medium") so print-file size matching is unaffected.
const ADULT_APPAREL_SIZES = new Set(["Small", "Medium", "Large", "X-Large", "2X-Large", "3X-Large", "4X-Large", "5X-Large"]);
export function formatSize(size?: string | null): string {
  const s = (size ?? "").trim();
  return ADULT_APPAREL_SIZES.has(s) ? `Adult ${s}` : s;
}

export function sizeBreakdown(
  roster: { size?: string | null; sizes?: Record<string, string> | null; quantity?: number | null }[],
  items: string[],
): { key: string; label: string; parts: { size: string; n: number }[]; total: number }[] {
  return sizeFieldsForItems(items)
    .map((field) => {
      const counts: Record<string, number> = {};
      for (const r of roster) {
        const v = sizeValueForField(field, r.sizes, r.size);
        if (v) counts[v] = (counts[v] ?? 0) + Math.max(1, r.quantity ?? 1);
      }
      const canonical = field.sizes;
      const parts = canonical.filter((s) => counts[s]).map((s) => ({ size: formatSize(s), n: counts[s] }));
      for (const s of Object.keys(counts)) if (!canonical.includes(s)) parts.push({ size: formatSize(s), n: counts[s] });
      return { key: field.key, label: field.label, parts, total: parts.reduce((a, b) => a + b.n, 0) };
    })
    .filter((x) => x.total > 0);
}
