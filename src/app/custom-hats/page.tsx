import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { byCategory, primaryImage } from "@/lib/catalog";

export const metadata: Metadata = {
  title: "Custom Embroidered Hats - No Minimum Order | Fitted, Snapback & Trucker",
  description:
    "Custom embroidered hats with no minimum order. Fitted Flexfit caps, snapbacks, and trucker hats embroidered with your logo - free digitizing, free proof, flat $25-30 pricing, shipped in 2-3 weeks.",
  keywords: [
    "custom embroidered hats",
    "custom embroidered hats no minimum",
    "custom hats no minimum",
    "custom fitted hats",
    "custom snapback hats",
    "custom embroidered trucker hats",
    "embroidered baseball hats",
    "personalized embroidered hats",
  ],
  alternates: { canonical: "/custom-hats" },
};

// Styles come straight from the real price list (src/lib/pricing.ts): fitted
// Flexfit $30 XS-XXL, snapback trucker $25 OSFM, +$5 embroidered back number.
const STYLES = [
  {
    t: "Custom Fitted Hats",
    price: "$30",
    d: "Cap America and Pacific Headwear performance caps with Flexfit stretch. True fitted feel in sizes XS through XXL, embroidered with your logo front and center.",
  },
  {
    t: "Custom Snapback Hats",
    price: "$25",
    d: "Premium trucker-style snapbacks with a structured front panel and breathable mesh back. One size fits most - perfect for teams, fans, and businesses.",
  },
  {
    t: "Custom Trucker Hats",
    price: "$25",
    d: "Classic mesh-back truckers embroidered with your design. Great for leagues, tournaments, and giveaways where everyone wants one look.",
  },
  {
    t: "Embroidered Numbers",
    price: "+$5",
    d: "Add a player number embroidered on the back of any hat. Team orders capture each player's number automatically.",
  },
];

const FAQS = [
  {
    q: "Is there a minimum order for custom embroidered hats?",
    a: "No. We embroider custom hats with no minimum order - buy one hat or outfit a whole roster. The price stays the same flat $25-30 per hat either way.",
  },
  {
    q: "How much do custom embroidered hats cost?",
    a: "Snapback and trucker hats are $25, fitted Flexfit hats are $30, and an embroidered number on the back adds $5. Logo digitizing, the design work, and your proof are all free - no setup fees.",
  },
  {
    q: "Do you charge a digitizing or setup fee?",
    a: "No. Our in-house team digitizes your logo for embroidery at no charge, and you approve a free proof before we stitch anything.",
  },
  {
    q: "Can you do 3D puff embroidery?",
    a: "Yes - we do both 3D puff embroidery for bold, raised lettering and flat embroidery for detailed logos. We'll recommend the right style for your artwork on your proof.",
  },
  {
    q: "How long do custom hats take?",
    a: "Most hat orders ship in 2-3 weeks after you approve your proof. Need them sooner? Rush production gets hats to you in about a week.",
  },
  {
    q: "What logo file do I need?",
    a: "Anything works - a PNG, JPG, PDF, or even a photo of your old gear. We redraw and digitize it for stitching, free of charge, and you approve the result before production.",
  },
];

