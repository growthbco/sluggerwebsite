import Link from "next/link";
import Image from "next/image";

const cols = [
  {
    title: "Shop",
    links: [
      { href: "/shop", label: "All Products" },
      { href: "/team-uniforms", label: "Team Uniforms" },
      { href: "/embroidery", label: "Embroidered Hats" },
      { href: "/hype-chains", label: "Hype Chains" },
      { href: "/drops", label: "Buy-Ins" },
    ],
  },
  {
    title: "Teams",
    links: [
      { href: "/team-order", label: "Start a Team Order" },
      { href: "/team-stores", label: "Team Stores" },
      { href: "/size-guide", label: "Size Guide" },
    ],
  },
  {
    title: "Support",
    links: [
      { href: "/faq", label: "FAQs" },
      { href: "/shipping", label: "Shipping & Delivery" },
      { href: "/returns", label: "Returns & Exchanges" },
      { href: "/contact", label: "Contact" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="bg-ink border-t border-line mt-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-14">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <Image
              src="/slugger-logo.png"
              alt="Slugger Athletics"
              width={1000}
              height={623}
              className="h-12 w-auto"
            />
            <p className="mt-4 text-sm text-muted max-w-xs">
              Your team&apos;s partner in performance. Custom uniforms, embroidered
              hats, and hype chains - designed in-house, shipped fast.
            </p>
            <p className="mt-4 text-sm text-muted">
              apparel@sluggerathletics.com<br />352-660-1232
            </p>
          </div>

          {cols.map((col) => (
            <div key={col.title}>
              <h3 className="display text-sm text-foreground tracking-wide">{col.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-sm text-muted hover:text-foreground transition-colors">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted">
          <p>© {new Date().getFullYear()} Slugger Athletics. All rights reserved.</p>
          <div className="flex gap-5">
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
