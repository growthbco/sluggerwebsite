import type { Metadata } from "next";
import Link from "next/link";
import { DesignLab } from "@/components/design-lab";

const FAQS = [
  { q: "Is the custom jersey maker free?", a: "Yes - generating and previewing concepts is completely free to try, with no obligation. You only pay when you place a real order, and if a design fee applies it's credited toward that order, so the design is effectively free with your purchase." },
  { q: "How accurate is the AI mockup?", a: "The mockup is a concept to spark ideas and show your colors and layout front and back. Once you like a direction, our in-house designer redraws it into a clean, production-ready proof. What you approve on that proof is exactly what we produce." },
  { q: "What happens after I generate a design?", a: "Save or share your concept, then start a free design request. A real Slugger Athletics designer refines it, sends you a proof to approve (revisions included), and only then do we go to production." },
  { q: "Do I have to place an order to use it?", a: "No. Try as many concepts as you want - it's free and there's no commitment. Reach out whenever you're ready to turn a concept into real uniforms." },
  { q: "What sports and jersey styles can I design?", a: "Any sport - baseball, softball, basketball, soccer, flag football, volleyball, and more - in crew neck, two-button, full-button, and quarter-zip styles. Jerseys start at $28 with names, numbers, and unlimited colors included." },
  { q: "Can I upload my own logo or sketch?", a: "Yes. Drop in a logo file or even a hand-drawn sketch and the tool works it into the concept. Our designer then cleans it up for print." },
];

const HOW_IT_WORKS = [
  { n: 1, t: "Describe your uniform", d: "Pick your sport and colors, describe the look, and drop in a logo or sketch if you have one." },
  { n: 2, t: "See a concept in seconds", d: "The AI generates a front-and-back mockup in your exact colors so you can explore ideas instantly." },
  { n: 3, t: "A real designer makes it real", d: "Like a direction? Start a free design request and our in-house designer turns it into a production-ready proof to approve." },
];

export const metadata: Metadata = {
  title: "Custom Jersey Maker - Design Your Own Jersey Free",
  description:
    "Free custom jersey maker: pick your sport and colors, describe your idea, upload a logo or sketch, and see your custom jersey - front and back - in seconds. Our real designer then makes it production-ready.",
  alternates: { canonical: "/custom-jersey-maker" },
  openGraph: {
    title: "Custom Jersey Maker - Design Your Own Jersey Free",
    description:
      "Pick your sport and colors, describe your idea, and see your custom jersey - front and back - in seconds. Our real designer makes it production-ready.",
    url: "/custom-jersey-maker",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Custom Jersey Maker - Design Your Own Jersey Free",
    description: "See your team's custom jersey in seconds - free to try, made real by our designers.",
  },
};

export default async function DesignLabPage({ searchParams }: { searchParams: Promise<{ key?: string; ladder?: string; paid?: string }> }) {
  const { key, ladder, paid } = await searchParams;
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-14">
      <span className="display text-brand text-sm">Free To Try · Front &amp; Back · Made Real By Our Designer</span>
      <h1 className="display text-4xl sm:text-5xl text-foreground mt-1">Custom Jersey Maker</h1>
      <p className="mt-3 text-muted max-w-2xl">
        Describe the uniform, drop in a logo or even a hand-drawn sketch, and see a concept in
        seconds - front and back, in your exact colors.
      </p>
      <div className="mt-10">
        <DesignLab testKey={key} ladder={ladder === "1"} paidJustNow={paid === "1"} />
      </div>

      {/* Explanatory content + FAQ (SEO + AI-answer citability) */}
      <section className="mt-20 border-t border-line pt-14">
        <h2 className="display text-3xl text-foreground">Design your own jersey online, free</h2>
        <p className="mt-3 text-muted max-w-3xl">
          Our custom jersey maker lets you design a team jersey online in seconds - no design
          skills needed. Describe the look, choose your colors, and add a logo or sketch, and
          you&apos;ll see a front-and-back concept instantly. It&apos;s the fastest way to explore ideas
          before a real designer builds your production-ready proof. Try it free, then{" "}
          <Link href="/design" className="text-brand hover:underline">start a free design request</Link>{" "}
          when you&apos;re ready - see <Link href="/pricing" className="text-brand hover:underline">2026 pricing</Link> for
          exact per-item costs.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {HOW_IT_WORKS.map((s) => (
            <div key={s.n}>
              <div className="h-11 w-11 grid place-items-center clip-slant bg-brand text-on-brand display text-lg">{s.n}</div>
              <h3 className="display text-lg text-foreground mt-3">{s.t}</h3>
              <p className="mt-1.5 text-sm text-muted">{s.d}</p>
            </div>
          ))}
        </div>

        <div className="mt-14">
          <h2 className="display text-3xl text-foreground">Custom Jersey Maker FAQ</h2>
          <div className="mt-6 divide-y divide-[color:var(--line)] border-y border-line">
            {FAQS.map((f) => (
              <details key={f.q} className="group py-4">
                <summary className="cursor-pointer list-none flex items-center justify-between gap-3 text-foreground display">
                  {f.q}
                  <span className="text-muted transition-transform group-open:rotate-45">＋</span>
                </summary>
                <p className="mt-2 text-sm text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            {
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
            },
            {
              "@context": "https://schema.org",
              "@type": "Service",
              serviceType: "Custom Jersey Maker",
              provider: { "@id": "https://sluggerathletics.com/#business" },
              areaServed: { "@type": "Country", name: "United States" },
              description: "Free online custom jersey maker - design a team jersey in seconds, then a real designer makes it production-ready.",
            },
          ]),
        }}
      />
    </div>
  );
}
