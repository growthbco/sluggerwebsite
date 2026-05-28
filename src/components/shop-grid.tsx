import { ProductCard } from "@/components/product-card";
import { primaryImage, type CatalogProduct } from "@/lib/catalog";

export function ShopGrid({ products }: { products: CatalogProduct[] }) {
  if (products.length === 0) {
    return (
      <p className="mt-10 text-muted">No products in this category yet - check back soon.</p>
    );
  }
  return (
    <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
      {products.map((p) => (
        <ProductCard
          key={p.slug}
          product={{
            slug: p.slug,
            name: p.name,
            image: primaryImage(p),
            priceCents: p.priceCents,
            badge: !p.inStock ? "Sold Out" : undefined,
          }}
        />
      ))}
    </div>
  );
}
