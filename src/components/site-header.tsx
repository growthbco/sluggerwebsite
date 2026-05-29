import Link from "next/link";
import Image from "next/image";
import { CartButton } from "@/components/cart-button";

const nav = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Shop" },
  { href: "/team-uniforms", label: "Team Uniforms" },
  { href: "/design", label: "Start a Design" },
  { href: "/drops", label: "Buy-Ins" },
  { href: "/embroidery", label: "Embroidery" },
  { href: "/gallery", label: "Gallery" },
  { href: "/team-order", label: "Team Order" },
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
          <div className="flex items-center justify-between h-16">
            {/* Logo (used as-is - reads on dark via its gold/white outline, and on light) */}
            <Link href="/" className="flex items-center">
              <Image
                src="/slugger-logo.png"
                alt="Slugger Athletics"
                width={1000}
                height={623}
                priority
                className="h-11 w-auto sm:h-12"
              />
            </Link>

            {/* Nav */}
            <nav className="hidden md:flex items-center gap-7">
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

            {/* Actions */}
            <div className="flex items-center gap-3">
              <Link
                href="/team-order"
                className="hidden sm:inline-flex clip-slant bg-brand hover:bg-brand-dark text-on-brand display text-sm px-5 py-2.5 transition-colors"
              >
                Start a Team Order
              </Link>
              <CartButton />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
