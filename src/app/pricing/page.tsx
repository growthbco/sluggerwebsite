import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ExpandableImage } from "@/components/expandable-image";
import { PRICE_LIST, BUNDLES, BUNDLE_UPGRADE_NOTE, formatDollars } from "@/lib/pricing";
import {
  PRIORITY_PRODUCTION_COPY,
  RUSH_PRODUCTION_COPY,
  SHIPPING_TIMING_COPY,
  STANDARD_PRODUCTION_COPY,
} from "@/lib/customer-policy";

export const metadata: Metadata = {
  title: "2026 Pricing - Custom Jerseys, Uniforms & Team Gear",
  description:
    "Straightforward 2026 pricing for custom team gear: round-neck jerseys $28, V-necks $30, button jerseys $32-35, quarter-zips $40, pants $40, and embroidered hats from $30. Custom design included, 6-piece minimum per design.",
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="grid items-center gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(32rem,1.1fr)]">
        <div className="max-w-2xl">
          <span className="display text-brand text-sm">2026 Pricing</span>
          <h1 className="display text-4xl sm:text-5xl text-foreground mt-1">Simple, Flat 2026 Pricing</h1>
          <p className="mt-3 text-muted">
            The listed price is the merchandise price per piece, with custom design included.
            Custom orders start at 6 pieces per design; order 6 or 60, it&apos;s
            the same per-piece rate. The 6-piece minimum includes embroidered hats.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs text-foreground">
            <span className="rounded-full border border-brand/50 bg-brand/10 px-3 py-1.5">Custom artwork included</span>
            <span className="rounded-full border border-line bg-steel px-3 py-1.5">6-piece minimum</span>
            <span className="rounded-full border border-line bg-steel px-3 py-1.5">Youth &amp; adult sizes</span>
          </div>
          <p className="mt-4 text-xs text-muted">
            Prices shown are our 2026 rates. We review pricing as material costs, shipping
            rates, and duties change. Tax, shipping, and any clearly disclosed specialty fee are
            separate; the price on your invoice is the final amount you approve.
          </p>
        </div>

        <div className="grid grid-cols-5 gap-2" aria-label="Examples of custom Slugger Athletics uniforms">
          <div className="relative col-span-5 aspect-[5/4] overflow-hidden rounded-xl bg-[#f4efe7] sm:col-span-3 sm:row-span-2 sm:aspect-square">
            <Image
              src="/sports/generated/baseball-sa-catalog.png"
              alt="Black and gold custom baseball jersey, pants, and cap by Slugger Athletics"
              fill
              priority
              sizes="(max-width: 1024px) 60vw, 32vw"
              className="object-cover"
            />
          </div>
          <div className="relative col-span-2 hidden aspect-square overflow-hidden rounded-xl bg-[#f4efe7] sm:block">
            <Image
              src="/sports/generated/basketball-sa-catalog.png"
              alt="Black and gold custom basketball uniform by Slugger Athletics"
              fill
              sizes="(max-width: 1024px) 40vw, 20vw"
              className="object-cover"
            />
          </div>
          <div className="relative col-span-2 hidden aspect-square overflow-hidden rounded-xl bg-[#f4efe7] sm:block">
            <Image
              src="/sports/generated/cheer-sa-catalog.png"
              alt="Black and gold custom cheer uniform by Slugger Athletics"
              fill
              sizes="(max-width: 1024px) 40vw, 20vw"
              className="object-cover"
            />
          </div>
        </div>
      </header>

      {/* Jersey styles - branded mockups so buyers can SEE the difference. */}
      <section className="mt-10">
        <h2 className="display text-2xl text-foreground">Jersey Styles</h2>
        <p className="mt-2 text-sm text-muted">
          Every style is fully custom sublimated - your colors, logos, names, and numbers, design
          included. Same flat prices for every sport: baseball, basketball, soccer, volleyball,
          flag, and beyond. Tap any style to see it up close.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-5">
          {[
            { name: "Crew Neck", price: 2800, img: "/styles/crew.jpg" },
            { name: "V-Neck", price: 3000, img: "/styles/v-neck-sa.jpg" },
            { name: "Two-Button", price: 3200, img: "/styles/two-button-sa.jpg" },
            { name: "Full-Button", price: 3500, img: "/styles/full-button.jpg" },
            { name: "Quarter-Zip", price: 4000, img: "/styles/quarter-zip.jpg" },
          ].map((s) => (
            <div key={s.name} className="overflow-hidden rounded-lg border border-line bg-steel">
              <div className="relative aspect-[4/3] bg-white">
                <ExpandableImage src={s.img} alt={`Custom ${s.name} jersey by Slugger Athletics`} sizes="(max-width: 640px) 50vw, 20vw" />
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
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.2fr)]">
          <div className="relative min-h-[24rem] overflow-hidden rounded-xl bg-[#f4efe7] lg:min-h-full">
            <Image
              src="/sports/generated/softball-sa-catalog.png"
              alt="Custom softball jersey, pants, and visor included in Slugger Athletics team bundle options"
              fill
              sizes="(max-width: 1024px) 100vw, 40vw"
              className="object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/55 to-transparent px-5 pb-5 pt-16">
              <p className="display text-xl text-white">Built as one complete look</p>
              <p className="mt-1 max-w-sm text-sm text-white/80">Jersey, bottoms, and headwear are designed together in your colors—not pulled from a stock template.</p>
            </div>
          </div>

          <div className="grid gap-4">
            {BUNDLES.map((b) => (
              <div key={b.name} className="flex flex-col rounded-lg border border-line bg-steel p-4 sm:p-5">
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
            ))}
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">Product photography is a design example. Every team receives its own colors, logos, names, and numbers.</p>
        <p className="mt-3 text-xs text-muted">{BUNDLE_UPGRADE_NOTE}</p>
      </section>

      <div className="mt-10 grid gap-8 lg:grid-cols-2 lg:items-start">
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

      <section className="mt-10 max-w-4xl bg-steel border border-line p-5">
        <h2 className="display text-lg text-foreground">The fine print (there isn&apos;t much)</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted list-disc pl-5">
          <li>Prices are per piece, plus tax. Fully custom design in your colors is included.</li>
          <li>Shipping is not included - it&apos;s calculated by weight at checkout. Local pickup in Ocala is always free.</li>
          <li>{STANDARD_PRODUCTION_COPY}</li>
          <li>{RUSH_PRODUCTION_COPY} {PRIORITY_PRODUCTION_COPY}</li>
          <li>{SHIPPING_TIMING_COPY}</li>
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
