"use client";

import { useState } from "react";
import { useCart } from "@/lib/cart";

type Props = {
  slug: string;
  name: string;
  image: string;
  priceCents: number;
  sizes: string[];
  inStock: boolean;
  // Customization fields offered for this product (e.g. Player Name, Number).
  customFields?: { label: string; maxLength?: number }[];
};

export function ProductPurchase({
  slug,
  name,
  image,
  priceCents,
  sizes,
  inStock,
  customFields = [],
}: Props) {
  const { add } = useCart();
  const [size, setSize] = useState<string>(sizes[0] ?? "");
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const needsSize = sizes.length > 0;
  const canAdd = inStock && (!needsSize || size);

  function handleAdd() {
    add(
      {
        slug,
        name,
        image,
        size: size || undefined,
        customization: Object.keys(custom).length ? custom : undefined,
        unitPriceCents: priceCents,
      },
      qty,
    );
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className="space-y-6">
      {needsSize && (
        <div>
          <label className="display text-sm text-foreground">Size</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {sizes.map((s) => (
              <button
                key={s}
                onClick={() => setSize(s)}
                className={`min-w-12 px-3 py-2 text-sm border transition-colors ${
                  size === s
                    ? "bg-brand text-on-brand border-brand"
                    : "bg-steel border-line text-foreground/80 hover:border-brand/50"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {customFields.map((f) => (
        <div key={f.label}>
          <label className="display text-sm text-foreground">{f.label}</label>
          <input
            type="text"
            maxLength={f.maxLength}
            value={custom[f.label] ?? ""}
            onChange={(e) => setCustom((c) => ({ ...c, [f.label]: e.target.value }))}
            placeholder={`Enter ${f.label.toLowerCase()}`}
            className="mt-2 w-full bg-steel border border-line px-3 py-2.5 text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
          />
        </div>
      ))}

      <div className="flex items-center gap-4">
        <div className="flex items-center border border-line">
          <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="px-3 py-2 text-foreground hover:bg-foreground/5">−</button>
          <span className="w-10 text-center text-foreground">{qty}</span>
          <button onClick={() => setQty((q) => q + 1)} className="px-3 py-2 text-foreground hover:bg-foreground/5">+</button>
        </div>
        <button
          onClick={handleAdd}
          disabled={!canAdd}
          className="flex-1 clip-slant bg-brand hover:bg-brand-dark text-on-brand display text-lg px-8 py-3.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {!inStock ? "Sold Out" : added ? "Added ✓" : "Add to Cart"}
        </button>
      </div>

      {needsSize && !size && (
        <p className="text-xs text-muted">Select a size to continue.</p>
      )}
    </div>
  );
}
