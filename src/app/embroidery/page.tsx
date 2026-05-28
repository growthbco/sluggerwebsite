import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { byCategory, primaryImage } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Custom Embroidery in Ocala, FL - Embroidered Team Hats & Apparel",
  description:
    "Custom embroidery in Ocala, FL. Slugger Athletics embroiders team hats, caps, polos, jackets, and bags with your logo. Free design, fast turnaround, local service across Central Florida.",
  keywords: [
    "embroidery Ocala",
    "custom embroidery Ocala FL",
    "embroidered hats Ocala",
    "team hats embroidery",
    "custom embroidered caps Florida",
    "logo embroidery Central Florida",
  ],
  alternates: { canonical: "/embroidery" },
};

const WHAT_WE_EMBROIDER = [
  { t: "Team Hats & Caps", d: "Fitted, snapback, and trucker caps with 3D puff or flat embroidery of your team logo or wordmark." },
  { t: "Polos & Coaches' Gear", d: "Sideline-ready polos, quarter-zips, and jackets embroidered with names, numbers, and logos." },
  { t: "Bags & Accessories", d: "Duffle bags, backpacks, and beanies embroidered to round out your team's look." },
  { t: "Business & Spirit Wear", d: "Local business uniforms, booster club gear, and school spirit wear - embroidered to look professional." },
];

const PROCESS = [
  { n: 1, t: "Send your logo", d: "Share your logo or idea - our in-house team digitizes it for embroidery at no charge." },
  { n: 2, t: "Approve a proof", d: "We send a free proof so you can see exactly how the stitch-out will look before we run it." },
  { n: 3, t: "We stitch & ship", d: "Your embroidered hats and gear are produced and shipped fast - typically in 2-3 weeks." },
];

export default function EmbroideryPage() {
  const hatExamples = byCategory("hats").slice(0, 4);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: "Custom Embroidery",
    provider: {
      "@type": "LocalBusiness",
      name: "Slugger Athletics",
      email: "apparel@sluggerathletics.com",
      telephone: "+1-352-660-1232",
      areaServed: { "@type": "City", name: "Ocala, Florida" },
    },
    areaServed: "Ocala, FL and Central Florida",
    description:
      "Custom embroidery for team hats, caps, polos, jackets, and bags in Ocala, FL.",
  };

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-4 sm:px-6 py-16 text-center">
        <span className="display text-brand text-sm">Custom Embroidery · Ocala, FL</span>
        <h1 className="display text-4xl sm:text-6xl text-foreground mt-2">
          Custom Embroidery in Ocala
        </h1>
        <p className="mt-5 text-lg text-muted max-w-2xl mx-auto">
          Slugger Athletics is your local source for <strong className="text-foreground">custom embroidered team hats</strong>,
          caps, polos, and apparel in Ocala and across Central Florida. We embroider
          your logo with crisp, durable stitching - designed in-house, free of charge,
          and shipped fast.
        </p>
        <div className="mt-8 flex flex-wrap gap-4 justify-center">
          <Link href="/team-order" className="clip-slant bg-brand text-on-brand display text-lg px-8 py-4 hover:bg-brand-dark transition-colors">
            Start an Order
          </Link>
          <Link href="/contact" className="clip-slant border border-line text-foreground display text-lg px-8 py-4 hover:bg-foreground/5 transition-colors">
            Get a Quote
          </Link>
        </div>
      </section>

      {/* What we embroider */}
      <section className="bg-steel border-y border-line">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-16">
          <h2 className="display text-3xl sm:text-4xl text-foreground">What We Embroider</h2>
          <p className="mt-3 text-muted max-w-2xl">
            From a single embroidered cap to a full team set, we handle it all in-house.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {WHAT_WE_EMBROIDER.map((w) => (
              <div key={w.t} className="bg-ink border border-line p-6">
                <h3 className="display text-lg text-foreground">{w.t}</h3>
                <p className="mt-2 text-sm text-muted">{w.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Examples */}
      {hatExamples.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 py-16">
          <h2 className="display text-3xl sm:text-4xl text-foreground">Recent Embroidered Hats</h2>
          <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
            {hatExamples.map((p) => (
              <div key={p.slug} className="bg-white p-3 border border-line">
                <div className="relative aspect-square">
                  <Image src={primaryImage(p)} alt={`${p.name} - custom embroidery Ocala`} fill sizes="25vw" className="object-contain p-2" unoptimized />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Process */}
      <section className="bg-steel border-y border-line">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-16">
          <h2 className="display text-3xl sm:text-4xl text-foreground text-center">How It Works</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {PROCESS.map((s) => (
              <div key={s.n} className="text-center">
                <div className="mx-auto h-12 w-12 grid place-items-center clip-slant bg-brand text-on-brand display text-xl">{s.n}</div>
                <h3 className="display text-lg text-foreground mt-4">{s.t}</h3>
                <p className="mt-2 text-sm text-muted">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Local SEO + CTA */}
      <section className="mx-auto max-w-4xl px-4 sm:px-6 py-16 text-center">
        <h2 className="display text-3xl sm:text-4xl text-foreground">Embroidery Near You in Central Florida</h2>
        <p className="mt-4 text-muted max-w-2xl mx-auto">
          Based in Ocala, we serve teams, leagues, schools, and businesses throughout
          Marion County and Central Florida - including The Villages, Gainesville, and
          surrounding areas. Looking for <strong className="text-foreground">embroidery in Ocala</strong>?
          We make custom embroidered hats and apparel easy.
        </p>
        <p className="mt-6 text-muted">
          Call <a href="tel:+13526601232" className="text-brand hover:underline">352-660-1232</a> or
          email <a href="mailto:apparel@sluggerathletics.com" className="text-brand hover:underline">apparel@sluggerathletics.com</a>
        </p>
        <Link href="/team-order" className="inline-block mt-8 clip-slant bg-brand text-on-brand display text-lg px-8 py-4 hover:bg-brand-dark transition-colors">
          Start Your Embroidery Order
        </Link>
      </section>
    </div>
  );
}
