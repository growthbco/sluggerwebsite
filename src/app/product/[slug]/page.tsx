import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductGallery } from "@/components/product-gallery";
import { ProductPurchase } from "@/components/product-purchase";
import { getProduct, publicProducts, isPublicProduct, primaryImage, formatPrice } from "@/lib/catalog";

export function generateStaticParams() {
  return publicProducts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const p = getProduct(slug);
  if (!p) return {};
  return {
    title: p.name,
    description: p.description?.slice(0, 155) || `${p.name} - custom gear from Slugger Athletics.`,
    alternates: { canonical: `/product/${p.slug}` },
    openGraph: { title: p.name, images: [primaryImage(p)] },
    robots: isPublicProduct(p) ? undefined : { index: false, follow: false },
  };
}

// Uniforms (and hoodies) get name/number personalization.
function customFieldsFor(category: string) {
  if (category === "uniforms" || category === "accessories") {
    return [
      { label: "Player Name", maxLength: 20 },
      { label: "Number", maxLength: 4 },
    ];
  }
  if (category === "chains") {
    return [
      { label: "Chain colors", maxLength: 60 },
      { label: "Pendant / logo idea", maxLength: 120 },
      { label: "Team or wording", maxLength: 40 },
    ];
  }
  return [];
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = getProduct(slug);
  if (!p) notFound();

  const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://www.sluggerathletics.com";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.description,
    image: p.images.map((i) => `${SITE}${i.src}`),
    brand: { "@type": "Brand", name: "Slugger Athletics" },
    offers: {
      "@type": "Offer",
      priceCurrency: "USD",
      price: (p.priceCents / 100).toFixed(2),
      availability: p.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: "Team Uniforms", item: `${SITE}/team-uniforms` },
      { "@type": "ListItem", position: 3, name: p.name, item: `${SITE}/product/${p.slug}` },
    ],
  };

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      {/* Breadcrumb */}
      <nav className="text-sm text-muted mb-6">
        <Link href="/team-uniforms" className="hover:text-foreground">Gear</Link>
        <span className="mx-2">/</span>
        <span className="capitalize">{p.category}</span>
        <span className="mx-2">/</span>
        <span className="text-foreground/80">{p.name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        <ProductGallery images={p.images} name={p.name} />

        <div>
          <span className="display text-xs text-brand">{p.categoriesRaw[0] ?? p.category}</span>
          <h1 className="display text-3xl sm:text-4xl text-foreground mt-1">{p.name}</h1>
          <p className="display text-2xl text-foreground mt-3">{formatPrice(p.priceCents)}</p>

          {p.description && (
            <p className="mt-5 text-muted leading-relaxed whitespace-pre-line">{p.description}</p>
          )}

          <div className="mt-4 flex items-center gap-2 text-sm text-muted">
            <span className="text-brand">✓</span> Free custom design · 3-week standard production
          </div>

          <div className="mt-7">
            <ProductPurchase
              slug={p.slug}
              name={p.name}
              image={primaryImage(p)}
              priceCents={p.priceCents}
              sizes={p.sizes}
              inStock={p.inStock}
              customFields={customFieldsFor(p.category)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
