"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart";

export function CartButton() {
  const { count } = useCart();
  return (
    <Link
      href="/cart"
      aria-label={`Cart, ${count} items`}
      className="relative grid place-items-center h-10 w-10 rounded-full bg-foreground/5 hover:bg-foreground/10 transition-colors"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-foreground">
        <path d="M6 6h15l-1.5 9h-12z" /><circle cx="9" cy="20" r="1" /><circle cx="18" cy="20" r="1" /><path d="M6 6 5 3H2" />
      </svg>
      <span className="absolute -top-1 -right-1 bg-brand text-on-brand text-[10px] font-bold h-4 min-w-4 px-1 grid place-items-center rounded-full">
        {count}
      </span>
    </Link>
  );
}
