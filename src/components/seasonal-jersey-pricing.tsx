import Link from "next/link";
import { moneyFromCents } from "@/lib/customer-policy";
import { jerseyPriceCents } from "@/lib/team-order-pricing";

export function SeasonalJerseyPricing() {
  return (
    <section aria-labelledby="seasonal-pricing" className="border-b border-line bg-steel">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="grid items-center gap-6 lg:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <p className="display text-sm tracking-widest text-brand">CUSTOM LOOK. CLEAR PRICING.</p>
            <h2 id="seasonal-pricing" className="display mt-2 text-3xl text-foreground">Built for your team. Priced per jersey.</h2>
            <p className="mt-3 text-sm text-muted">Custom artwork, team colors, names, and numbers included. Free design mockup to start.</p>
          </div>
          {[["Standard Crew Neck", "Short-sleeve crewneck"], ["Full Button", "Full-button jersey"]].map(([style, label]) => (
            <div key={style} className="border border-brand/30 bg-background p-5">
              <h3 className="display text-xl text-foreground">{label}</h3>
              <p className="mt-2 text-muted">From <span className="display text-4xl text-brand">{moneyFromCents(jerseyPriceCents(style))}</span> / jersey</p>
            </div>
          ))}
        </div>
        <p className="mt-5 text-sm leading-relaxed text-muted">6-piece minimum per design. Prices are merchandise only, plus applicable tax. Standard shipping is extra; confirmed Rush includes shipping. Long sleeves, premium fabrics, and other styles are quoted separately.</p>
        <Link href="/pricing" className="mt-2 inline-flex min-h-11 items-center text-sm text-brand underline underline-offset-4">See all styles and pricing →</Link>
      </div>
    </section>
  );
}
