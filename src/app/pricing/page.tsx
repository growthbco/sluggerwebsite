import type { Metadata } from "next";
import Link from "next/link";
import { PRICE_LIST, formatDollars } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Pricing - Custom Jerseys, Uniforms & Team Gear",
  description:
    "Straightforward pricing for custom team gear: round-neck jerseys $28, button jerseys $35-38, pants $40, embroidered hats $25-30. Custom design included, no minimums.",
  alternates: { canonical: "/pricing" },
};

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-14">
      <header className="max-w-2xl">
        <span className="display text-brand text-sm">Pricing</span>
        <h1 className="display text-4xl sm:text-5xl text-foreground mt-1">Simple, Flat Pricing</h1>
        <p className="mt-3 text-muted">
          The price you see is the price per piece - custom design included, no minimums,
          no surprises. Order 5 or 50, it&apos;s the same rate.
        </p>
      </header>

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
          <li>Need it within 2 weeks? Rush production adds $5 per item.</li>
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
