import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CategoryTabs } from "@/components/category-tabs";
import { ShopGrid } from "@/components/shop-grid";
import { byCategory, type Category } from "@/lib/catalog";

const CATEGORIES: Record<Category, { title: string; blurb: string }> = {
  uniforms: { title: "Team Uniforms & Jerseys", blurb: "Custom jerseys and uniforms for every sport - designed in-house, free of charge." },
  hats: { title: "Embroidered Hats", blurb: "Expertly embroidered fitted caps, snapbacks, and trucker hats to round out your look." },
  chains: { title: "Hype Chains", blurb: "3D hype chains and accessories to bring the energy." },
  accessories: { title: "Accessories", blurb: "Hoodies, shorts, and gear that go with your kit." },
};

export function generateStaticParams() {
  return (Object.keys(CATEGORIES) as Category[]).map((category) => ({ category }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const meta = CATEGORIES[category as Category];
  if (!meta) return {};
  return { title: meta.title, description: meta.blurb };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const meta = CATEGORIES[category as Category];
  if (!meta) notFound();

  const items = byCategory(category as Category);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-14">
      <header className="max-w-2xl">
        <span className="display text-brand text-sm">Shop</span>
        <h1 className="display text-4xl sm:text-5xl text-foreground mt-1">{meta.title}</h1>
        <p className="mt-3 text-muted">{meta.blurb}</p>
      </header>
      <div className="mt-8">
        <CategoryTabs active={category} />
      </div>
      <ShopGrid products={items} />
      {/* Hats is a money category: route shoppers who want their OWN logo to
          the custom page instead of bouncing off the ready-made grid. */}
      {category === "hats" && (
        <div className="mt-12 bg-steel border border-line p-6 text-center">
          <h2 className="display text-xl text-foreground">Want your own logo on a hat?</h2>
          <p className="mt-2 text-muted text-sm max-w-xl mx-auto">
            We make <Link href="/custom-hats" className="text-brand hover:underline">custom embroidered hats with no minimum order</Link> -
            fitted Flexfit, snapback, and trucker styles from $25 with free logo digitizing.
            In Central Florida? See our <Link href="/embroidery" className="text-brand hover:underline">embroidery services in Ocala</Link>.
          </p>
        </div>
      )}
    </div>
  );
}
