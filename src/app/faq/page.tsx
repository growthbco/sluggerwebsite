import type { Metadata } from "next";
import Link from "next/link";
import { FAQS } from "@/lib/faqs";

export const metadata: Metadata = {
  title: "FAQ - Ordering, Sizing, Turnaround",
  description:
    "Answers about custom team orders, buy-ins, sizing, turnaround time, and free design proofs at Slugger Athletics.",
};


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
            {"link" in f && f.link && (
              <p className="mt-2">
                <Link href={f.link.href} className="text-brand hover:underline text-sm">
                  {f.link.label} →
                </Link>
              </p>
            )}
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
