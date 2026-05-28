import type { Metadata } from "next";
import { ShopGrid } from "@/components/shop-grid";
import { dropProducts } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Buy-Ins - Limited Drops",
  description:
    "Limited-edition themed jersey and hoodie drops from Slugger Athletics. Buy in before they're gone.",
};

export default function DropsPage() {
  const items = dropProducts(24);
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-14">
      <header className="max-w-2xl">
        <span className="display text-brand text-sm">Limited Releases</span>
        <h1 className="display text-4xl sm:text-5xl text-foreground mt-1">Active Buy-Ins</h1>
        <p className="mt-3 text-muted">
          Limited themed drops - buy in before the window closes. Once they&apos;re
          gone, they&apos;re gone.
        </p>
      </header>
      <ShopGrid products={items} />
    </div>
  );
}
