"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/catalog";

export default function CartPage() {
  const { items, subtotalCents, setQuantity, remove } = useCart();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({
            slug: i.slug,
            size: i.size,
            customization: i.customization,
            quantity: i.quantity,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Checkout failed");
      window.location.href = data.url;
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-14">
      <h1 className="display text-4xl text-foreground">Your Cart</h1>

      {items.length === 0 ? (
        <div className="mt-8">
          <p className="text-muted">Your cart is empty.</p>
          <Link
            href="/shop"
            className="inline-block mt-5 clip-slant bg-brand text-on-brand display px-6 py-3 hover:bg-brand-dark transition-colors"
          >
            Shop Now
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
          <ul className="divide-y divide-[color:var(--line)]">
            {items.map((i) => (
              <li key={i.key} className="flex gap-4 py-5">
                <div className="relative h-24 w-24 shrink-0 bg-steel border border-line overflow-hidden">
                  <Image src={i.image} alt={i.name} fill sizes="96px" className="object-cover" unoptimized />
                </div>
                <div className="flex-1">
                  <h3 className="display text-foreground">{i.name}</h3>
                  {i.size && <p className="text-sm text-muted">Size: {i.size}</p>}
                  {i.customization &&
                    Object.entries(i.customization).map(([k, v]) =>
                      v ? <p key={k} className="text-sm text-muted">{k}: {v}</p> : null,
                    )}
                  <div className="mt-2 flex items-center gap-3">
                    <div className="flex items-center border border-line text-sm">
                      <button onClick={() => setQuantity(i.key, i.quantity - 1)} className="px-2.5 py-1 text-foreground hover:bg-foreground/5">−</button>
                      <span className="w-8 text-center text-foreground">{i.quantity}</span>
                      <button onClick={() => setQuantity(i.key, i.quantity + 1)} className="px-2.5 py-1 text-foreground hover:bg-foreground/5">+</button>
                    </div>
                    <button onClick={() => remove(i.key)} className="text-sm text-muted hover:text-brand">Remove</button>
                  </div>
                </div>
                <p className="display text-foreground">{formatPrice(i.unitPriceCents * i.quantity)}</p>
              </li>
            ))}
          </ul>

          <aside className="bg-steel border border-line p-6 h-fit">
            <h2 className="display text-xl text-foreground">Summary</h2>
            <div className="mt-4 flex justify-between text-sm text-muted">
              <span>Subtotal</span>
              <span className="text-foreground">{formatPrice(subtotalCents)}</span>
            </div>
            <p className="mt-1 text-xs text-muted">Shipping calculated at checkout.</p>
            <button
              onClick={checkout}
              disabled={loading}
              className="mt-5 w-full clip-slant bg-brand text-on-brand display text-lg py-3.5 hover:bg-brand-dark transition-colors disabled:opacity-60"
            >
              {loading ? "Starting checkout…" : "Checkout"}
            </button>
            {error && <p className="mt-3 text-xs text-brand text-center">{error}</p>}
            <p className="mt-3 text-xs text-muted text-center">Secure checkout · Free design proofs</p>
          </aside>
        </div>
      )}
    </div>
  );
}
