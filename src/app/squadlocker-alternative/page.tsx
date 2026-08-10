import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "SquadLocker Alternative - Fully Custom Team Stores | Slugger Athletics",
  description:
    "Looking for a SquadLocker alternative? Slugger Athletics builds branded online team stores with fully custom, sublimated designs - free mockups, no per-item minimums, and real human support. Great for teams, leagues, schools, and booster clubs.",
  keywords: [
    "SquadLocker alternative",
    "custom team store",
    "online team store platform",
    "team spirit wear store",
    "booster club fundraiser store",
    "custom sublimated team uniforms",
  ],
  alternates: { canonical: "/squadlocker-alternative" },
};

const COMPARE: { label: string; slugger: string; catalog: string }[] = [
  { label: "Design", slugger: "Fully custom, sublimated artwork made for your team", catalog: "Your logo decorated onto stock catalog blanks" },
  { label: "Mockups", slugger: "Free custom mockup before you commit", catalog: "Limited to what the catalog and templates allow" },
  { label: "Minimums", slugger: "Order individually through the store - no per-item minimum", catalog: "Often catalog-driven, with brand/style limits" },
  { label: "Fundraising", slugger: "Add your own margin - the store doubles as a fundraiser", catalog: "Fundraising built in, but on stock decorated goods" },
  { label: "Support", slugger: "Talk to a real person in Ocala, FL - not a ticket queue", catalog: "Large-platform, mostly self-serve support" },
  { label: "Turnaround", slugger: "Most orders ship in 2-3 weeks; rush in about a week", catalog: "Varies by item and print method" },
];

const PERKS = [
  { t: "Fully custom, not decorated stock", d: "Every piece is sublimated in your team's own design - colors edge to edge, your logo, your numbers - not a screen print on a catalog blank." },
  { t: "Free design, see it first", d: "We mock up your gear for free so you approve the exact look before anyone orders. No guessing from a template." },
  { t: "No inventory, no cash collection", d: "Players and parents order and pay directly through your branded store. No bulk buying, no leftover stock, no chasing checks." },
  { t: "Built-in fundraising", d: "Add a margin to each item and the store raises money for your team or program on every order." },
  { t: "Real, local service", d: "We're a real shop in Ocala, Florida. Call or text and reach a person who knows your order - not a support queue." },
  { t: "One store, all your gear", d: "Jerseys, hats, hoodies, pants, socks, even 3D hype chains - all in your team's design, in one place to share." },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "Is Slugger Athletics a good SquadLocker alternative?",
    a: "If you want fully custom, sublimated team gear rather than your logo decorated onto stock catalog items, yes. We build a branded online store your players order from directly, design your gear for free, and there's no per-item minimum on store orders. You also get real, local support instead of a self-serve platform.",
  },
  {
    q: "How is a Slugger team store different from a catalog team store platform?",
    a: "Catalog platforms decorate stock blanks with your logo. We design and sublimate fully custom uniforms and apparel - your colors and artwork across the whole garment. Every design gets a free mockup you approve before production.",
  },
  {
    q: "Is there a minimum order for a team store?",
    a: "No per-item minimum for a team store - each player orders their own gear directly and pays online. (Bulk custom team orders start at 6 pieces per design.)",
  },
  {
    q: "Can the store raise money for our team?",
    a: "Yes. Add your own margin to each item and the store doubles as a fundraiser - you earn on every order, with no upfront inventory or cash to collect.",
  },
  {
    q: "How long does it take to set up a team store?",
    a: "Reach out with your team name, logo, and colors and we'll build your branded store and free design mockups. Once you approve, the store is ready to share.",
  },
];

