import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  // Layout appends "| Slugger Athletics"; keep the base title short.
  title: "Custom Beanies - Embroidered & Knit",
  description:
    "Custom beanies for teams, schools, and businesses - embroidered, knit-in, patch, and pom styles with your logo. Made to order with fast, friendly service from Slugger Athletics.",
  openGraph: {
    title: "Custom Beanies - Embroidered & Knit",
    description:
      "Custom embroidered and knit beanies with your logo - team, school, and business winter hats made to order.",
    type: "website",
    url: "/custom-beanies",
  },
  twitter: {
    card: "summary_large_image",
    title: "Custom Beanies - Embroidered & Knit",
    description:
      "Custom embroidered and knit beanies with your logo - team, school, and business winter hats made to order.",
  },
  keywords: [
    "custom beanies",
    "custom embroidered beanies",
    "custom beanies with logo",
    "custom logo beanies",
    "embroidered beanies",
    "custom winter hats",
    "personalized beanies",
    "custom knit beanies",
    "custom pom beanies",
    "bulk custom beanies",
    "custom team beanies",
    "custom beanies Ocala",
  ],
  alternates: { canonical: "/custom-beanies" },
};

// Beanies are made to order (decorated / knit by our supplier), NOT stitched
// in-house like our hats - copy stays honest about that. Prices are starting
// estimates; final price is per quote and depends on style + quantity.
const STYLES = [
  {
    t: "Custom Knit Beanies",
    price: "from $40",
    d: "Your team name and colors knitted right into the beanie (jacquard), finished with a matching pom and an embroidered logo. The premium school-spirit look. Larger minimum and a few weeks' lead time.",
  },
  {
    t: "Custom Embroidered Beanies",
    price: "from $25",
    d: "A classic cuffed or fold knit beanie with your logo embroidered on the front. Clean, warm, and affordable - great for teams, staff, and giveaways.",
  },
  {
    t: "Custom Patch Beanies",
    price: "from $28",
    d: "A woven or leather-style patch stitched on the cuff for a modern, outdoorsy look. Perfect for brands and businesses that want a premium feel.",
  },
  {
    t: "Custom Pom Beanies",
    price: "from $30",
    d: "Add a classic pom-pom on top in your team colors. Available on knit and embroidered styles - a fan and player favorite for cold game days.",
  },
];

const FAQS = [
  {
    q: "How much do custom beanies cost?",
    a: "Embroidered beanies start around $25, patch beanies around $28, and fully custom knit-in beanies with a pom start around $40. Final pricing depends on the style and quantity - send us what you have in mind and we will get you an exact quote.",
  },
  {
    q: "Is there a minimum order for custom beanies?",
    a: "Embroidered and patch beanies have a small minimum, the same as the rest of our custom gear. Fully custom knit-in beanies (where your design is knitted into the hat) are made to order and carry a larger minimum with a few weeks of production time - ask us and we will tell you exactly what your style needs.",
  },
  {
    q: "What decoration options do you offer on beanies?",
    a: "Embroidered logos, woven and leather-style patches, and full custom knit-in designs where your team name and colors are worked right into the beanie. We will recommend the best method for your logo on a free proof.",
  },
  {
    q: "Can you make beanies for my whole team or school?",
    a: "Yes. Custom team beanies and school spirit beanies are one of our favorites - matching colors, your mascot or logo, and optional player names or numbers. They pair perfectly with your team uniforms and hats for one consistent look.",
  },
  {
    q: "How long do custom beanies take?",
    a: "Embroidered and patch beanies turn around quickly. Fully custom knit-in beanies are manufactured to order, so plan on a few weeks - order early for the fall and winter season. We will always confirm your timeline before you commit.",
  },
  {
    q: "What logo file do I need?",
    a: "Anything works - a PNG, JPG, PDF, or a photo of your old gear. We redraw and digitize it into a production-ready file and you approve a free proof before anything is made.",
  },
];

export default function CustomBeaniesPage() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Custom Beanies",
      description:
        "Custom embroidered, knit, patch, and pom beanies with your logo for teams, schools, and businesses. Made to order by Slugger Athletics.",
      brand: { "@type": "Brand", name: "Slugger Athletics" },
      offers: {
        "@type": "AggregateOffer",
        lowPrice: "25.00",
        highPrice: "40.00",
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
        <span className="display text-brand text-sm">Embroidered · Knit · Patch · Made to Order</span>
        <h1 className="display text-4xl sm:text-6xl text-foreground mt-2">Custom Beanies</h1>
        <p className="mt-5 text-lg text-muted max-w-2xl mx-auto">
          Custom beanies with your logo - embroidered, patched, or fully knit-in with a pom. Built for
          teams, schools, businesses, and fans who want to stay warm and reppin&apos; their colors.
          Your mockup is free, and we&apos;ll confirm pricing and timeline before you commit. Order
          early for fall and winter - basketball season, cold game days, and holiday gifts.
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
          <h2 className="display text-3xl sm:text-4xl text-foreground">Beanie Styles & Pricing</h2>
          <p className="mt-3 text-muted max-w-2xl">
            From quick embroidered logos to fully custom knit-in team beanies. Prices below are
            starting points - send us your idea and quantity for an exact quote. See the{" "}
            <Link href="/pricing" className="text-brand hover:underline">full price list</Link> for
            our other custom gear.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STYLES.map((s) => (
              <div key={s.t} className="bg-ink border border-line p-6">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="display text-lg text-foreground">{s.t}</h3>
                  <span className="display text-brand whitespace-nowrap">{s.price}</span>
                </div>
                <p className="mt-2 text-sm text-muted">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 py-16">
        <h2 className="display text-3xl sm:text-4xl text-foreground text-center">How It Works</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {[
            { n: 1, t: "Send your logo", d: "Share your logo, colors, or a photo of your old gear. We turn it into a production-ready design at no upfront cost." },
            { n: 2, t: "Approve a free proof", d: "You see exactly how your beanie will look - style, colors, and logo - before anything is made." },
            { n: 3, t: "We make & ship", d: "Embroidered styles turn fast; custom knit-in beanies are made to order in a few weeks. We confirm your timeline first." },
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
          <h2 className="display text-3xl sm:text-4xl text-foreground">Beanies for Teams, Schools & Businesses</h2>
          <p className="mt-4 text-muted max-w-2xl mx-auto">
            Custom team beanies with your mascot and colors, school spirit beanies for the whole
            student section, and branded winter hats for your business or staff. Beanies pair
            perfectly with our{" "}
            <Link href="/custom-hats" className="text-brand hover:underline">custom embroidered hats</Link>{" "}
            and{" "}
            <Link href="/team-uniforms" className="text-brand hover:underline">custom team uniforms</Link>{" "}
            for one head-to-toe look. Local to Central Florida? Ask about pickup in Ocala.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 sm:px-6 py-16">
        <h2 className="display text-3xl sm:text-4xl text-foreground">Custom Beanie FAQs</h2>
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
            Call <a href="tel:+13524147270" className="text-brand hover:underline">352-414-7270</a> or
            email <a href="mailto:apparel@sluggerathletics.com" className="text-brand hover:underline">apparel@sluggerathletics.com</a>
          </p>
          <Link href="/team-order" className="inline-block mt-6 clip-slant bg-brand text-on-brand display text-lg px-8 py-4 hover:bg-brand-dark transition-colors">
            Start Your Beanie Order
          </Link>
        </div>
      </section>
    </div>
  );
}
