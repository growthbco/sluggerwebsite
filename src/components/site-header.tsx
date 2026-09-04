"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { CartButton } from "@/components/cart-button";
import { SPORT_PAGES } from "@/lib/sport-pages";

// Text nav is intentionally focused on browsing categories. The two funnel
// entry points (Free Design + Team Order) live as buttons on the right so
// they're the most obvious actions, not lost in a list of links.
const nav = [
  { href: "/", label: "Home" },
  { href: "/team-uniforms", label: "Uniforms" },
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/size-guide", label: "Size Guide" },
  { href: "/gallery", label: "Gallery" },
  { href: "/faq", label: "Support" },
  { href: "/contact", label: "Contact" },
  { href: "/portal", label: "My Order" },
];

// "Uniforms" expands into every sport page (plus the hub itself). Flag football
// floats to the top of the list.
const UNIFORM_LINKS = [
  { href: "/team-uniforms", label: "All Team Uniforms" },
  ...[...SPORT_PAGES]
    .sort((a, b) => (a.slug === "custom-flag-football-uniforms" ? -1 : b.slug === "custom-flag-football-uniforms" ? 1 : 0))
    .map((s) => ({ href: `/${s.slug}`, label: s.sport })),
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

  // Private team stores are NOT the marketing site: no promo bar, category nav,
  // funnel buttons, or cart badge. The store page renders its own minimal header.
  if (pathname.startsWith("/store/")) return null;

  return (
    <header className="sticky top-0 z-50">
      {/* Announcement bar */}
      <div className="bg-brand text-on-brand text-center text-xs sm:text-sm font-semibold tracking-wide py-2 px-4">
        3-WEEK STANDARD · 2-WEEK RUSH $100 · SHIPPING EXTRA
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
            <nav className="hidden lg:flex items-center gap-4 xl:gap-6">
              {nav.map((item) =>
                item.label === "Uniforms" ? (
                  <div key={item.href} className="relative group">
                    <Link
                      href={item.href}
                      className="display text-sm tracking-wide text-foreground/75 hover:text-foreground transition-colors inline-flex items-center gap-1"
                    >
                      {item.label}
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="mt-0.5 opacity-60">
                        <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </Link>
                    {/* Hover dropdown; pt-3 bridges the gap so it doesn't flicker. */}
                    <div className="absolute left-1/2 -translate-x-1/2 top-full pt-3 hidden group-hover:block group-focus-within:block">
                      <div className="bg-ink border border-line shadow-2xl py-2 min-w-[13rem]">
                        {UNIFORM_LINKS.map((l) => (
                          <Link
                            key={l.href}
                            href={l.href}
                            className="block px-4 py-2 display text-sm text-foreground/80 hover:text-foreground hover:bg-brand/10 whitespace-nowrap"
                          >
                            {l.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`display text-sm tracking-wide transition-colors ${item.href === "/size-guide" ? "text-brand hover:text-foreground" : "text-foreground/75 hover:text-foreground"}`}
                  >
                    {item.href === "/size-guide" ? <span aria-hidden="true">📏 </span> : null}{item.label}
                  </Link>
                ),
              )}
            </nav>

            {/* Funnel CTAs + cart + hamburger */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <Link
                href="/design"
                className="hidden min-h-11 sm:inline-flex items-center clip-slant bg-brand hover:bg-brand-dark text-on-brand display text-xs sm:text-sm px-3 sm:px-5 py-2.5 transition-colors"
              >
                Free Design
              </Link>
              <Link
                href="/team-order"
                className="hidden min-h-11 sm:inline-flex items-center border border-brand/70 text-foreground hover:bg-brand/10 display text-xs sm:text-sm px-3 sm:px-5 py-2.5 transition-colors"
              >
                Build Roster
              </Link>
              <CartButton />
              {/* Hamburger - shown on anything below lg (covers mobile + tablet
                  where text nav is hidden but CTAs are inline). */}
              <button
                onClick={() => setOpen((v) => !v)}
                aria-label="Open menu"
                aria-expanded={open}
                className="lg:hidden grid place-items-center h-11 w-11 border border-line text-foreground hover:bg-foreground/5"
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

          {/* Mobile-only quick actions under the header. The size guide stays
              one tap away because sizing is one of the most common questions. */}
          <div className="sm:hidden grid grid-cols-3 gap-2 pb-3">
            <Link
              href="/design"
              className="flex min-h-11 flex-1 items-center justify-center text-center clip-slant bg-brand text-on-brand display text-xs px-3 py-2.5"
            >
              Free Design
            </Link>
            <Link
              href="/team-order"
              className="flex min-h-11 items-center justify-center text-center border border-brand/70 text-foreground display text-[11px] px-2 py-2.5"
            >
              Build Roster
            </Link>
            <Link
              href="/size-guide"
              className="flex min-h-11 items-center justify-center text-center border border-line bg-foreground/5 text-brand display text-[11px] px-2 py-2.5"
            >
              📏 Size Guide
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
                className="h-11 w-11 grid place-items-center border border-line hover:bg-foreground/5"
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
                    className={`block px-5 py-3 display text-base hover:text-foreground hover:bg-foreground/5 border-b border-line/50 ${item.href === "/size-guide" ? "text-brand" : "text-foreground/85"}`}
                  >
                    {item.href === "/size-guide" ? <span aria-hidden="true">📏 </span> : null}{item.label}
                  </Link>
                  {item.label === "Uniforms" && (
                    <ul className="bg-foreground/[0.03] border-b border-line/50">
                      {UNIFORM_LINKS.slice(1).map((l) => (
                        <li key={l.href}>
                          <Link
                            href={l.href}
                            className="block pl-9 pr-5 py-2.5 display text-sm text-foreground/70 hover:text-foreground hover:bg-foreground/5"
                          >
                            {l.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
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
                Already approved? Build your roster
              </Link>
            </div>

            <div className="px-5 pb-6">
              <a
                href="sms:+13524147270"
                className="block text-center display text-sm bg-foreground/5 hover:bg-foreground/10 text-foreground border border-line px-4 py-3"
              >
                💬 Text us: (352) 414-7270
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
