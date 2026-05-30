import Link from "next/link";
import Image from "next/image";
import { CartButton } from "@/components/cart-button";

// Text nav is intentionally focused on browsing categories. The two funnel
// entry points (Free Design + Team Order) live as buttons on the right so
// they're the most obvious actions, not lost in a list of links.
const nav = [
  { href: "/shop", label: "Shop" },
  { href: "/team-uniforms", label: "Uniforms" },
  { href: "/drops", label: "Buy-Ins" },
  { href: "/embroidery", label: "Embroidery" },
  { href: "/gallery", label: "Gallery" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50">
      {/* Announcement bar */}
      <div className="bg-brand text-on-brand text-center text-xs sm:text-sm font-semibold tracking-wide py-2 px-4">
        FREE CUSTOM DESIGNS · 2-3 WEEK TURNAROUND · 1-WEEK RUSH AVAILABLE
      </div>

      <div className="bg-ink/95 backdrop-blur border-b border-line">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex items-center justify-between h-16 gap-4">
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

            {/* Browse nav (links only) */}
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

            {/* Funnel entry points + cart */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <Link
                href="/design"
                className="hidden sm:inline-flex clip-slant bg-brand hover:bg-brand-dark text-on-brand display text-xs sm:text-sm px-3 sm:px-5 py-2.5 transition-colors"
              >
                Free Design
              </Link>
              <Link
                href="/team-order"
                className="hidden sm:inline-flex clip-slant border border-brand/70 text-foreground hover:bg-brand/10 display text-xs sm:text-sm px-3 sm:px-5 py-2.5 transition-colors"
              >
                Team Order
              </Link>
              <CartButton />
            </div>
          </div>

          {/* Mobile-only funnel CTAs (header buttons hidden under sm) */}
          <div className="sm:hidden flex gap-2 pb-3">
            <Link
              href="/design"
              className="flex-1 text-center clip-slant bg-brand text-on-brand display text-xs px-3 py-2.5"
            >
              Free Design
            </Link>
            <Link
              href="/team-order"
              className="flex-1 text-center clip-slant border border-brand/70 text-foreground display text-xs px-3 py-2.5"
            >
              Team Order
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
