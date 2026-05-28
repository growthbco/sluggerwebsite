import Link from "next/link";
import Image from "next/image";
import { formatPrice } from "@/lib/catalog";

export type CardProduct = {
  slug: string;
  name: string;
  image: string;
  priceCents: number;
  badge?: string;
};

export function ProductCard({ product }: { product: CardProduct }) {
  return (
    <Link
      href={`/product/${product.slug}`}
      className="group block bg-steel border border-line hover:border-brand/60 transition-colors overflow-hidden"
    >
      {/* White studio backdrop + contain keeps every product framed identically. */}
      <div className="relative aspect-square overflow-hidden bg-white p-3">
        <Image
          src={product.image}
          alt={product.name}
          fill
          sizes="(max-width: 768px) 50vw, 25vw"
          className="object-contain p-2 transition-transform duration-300 group-hover:scale-105"
          unoptimized
        />
        {product.badge && (
          <span className="absolute top-3 left-0 clip-slant bg-brand text-on-brand display text-xs px-3 py-1">
            {product.badge}
          </span>
        )}
      </div>
      <div className="p-4">
        <h3 className="display text-base text-foreground leading-tight group-hover:text-brand transition-colors">
          {product.name}
        </h3>
        <p className="mt-1 text-sm text-muted">{formatPrice(product.priceCents)}</p>
      </div>
    </Link>
  );
}
