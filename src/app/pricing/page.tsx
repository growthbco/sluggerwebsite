import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ExpandableImage } from "@/components/expandable-image";
import { PRICE_LIST, BUNDLES, BUNDLE_UPGRADE_NOTE, formatDollars } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "2026 Pricing - Custom Jerseys, Uniforms & Team Gear",
  description:
    "Straightforward 2026 pricing for custom team gear: round-neck jerseys $28, button jerseys $32-35, quarter-zips $38, pants $40, embroidered hats $25-30. Custom design included, 6-piece minimum per design.",
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-14">
      <header className="max-w-2xl">
        <span className="display text-brand text-sm">2026 Pricing</span>
        <h1 className="display text-4xl sm:text-5xl text-foreground mt-1">Simple, Flat 2026 Pricing</h1>
        <p className="mt-3 text-muted">
          The price you see is the price per piece - custom design included, no
          surprises. Custom orders start at 6 pieces per design; order 6 or 60, it&apos;s
          the same per-piece rate. The 6-piece minimum includes embroidered hats.
        </p>
        <p className="mt-2 text-xs text-muted">
          Prices shown are our 2026 rates. We review pricing as material costs, shipping
          rates, and duties change - the price on your invoice is always the one that counts.
        </p>
      </header>

      {/* Jersey styles - branded mockups so buyers can SEE the difference. */}
      <section className="mt-10">
        <h2 className="display text-2xl text-foreground">Jersey Styles</h2>
        <p className="mt-2 text-sm text-muted">
          Every style is fully custom sublimated - your colors, logos, names, and numbers, design
          included. Same flat prices for every sport: baseball, basketball, soccer, volleyball,
          flag, and beyond. Tap any style to see it up close.
        </p>
        <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { name: "Crew Neck", price: 2800, img: "/styles/crew.jpg" },
            { name: "Two-Button", price: 3200, img: "/styles/two-button.jpg" },
            { name: "Full-Button", price: 3500, img: "/styles/full-button.jpg" },
            { name: "Quarter-Zip", price: 3800, img: "/styles/quarter-zip.jpg" },
          ].map((s) => (
            <div key={s.name} className="bg-steel border border-line">
              <div className="relative aspect-square bg-white">
                <ExpandableImage src={s.img} alt={`Custom ${s.name} jersey by Slugger Athletics`} />
              </div>
              <div className="px-3 py-2.5 flex items-baseline justify-between">
                <span className="display text-sm text-foreground">{s.name}</span>
                <span className="display text-brand">{formatDollars(s.price)}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Bundles first - the simplest way to buy. */}
      <section className="mt-10">
        <h2 className="display text-2xl text-foreground">2026 Team Bundles (Baseball &amp; Softball)</h2>
        <p className="mt-2 text-sm text-muted">
          The easiest way to outfit a player - one price for the whole set, per player.
          Playing basketball, soccer, flag, or anything else? We build the same per-player
          bundle pricing for every sport - just ask when you order.
        </p>
        <div className="mt-4 grid gap-5 sm:grid-cols-3">
          {BUNDLES.map((b) => (
            <div key={b.name} className="bg-steel border border-line flex flex-col">
              <div className="relative aspect-square bg-white">
                <Image src={b.image} alt={`${b.name} - custom team gear bundle`} fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover" />
              </div>
              <div className="p-4 flex-1 flex flex-col">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="display text-lg text-foreground">{b.name}</h3>
                  <p className="shrink-0">
                    <span className="text-xs text-muted">from</span> <span className="display text-xl text-brand">{formatDollars(b.priceCents)}</span>{" "}
                    <span className="text-xs text-muted line-through">{formatDollars(b.compareAtCents)}</span>
                  </p>
                </div>
                <p className="mt-1.5 text-sm text-muted">{b.blurb}</p>
                <ul className="mt-3 space-y-1 text-sm text-foreground/90">
                  {b.includes.map((i) => (
                    <li key={i}>✓ {i}</li>
                  ))}
                </ul>
                <p className="mt-auto pt-3 text-xs text-brand display">
                  Save {formatDollars(b.compareAtCents - b.priceCents)} per player
                </p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">{BUNDLE_UPGRADE_NOTE}</p>
      </section>

      <div className="mt-10 space-y-8">
        {PRICE_LIST.map((g) => (
          <section key={g.group}>
            <h2 className="display text-xl text-foreground">{g.group}</h2>
            <div className="mt-3 border border-line divide-y divide-[color:var(--line)]">
              {g.rows.map((r) => (
                <div key={r.item} className="flex items-baseline justify-between gap-4 bg-steel px-4 py-3">
                  <div>
                    <p className="text-foreground">{r.item}</p>
                    {r.note && <p className="text-xs text-muted mt-0.5">{r.note}</p>}
                  </div>
                  <p className="display text-xl text-foreground shrink-0">{formatDollars(r.priceCents)}</p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="mt-10 bg-steel border border-line p-5">
        <h2 className="display text-lg text-foreground">The fine print (there isn&apos;t much)</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted list-disc pl-5">
          <li>Prices are per piece, plus tax. Fully custom design in your colors is included.</li>
          <li>Shipping is not included - it&apos;s calculated by weight at checkout. Local pickup in Ocala is always free.</li>
          <li>Standard turnaround is 2-3 weeks after you approve your design proof.</li>
          <li>Need it within 2 weeks? Rush service is a flat $100 fee. We confirm the timeline before promising a date.</li>
          <li>Hype chains and anything you don&apos;t see here are quoted custom - just ask.</li>
        </ul>
      </section>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/design"
          className="clip-slant bg-brand hover:bg-brand-dark text-on-brand display text-lg px-8 py-4 transition-colors"
        >
          Start a Custom Design
        </Link>
        <Link
          href="/team-order"
          className="border border-brand/70 text-foreground hover:bg-brand/10 display text-lg px-8 py-4 transition-colors"
        >
          Start a Team Order
        </Link>
      </div>
    </div>
  );
}
