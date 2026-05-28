import type { Metadata } from "next";
import { CategoryTabs } from "@/components/category-tabs";
import { ShopGrid } from "@/components/shop-grid";
import { products } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Shop - Custom Jerseys, Uniforms, Hats & Chains",
  description:
    "Shop custom team uniforms, embroidered hats, hype chains, and limited drops from Slugger Athletics. Free designs, fast turnaround.",
};

export default function ShopPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-14">
      <header className="max-w-2xl">
        <span className="display text-brand text-sm">Shop</span>
        <h1 className="display text-4xl sm:text-5xl text-foreground mt-1">All Products</h1>
        <p className="mt-3 text-muted">
          Custom gear for every sport. Free designs, ready in 2-3 weeks.
        </p>
      </header>
      <div className="mt-8">
        <CategoryTabs active="" />
      </div>
      <ShopGrid products={products} />
    </div>
  );
}
