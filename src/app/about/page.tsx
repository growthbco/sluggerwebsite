import type { Metadata } from "next";
import Link from "next/link";
import { MANUFACTURING_COPY } from "@/lib/customer-policy";

export const metadata: Metadata = {
  title: "About Slugger Athletics - Custom Uniforms Made in Ocala, FL",
  description:
    "Slugger Athletics is an Ocala, Florida custom team-uniform shop offering in-house design and embroidery, trusted production partners, free proofs, and nationwide shipping.",
  alternates: { canonical: "/about" },
};

const VALUES = [
  { t: "Design is free", d: "Every order starts with a free mockup from our in-house designer. You see your exact uniform before you spend a dollar - and revisions are included." },
  { t: "No nickel-and-diming", d: "Names, numbers, and unlimited colors are baked into the price. No per-color charges, no surprise setup fees on your jerseys." },
  { t: "We check every piece", d: "Before anything prints, our AI print-file check verifies every jersey against your roster - so names and numbers come out right." },
  { t: "Built for teams", d: "Shared roster links, per-player team stores, and easy reorders - the whole flow is built for coaches and parents, not just one-off buyers." },
];

export default function AboutPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: "About Slugger Athletics",
    url: "https://sluggerathletics.com/about",
    mainEntity: { "@id": "https://sluggerathletics.com/#business" },
  };

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="mx-auto max-w-4xl px-4 sm:px-6 py-16 text-center">
        <span className="display text-brand text-sm">Ocala, Florida · Ships Nationwide</span>
        <h1 className="display text-4xl sm:text-6xl text-foreground mt-2">About Slugger Athletics</h1>
        <p className="mt-5 text-lg text-muted max-w-2xl mx-auto">
          We&apos;re a locally owned custom team-uniform shop in Ocala, Florida. We design custom
          jerseys and uniforms, embroider team hats in our shop, and coordinate quality production
          for youth, travel, rec, school, and adult teams nationwide.
        </p>
      </section>

      <section className="bg-steel border-y border-line">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16 space-y-4 text-muted leading-relaxed">
          <h2 className="display text-3xl text-foreground">Our story</h2>
          <p>
            Slugger Athletics started with baseball and softball teams right here in Ocala, and it&apos;s
            still what we do best - though these days we outfit every sport. From the beginning the goal
            has been simple: make it easy for a coach or a team parent to get gear that looks like the
            big travel programs&apos; without the runaround, the hidden fees, or the guesswork.
          </p>
          <p>{MANUFACTURING_COPY}</p>
          <p>
            Everything runs through our own in-house design team. You send a logo or just an idea, we
            send back a real mockup, and nothing goes to production until you approve exactly what you
            want. Our jerseys are fully sublimated - your colors, logos, and numbers dyed into the
            fabric instead of pressed on top - so a 10U team&apos;s jerseys look as sharp in the last
            tournament of the season as the first.
          </p>
          <p>
            We build the whole ordering experience around teams: a free design first, a shared roster
            link so every player enters their own name, number, and size, an optional team store so
            parents order and pay for their own, and a print-file check that verifies every piece before
            it&apos;s made. We&apos;re local when you want to pick up in Ocala, and we ship nationwide when you don&apos;t.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-16">
        <h2 className="display text-3xl sm:text-4xl text-foreground">What we stand for</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {VALUES.map((v) => (
            <div key={v.t} className="border border-line bg-steel p-6">
              <h3 className="display text-lg text-foreground">{v.t}</h3>
              <p className="mt-2 text-sm text-muted">{v.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 sm:px-6 py-16 text-center">
        <h2 className="display text-3xl sm:text-4xl text-foreground">Let&apos;s build your team&apos;s look</h2>
        <p className="mt-4 text-muted max-w-2xl mx-auto">
          Based in Ocala, serving Marion County and all of Central Florida - The Villages, Gainesville,
          Belleview, Summerfield, Dunnellon, Leesburg - and shipping to teams nationwide.
        </p>
        <p className="mt-6 text-muted">
          Call <a href="tel:+13524147270" className="text-brand hover:underline">352-414-7270</a> or
          email <a href="mailto:apparel@sluggerathletics.com" className="text-brand hover:underline">apparel@sluggerathletics.com</a>
        </p>
        <div className="mt-8 flex flex-wrap gap-4 justify-center">
          <Link href="/design" className="clip-slant bg-brand text-on-brand display text-lg px-8 py-4 hover:bg-brand-dark transition-colors">Start a Free Design</Link>
          <Link href="/pricing" className="clip-slant border border-line text-foreground display text-lg px-8 py-4 hover:bg-foreground/5 transition-colors">See 2026 Pricing</Link>
        </div>
      </section>
    </div>
  );
}
