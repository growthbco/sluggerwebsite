"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart";

export default function CheckoutSuccessPage() {
  const { clear } = useCart();

  // Payment succeeded - empty the cart.
  useEffect(() => {
    clear();
  }, [clear]);

  return (
    <div className="mx-auto max-w-xl px-4 sm:px-6 py-24 text-center">
      <div className="mx-auto h-14 w-14 grid place-items-center clip-slant bg-brand text-on-brand display text-2xl">
        ✓
      </div>
      <h1 className="display text-4xl text-foreground mt-6">Order Confirmed</h1>
      <p className="mt-4 text-muted">
        Thanks for your order! You&apos;ll get a confirmation email shortly, and our
        team is already on it. Free design proofs and your 2-3 week turnaround
        start now.
      </p>
      <Link
        href="/shop"
        className="inline-block mt-8 clip-slant bg-brand text-on-brand display px-8 py-3.5 hover:bg-brand-dark transition-colors"
      >
        Keep Shopping
      </Link>
    </div>
  );
}
