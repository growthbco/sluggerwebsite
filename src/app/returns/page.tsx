import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Returns & Exchanges - Custom Gear Policy",
  description:
    "Slugger Athletics returns and exchanges policy for custom and personalized team gear, plus how we handle defects, sizing, and errors.",
};

const SECTIONS = [
  {
    h: "Custom & personalized items",
    body: [
      "Because nearly everything we make is custom - built to your design, colors, names, and numbers - those items can't be returned or exchanged for buyer's remorse or a sizing change.",
      "That's exactly why we send a free design proof to approve before production and let each player pick their own size on team orders. Approving your proof is your chance to catch anything before we make it.",
    ],
  },
  {
    h: "Defects & our mistakes",
    body: [
      "If your order arrives with a manufacturing defect, or it doesn't match the proof you approved, that's on us - we'll remake or refund it, no charge.",
      "Just reach out within 14 days of delivery with a photo of the issue and your order reference, and we'll make it right.",
    ],
  },
  {
    h: "Sizing",
    body: [
      "Our jerseys have a relaxed fit and run slightly large - check the size guide before you order, and when in doubt, size down or ask us.",
      "Since custom items can't be exchanged for fit, the size guide and proof step are the best way to get it right the first time.",
    ],
  },
  {
    h: "Stock (non-custom) items",
    body: [
      "Unworn stock items with no personalization can be returned within 14 days of delivery for a refund, minus return shipping. Contact us first for a return authorization.",
    ],
  },
];

export default function ReturnsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-14">
      <header className="max-w-2xl">
        <span className="display text-brand text-sm">Returns</span>
        <h1 className="display text-4xl sm:text-5xl text-foreground mt-1">Returns &amp; Exchanges</h1>
        <p className="mt-3 text-muted">
          Custom gear is made just for you - so here&apos;s exactly what can be returned, and how
          we handle anything that isn&apos;t right.
        </p>
      </header>

      <div className="mt-12 space-y-10">
        {SECTIONS.map((s) => (
          <section key={s.h}>
            <h2 className="display text-2xl text-foreground">{s.h}</h2>
            <div className="mt-3 space-y-3 text-muted">
              {s.body.map((p, i) => <p key={i}>{p}</p>)}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-12 bg-steel border border-line p-6 text-center">
        <h2 className="display text-xl text-foreground">Something not right with your order?</h2>
        <p className="mt-2 text-muted text-sm">
          Send us a photo and your order reference and we&apos;ll sort it out fast. Email{" "}
          <a href="mailto:apparel@sluggerathletics.com" className="text-brand hover:underline">apparel@sluggerathletics.com</a> or call{" "}
          <a href="tel:+13526601232" className="text-brand hover:underline">352-660-1232</a>.
        </p>
        <Link href="/contact" className="inline-block mt-5 clip-slant bg-brand text-on-brand display px-6 py-3 hover:bg-brand-dark transition-colors">
          Contact Us
        </Link>
      </div>
    </div>
  );
}
