import Link from "next/link";
import Image from "next/image";
import { FooterStaffLink } from "@/components/footer-staff-link";

const cols = [
  {
    title: "Shop",
    links: [
      { href: "/custom-sublimated-jerseys", label: "Custom Jerseys" },
      { href: "/team-uniforms", label: "Team Uniforms" },
      { href: "/custom-hats", label: "Custom Embroidered Hats" },
      { href: "/custom-beanies", label: "Custom Beanies" },
      { href: "/embroidery", label: "Embroidery - Ocala, FL" },
      { href: "/hype-chains", label: "Hype Chains" },
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
      { href: "/services", label: "All Services & Pricing" },
      { href: "/pricing", label: "Pricing" },
      { href: "/portal", label: "My Order & Tracking" },
      { href: "/faq", label: "FAQs" },
      { href: "/shipping", label: "Shipping & Delivery" },
      { href: "/returns", label: "Returns & Exchanges" },
      { href: "/about", label: "About Us" },
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
              Custom uniforms designed and quality-checked in Ocala, in-house
              embroidery, and clear order tracking from proof to delivery.
            </p>
            {/* Push texting as the fastest way to reach us. */}
            <a
              href="sms:+13524147270"
              className="mt-4 inline-flex items-center gap-2 clip-slant bg-brand text-on-brand display text-sm px-4 py-2.5 hover:bg-brand-dark transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Text us: (352) 414-7270
            </a>
            <p className="mt-3 text-xs text-muted">
              Fastest way to reach us. Or email <a href="mailto:apparel@sluggerathletics.com" className="underline hover:text-foreground">apparel@sluggerathletics.com</a>.
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
          <p>© {new Date().getFullYear()} Slugger Athletics LLC · Ocala, FL. All rights reserved.</p>
          <div className="flex gap-5 items-center">
            <a href="https://www.instagram.com/sluggerathletics/" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">Instagram</a>
            <a href="https://www.facebook.com/sluggerathletics/" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">Facebook</a>
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
            <FooterStaffLink />
          </div>
        </div>
      </div>
    </footer>
  );
}
