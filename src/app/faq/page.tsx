import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "FAQ - Ordering, Sizing, Turnaround",
  description:
    "Answers about custom team orders, buy-ins, sizing, turnaround time, and free design proofs at Slugger Athletics.",
};

const FAQS = [
  { q: "How do I place a team order?", a: "Head to Team Order, pick your jersey style, then either enter your roster yourself or share a link so each player adds their own name, number, and size. We email your total and a free design proof to approve before production." },
  { q: "Is there a minimum order?", a: "Team orders are built for groups, but reach out for small runs - we'll work with you. Individual buy-in drops have no minimum; you just buy your size." },
  { q: "How long does production take?", a: "Most orders ship in 2-3 weeks after you approve your design. Need it sooner? Rush gets you there in about a week. Specialty items like hoodies, pants, or long-sleeve jerseys may add a few days." },
  { q: "How does sizing work?", a: "Our signature jerseys have a relaxed fit and run slightly large. Every product page has a size guide, and on team orders each player picks their own size to cut down on returns." },
  { q: "Do you really design for free?", a: "Yes - our in-house artists create your design at no charge. You only pay once you love the proof." },
  { q: "Can I customize name and number?", a: "Absolutely. Jerseys and apparel let you add a player name and number right on the product page, and team orders capture them per player." },
  { q: "What's a Buy-In?", a: "A Buy-In is a limited, themed drop (like our horror or seasonal collections). You buy your size during the open window - once it closes, that drop is done." },
  { q: "How do I set up a team store?", a: "Reach out and we'll set up a branded store for your team so players and fans can order gear directly. Great for fundraisers and ongoing orders." },
];

export default function FaqPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header className="max-w-2xl">
        <span className="display text-brand text-sm">Help &amp; FAQs</span>
        <h1 className="display text-4xl sm:text-5xl text-foreground mt-1">Frequently Asked Questions</h1>
        <p className="mt-3 text-muted">Everything you need to know about ordering custom gear with us.</p>
      </header>

      <div className="mt-10 divide-y divide-[color:var(--line)] border-y border-line">
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

      <div className="mt-10 bg-steel border border-line p-6 text-center">
        <h2 className="display text-xl text-foreground">Still have a question?</h2>
        <p className="mt-2 text-muted text-sm">Email apparel@sluggerathletics.com or call 352-660-1232.</p>
        <Link href="/team-order" className="inline-block mt-5 clip-slant bg-brand text-on-brand display px-6 py-3 hover:bg-brand-dark transition-colors">
          Start a Team Order
        </Link>
      </div>
    </div>
  );
}