export default function CustomHatsPage() {
  const hatExamples = byCategory("hats").slice(0, 4);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Custom Embroidered Hats",
      description:
        "Custom embroidered fitted, snapback, and trucker hats with no minimum order. Free logo digitizing and proof.",
      brand: { "@type": "Brand", name: "Slugger Athletics" },
      offers: {
        "@type": "AggregateOffer",
        lowPrice: "25.00",
        highPrice: "30.00",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        seller: { "@type": "LocalBusiness", name: "Slugger Athletics" },
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQS.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-4 sm:px-6 py-16 text-center">
        <span className="display text-brand text-sm">No Minimums · Free Digitizing · Free Proof</span>
        <h1 className="display text-4xl sm:text-6xl text-foreground mt-2">
          Custom Embroidered Hats
        </h1>
        <p className="mt-5 text-lg text-muted max-w-2xl mx-auto">
          Fitted Flexfit caps, snapbacks, and trucker hats embroidered with your logo -{" "}
          <strong className="text-foreground">no minimum order</strong>. Flat pricing at{" "}
          <strong className="text-foreground">$25-30 per hat</strong>, free logo digitizing, and a
          free proof before we stitch. Order one hat or a hundred - same price, same quality.
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

      {/* Styles + pricing */}
      <section className="bg-steel border-y border-line">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-16">
          <h2 className="display text-3xl sm:text-4xl text-foreground">Hat Styles & Pricing</h2>
          <p className="mt-3 text-muted max-w-2xl">
            Every hat is embroidered in-house on Cap America and Pacific Headwear blanks -
            the same caps the big brands use. See the{" "}
            <Link href="/pricing" className="text-brand hover:underline">full price list</Link> for
            everything we make.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STYLES.map((s) => (
              <div key={s.t} className="bg-ink border border-line p-6">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="display text-lg text-foreground">{s.t}</h3>
                  <span className="display text-brand">{s.price}</span>
                </div>
                <p className="mt-2 text-sm text-muted">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Examples */}
      {hatExamples.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 py-16">
          <h2 className="display text-3xl sm:text-4xl text-foreground">Recent Custom Hats</h2>
          <p className="mt-3 text-muted max-w-2xl">
            A few embroidered hats fresh off the machine - or{" "}
            <Link href="/shop/hats" className="text-brand hover:underline">shop ready-made embroidered hats</Link>{" "}
            you can buy today.
          </p>
          <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
            {hatExamples.map((p) => (
              <Link key={p.slug} href={`/product/${p.slug}`} className="bg-white p-3 border border-line group">
                <div className="relative aspect-square">
                  <Image src={primaryImage(p)} alt={`${p.name} - custom embroidered hat`} fill sizes="25vw" className="object-contain p-2 transition-transform group-hover:scale-105" unoptimized />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 3D puff vs flat */}
      <section className="bg-steel border-y border-line">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-16">
          <h2 className="display text-3xl sm:text-4xl text-foreground text-center">3D Puff or Flat Embroidery</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div className="bg-ink border border-line p-6">
              <h3 className="display text-lg text-foreground">3D Puff Embroidery</h3>
              <p className="mt-2 text-sm text-muted">
                Bold, raised stitching that pops off the cap - the look you see on pro ball caps.
                Best for big letters, numbers, and simple logos that should read from the bleachers.
              </p>
            </div>
            <div className="bg-ink border border-line p-6">
              <h3 className="display text-lg text-foreground">Flat Embroidery</h3>
              <p className="mt-2 text-sm text-muted">
                Crisp, detailed stitching for full-color logos, mascots, and fine text. Durable,
                washable, and sharp - ideal for business logos and detailed team crests.
              </p>
            </div>
          </div>
          <p className="mt-8 text-center text-muted">
            Not sure which fits your logo? Send it over - we&apos;ll digitize it free and show you a
            proof in both directions if it&apos;s a close call.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 py-16">
        <h2 className="display text-3xl sm:text-4xl text-foreground text-center">How It Works</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {[
            { n: 1, t: "Send your logo", d: "Share your logo or idea - our in-house team digitizes it for embroidery at no charge." },
            { n: 2, t: "Approve a proof", d: "We send a free proof so you see exactly how the stitch-out will look before we run it." },
            { n: 3, t: "We stitch & ship", d: "Your hats are embroidered and shipped fast - typically in 2-3 weeks, or about a week with rush." },
          ].map((s) => (
            <div key={s.n} className="text-center">
              <div className="mx-auto h-12 w-12 grid place-items-center clip-slant bg-brand text-on-brand display text-xl">{s.n}</div>
              <h3 className="display text-lg text-foreground mt-4">{s.t}</h3>
              <p className="mt-2 text-sm text-muted">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Who it's for + internal links */}
      <section className="bg-steel border-y border-line">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-16 text-center">
          <h2 className="display text-3xl sm:text-4xl text-foreground">Hats for Teams, Businesses & Fans</h2>
          <p className="mt-4 text-muted max-w-2xl mx-auto">
            We embroider baseball and softball team hats with matching player numbers, business
            caps with your company logo, and one-off personalized hats for fans and gifts. Hats
            pair perfectly with our{" "}
            <Link href="/team-uniforms" className="text-brand hover:underline">custom team uniforms</Link> -
            one order, one look, head to toe. Local to Central Florida? We also offer full{" "}
            <Link href="/embroidery" className="text-brand hover:underline">custom embroidery in Ocala, FL</Link>{" "}
            with free local pickup, covering polos, jackets, and bags too.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 sm:px-6 py-16">
        <h2 className="display text-3xl sm:text-4xl text-foreground">Custom Hat FAQs</h2>
        <div className="mt-8 divide-y divide-[color:var(--line)] border-y border-line">
          {FAQS.map((f) => (
            <details key={f.q} className="group py-4">
              <summary className="flex cursor-pointer items-center justify-between gap-4 list-none">
                <span className="display text-foreground">{f.q}</span>
                <span className="text-brand text-xl transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-muted">{f.a}</p>
            </details>
          ))}
        </div>
        <div className="mt-10 text-center">
          <p className="text-muted">
            Call <a href="tel:+13526601232" className="text-brand hover:underline">352-660-1232</a> or
            email <a href="mailto:apparel@sluggerathletics.com" className="text-brand hover:underline">apparel@sluggerathletics.com</a>
          </p>
          <Link href="/team-order" className="inline-block mt-6 clip-slant bg-brand text-on-brand display text-lg px-8 py-4 hover:bg-brand-dark transition-colors">
            Start Your Hat Order
          </Link>
        </div>
      </section>
    </div>
  );
}
