"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { CartButton } from "@/components/cart-button";

// Text nav is intentionally focused on browsing categories. The two funnel
// entry points (Free Design + Team Order) live as buttons on the right so
// they're the most obvious actions, not lost in a list of links.
const nav = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Shop" },
  { href: "/team-uniforms", label: "Uniforms" },
  { href: "/drops", label: "Buy-Ins" },
  { href: "/embroidery", label: "Embroidery" },
  { href: "/gallery", label: "Gallery" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the mobile drawer whenever the route changes (link click).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  return (
    <header className="sticky top-0 z-50">
      {/* Announcement bar */}
      <div className="bg-brand text-on-brand text-center text-xs sm:text-sm font-semibold tracking-wide py-2 px-4">
        FREE CUSTOM DESIGNS · 2-3 WEEK TURNAROUND · 1-WEEK RUSH AVAILABLE
      </div>

      <div className="bg-ink/95 backdrop-blur border-b border-line">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex items-center justify-between h-16 gap-3">
            <Link href="/" className="flex items-center shrink-0">
              <Image
                src="/slugger-logo.png"
                alt="Slugger Athletics"
                width={1000}
                height={623}
                priority
                className="h-11 w-auto sm:h-12"
              />
            </Link>

            {/* Browse nav (desktop only) */}
            <nav className="hidden lg:flex items-center gap-6">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="display text-sm tracking-wide text-foreground/75 hover:text-foreground transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* Funnel CTAs + cart + hamburger */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <Link
                href="/design"
                className="hidden sm:inline-flex clip-slant bg-brand hover:bg-brand-dark text-on-brand display text-xs sm:text-sm px-3 sm:px-5 py-2.5 transition-colors"
              >
                Free Design
              </Link>
              <Link
                href="/team-order"
                className="hidden sm:inline-flex border border-brand/70 text-foreground hover:bg-brand/10 display text-xs sm:text-sm px-3 sm:px-5 py-2.5 transition-colors"
              >
                Team Order
              </Link>
              <CartButton />
              {/* Hamburger — shown on anything below lg (covers mobile + tablet
                  where text nav is hidden but CTAs are inline). */}
              <button
                onClick={() => setOpen((v) => !v)}
                aria-label="Open menu"
                aria-expanded={open}
                className="lg:hidden grid place-items-center h-10 w-10 border border-line text-foreground hover:bg-foreground/5"
              >
                <span className="sr-only">Menu</span>
                {open ? (
                  // X
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                  </svg>
                ) : (
                  // Hamburger
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Mobile-only inline funnel CTAs (under header bar, above the fold).
              Still useful since the hamburger needs a tap; these put the two
              primary actions one tap away. */}
          <div className="sm:hidden flex gap-2 pb-3">
            <Link
              href="/design"
              className="flex-1 text-center clip-slant bg-brand text-on-brand display text-xs px-3 py-2.5"
            >
              Free Design
            </Link>
            <Link
              href="/team-order"
              className="flex-1 text-center border border-brand/70 text-foreground display text-xs px-3 py-2.5"
            >
              Team Order
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <>
          {/* Scrim */}
          <div
            className="lg:hidden fixed inset-0 bg-black/60 z-40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          {/* Panel */}
          <nav
            className="lg:hidden fixed top-0 right-0 z-50 h-full w-[78%] max-w-sm bg-ink border-l border-line shadow-2xl overflow-y-auto"
            aria-label="Site"
          >
            <div className="flex items-center justify-between p-4 border-b border-line">
              <span className="display text-foreground">Menu</span>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="h-9 w-9 grid place-items-center border border-line hover:bg-foreground/5"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <ul className="py-2">
              {nav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="block px-5 py-3 display text-base text-foreground/85 hover:text-foreground hover:bg-foreground/5 border-b border-line/50"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="p-4 space-y-2">
              <Link
                href="/design"
                className="block text-center clip-slant bg-brand text-on-brand display text-sm px-4 py-3"
              >
                Get a Free Design
              </Link>
              <Link
                href="/team-order"
                className="block text-center border border-brand/70 text-foreground display text-sm px-4 py-3"
              >
                Start a Team Order
              </Link>
            </div>

            <div className="px-5 pb-6">
              <a
                href="sms:+13526601232"
                className="block text-center display text-sm bg-foreground/5 hover:bg-foreground/10 text-foreground border border-line px-4 py-3"
              >
                💬 Text us: (352) 660-1232
              </a>
              <p className="mt-2 text-[11px] text-muted text-center">
                Fastest way to reach us. Or <a href="mailto:apparel@sluggerathletics.com" className="underline">email</a>.
              </p>
            </div>
          </nav>
        </>
      )}
    </header>
  );
}
