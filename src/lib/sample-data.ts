// Sample catalog used to render the storefront preview before the DB is wired up.
// Mirrors the shape of the Drizzle schema so swapping to real data is trivial.

export type SampleProduct = {
  slug: string;
  name: string;
  category: "hats" | "uniforms" | "chains" | "accessories";
  priceCents: number;
  image: string;
  badge?: string;
};

export type SampleDrop = {
  slug: string;
  title: string;
  theme: string;
  blurb: string;
  image: string;
  status: "open" | "scheduled" | "sold_out";
  closesLabel: string;
};

const ph = (label: string, bg: string, fg = "ffffff") =>
  `https://placehold.co/800x800/${bg}/${fg}/png?text=${encodeURIComponent(label)}&font=oswald`;

export const categories = [
  { href: "/team-uniforms", label: "Team Uniforms", image: "/media/DSCF3183-scaled.jpg" },
  { href: "/shop/uniforms", label: "Custom Jerseys", image: "/media/DSCF3009-scaled.jpg" },
  { href: "/embroidery", label: "Embroidered Hats", image: "/media/455039895_3878036265809976_8056806344988691991_n-scaled.jpg" },
  { href: "/hype-chains", label: "Hype Chains", image: "/products/chains/big-baller.jpg" },
];

export const featuredProducts: SampleProduct[] = [
  { slug: "signature-jersey", name: "Signature Custom Jersey", category: "uniforms", priceCents: 5500, image: ph("SIGNATURE\nJERSEY", "b8a36c", "13160b"), badge: "Best Seller" },
  { slug: "3d-puff-hat", name: "3D Puff Embroidered Hat", category: "hats", priceCents: 3200, image: ph("3D PUFF\nHAT", "1a1d22") },
  { slug: "hype-chain-gold", name: "Gold Hype Chain", category: "chains", priceCents: 2800, image: ph("HYPE\nCHAIN", "0e0f12") },
  { slug: "performance-shorts", name: "Performance Shorts", category: "accessories", priceCents: 3000, image: ph("PERF\nSHORTS", "15171c") },
  { slug: "full-button-jersey", name: "Full-Button Baseball Jersey", category: "uniforms", priceCents: 5800, image: ph("FULL\nBUTTON", "1d1f25"), badge: "New" },
  { slug: "trucker-hat", name: "Classic Trucker Hat", category: "hats", priceCents: 2900, image: ph("TRUCKER\nHAT", "111317") },
  { slug: "team-hoodie", name: "Team Hoodie", category: "accessories", priceCents: 4800, image: ph("TEAM\nHOODIE", "17191e") },
  { slug: "racerback-jersey", name: "Softball Racerback", category: "uniforms", priceCents: 5200, image: ph("RACER\nBACK", "1a1d22") },
];

export const drops: SampleDrop[] = [
  { slug: "horror-night", title: "Horror Night Collection", theme: "Halloween Horror", blurb: "Limited 4-part jersey drop. Once they're gone, they're gone.", image: ph("HORROR\nNIGHT", "b8a36c", "13160b"), status: "open", closesLabel: "Closes in 3 days" },
  { slug: "neon-summer", title: "Neon Summer", theme: "Summer Exclusive", blurb: "High-vis neon set. Home & away.", image: ph("NEON\nSUMMER", "111317"), status: "open", closesLabel: "Closes in 6 days" },
  { slug: "storm-series", title: "Storm Series", theme: "Limited Run", blurb: "The storm is coming. Prepare.", image: ph("STORM\nSERIES", "0e0f12"), status: "scheduled", closesLabel: "Drops Friday" },
];

export function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}