export default function SquadLockerAlternativePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: "SquadLocker Alternative - Fully Custom Team Stores",
        description: metadata.description,
        url: "https://sluggerathletics.com/squadlocker-alternative",
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="mx-auto max-w-4xl px-4 sm:px-6 py-16 text-center">
        <span className="display text-brand text-sm">The Custom Team Store Alternative</span>
        <h1 className="display text-4xl sm:text-6xl text-foreground mt-2">A SquadLocker Alternative Built for Fully Custom Teams</h1>
        <p className="mt-5 text-lg text-muted max-w-2xl mx-auto">
          Comparing SquadLocker for your team store? Slugger Athletics gives you a branded online store your
          players order from directly - but with <strong className="text-foreground">fully custom, sublimated designs</strong>,
          free mockups, and no per-item minimums. Not your logo slapped on a catalog blank.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/contact" className="clip-slant bg-brand text-on-brand display text-lg px-8 py-4 hover:bg-brand-dark transition-colors">
            Request a Team Store
          </Link>
          <Link href="/team-stores" className="clip-slant border border-line text-foreground display text-lg px-8 py-4 hover:border-brand/60 transition-colors">
            How team stores work
          </Link>
        </div>
      </section>

      {/* Comparison */}
      <section className="bg-steel border-y border-line">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-16">
          <h2 className="display text-3xl sm:text-4xl text-foreground text-center">Slugger vs. a catalog team store platform</h2>
          <p className="mt-3 text-muted text-center max-w-2xl mx-auto">
            Big platforms like SquadLocker are built around decorating stock catalog products. Here&apos;s how a
            fully custom shop compares.
          </p>
          <div className="mt-8 overflow-x-auto">
            <table className="w-full text-sm border border-line bg-ink min-w-[560px]">
              <thead>
                <tr className="bg-steel text-left">
                  <th className="px-4 py-3 text-muted font-normal"></th>
                  <th className="px-4 py-3 display text-brand">Slugger Athletics</th>
                  <th className="px-4 py-3 display text-muted">Catalog platforms</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map((r) => (
                  <tr key={r.label} className="border-t border-line align-top">
                    <td className="px-4 py-3 display text-foreground whitespace-nowrap">{r.label}</td>
                    <td className="px-4 py-3 text-foreground">{r.slugger}</td>
                    <td className="px-4 py-3 text-muted">{r.catalog}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted text-center">
            Comparison reflects the typical catalog-decoration model. Slugger is not affiliated with SquadLocker.
          </p>
        </div>
      </section>

      {/* Perks */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-16">
        <h2 className="display text-3xl sm:text-4xl text-foreground text-center">Why teams choose Slugger</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PERKS.map((p) => (
            <div key={p.t} className="bg-steel border border-line p-6">
              <h3 className="display text-lg text-foreground">{p.t}</h3>
              <p className="mt-2 text-sm text-muted">{p.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-steel border-y border-line">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16">
          <h2 className="display text-3xl sm:text-4xl text-foreground text-center">Team store FAQ</h2>
          <div className="mt-8 space-y-3">
            {FAQ.map((f) => (
              <details key={f.q} className="bg-ink border border-line p-5 group">
                <summary className="flex cursor-pointer items-center justify-between gap-3 list-none">
                  <span className="display text-foreground">{f.q}</span>
                  <span className="text-brand text-xl transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-4 sm:px-6 py-16 text-center">
        <h2 className="display text-3xl sm:text-4xl text-foreground">Ready to build your team store?</h2>
        <p className="mt-4 text-muted max-w-2xl mx-auto">
          Tell us your team name, logo, and colors and we&apos;ll set up your branded store with free custom
          mockups. Email{" "}
          <a href="mailto:apparel@sluggerathletics.com" className="text-brand hover:underline">apparel@sluggerathletics.com</a>{" "}
          or call <a href="tel:+13524147270" className="text-brand hover:underline">352-414-7270</a>.
        </p>
        <Link href="/contact" className="inline-block mt-8 clip-slant bg-brand text-on-brand display text-lg px-8 py-4 hover:bg-brand-dark transition-colors">
          Get Started
        </Link>
      </section>
    </div>
  );
}
