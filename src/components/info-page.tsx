import Link from "next/link";
import Image from "next/image";
import { byCategory, primaryImage, type Category } from "@/lib/catalog";

export type Offering = { t: string; d: string };
export type Step = { n: number; t: string; d: string };

export type InfoPageProps = {
  eyebrow: string;
  h1: string;
  intro: React.ReactNode;
  offeringsTitle: string;
  offeringsBlurb?: string;
  offerings: Offering[];
  exampleCategory?: Category;
  exampleTitle?: string;
  exampleAltSuffix?: string;
  // Manual example images (used when there are no catalog products yet).
  manualExamples?: { src: string; alt: string }[];
  steps?: Step[];
  localTitle: string;
  localBody: React.ReactNode;
  jsonLd: object;
};

const DEFAULT_STEPS: Step[] = [
  { n: 1, t: "Send your idea", d: "Share your logo, colors, or concept - our in-house team designs it for free." },
  { n: 2, t: "Approve a proof", d: "We send a free proof so you see exactly how it'll look before we produce anything." },
  { n: 3, t: "We make & ship", d: "Your gear is produced and shipped fast - typically in 2-3 weeks, or one week with rush." },
];

export function InfoPage(props: InfoPageProps) {
  const steps = props.steps ?? DEFAULT_STEPS;
  const catalogExamples = props.exampleCategory ? byCategory(props.exampleCategory).slice(0, 4) : [];
  const examples =
    catalogExamples.length > 0
      ? catalogExamples.map((p) => ({ href: `/product/${p.slug}`, src: primaryImage(p), alt: `${p.name}${props.exampleAltSuffix ?? ""}` }))
      : (props.manualExamples ?? []).map((m) => ({ href: undefined as string | undefined, src: m.src, alt: m.alt }));

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(props.jsonLd) }} />

      <section className="mx-auto max-w-4xl px-4 sm:px-6 py-16 text-center">
        <span className="display text-brand text-sm">{props.eyebrow}</span>
        <h1 className="display text-4xl sm:text-6xl text-foreground mt-2">{props.h1}</h1>
        <p className="mt-5 text-lg text-muted max-w-2xl mx-auto">{props.intro}</p>
        <div className="mt-8 flex flex-wrap gap-4 justify-center">
          <Link href="/team-order" className="clip-slant bg-brand text-on-brand display text-lg px-8 py-4 hover:bg-brand-dark transition-colors">
            Start an Order
          </Link>
          <Link href="/contact" className="clip-slant border border-line text-foreground display text-lg px-8 py-4 hover:bg-foreground/5 transition-colors">
            Get a Quote
          </Link>
        </div>
      </section>

      <section className="bg-steel border-y border-line">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-16">
          <h2 className="display text-3xl sm:text-4xl text-foreground">{props.offeringsTitle}</h2>
          {props.offeringsBlurb && <p className="mt-3 text-muted max-w-2xl">{props.offeringsBlurb}</p>}
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {props.offerings.map((o) => (
              <div key={o.t} className="bg-ink border border-line p-6">
                <h3 className="display text-lg text-foreground">{o.t}</h3>
                <p className="mt-2 text-sm text-muted">{o.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {examples.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 py-16">
          <h2 className="display text-3xl sm:text-4xl text-foreground">{props.exampleTitle ?? "Recent Work"}</h2>
          <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
            {examples.map((ex, i) => {
              const inner = (
                <div className="relative aspect-square">
                  <Image src={ex.src} alt={ex.alt} fill sizes="25vw" className="object-contain p-2 transition-transform group-hover:scale-105" unoptimized />
                </div>
              );
              return ex.href ? (
                <Link key={i} href={ex.href} className="bg-white p-3 border border-line group">{inner}</Link>
              ) : (
                <div key={i} className="bg-white p-3 border border-line group">{inner}</div>
              );
            })}
          </div>
        </section>
      )}

      <section className="bg-steel border-y border-line">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-16">
          <h2 className="display text-3xl sm:text-4xl text-foreground text-center">How It Works</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n} className="text-center">
                <div className="mx-auto h-12 w-12 grid place-items-center clip-slant bg-brand text-on-brand display text-xl">{s.n}</div>
                <h3 className="display text-lg text-foreground mt-4">{s.t}</h3>
                <p className="mt-2 text-sm text-muted">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 sm:px-6 py-16 text-center">
        <h2 className="display text-3xl sm:text-4xl text-foreground">{props.localTitle}</h2>
        <p className="mt-4 text-muted max-w-2xl mx-auto">{props.localBody}</p>
        <p className="mt-6 text-muted">
          Call <a href="tel:+13526601232" className="text-brand hover:underline">352-660-1232</a> or
          email <a href="mailto:apparel@sluggerathletics.com" className="text-brand hover:underline">apparel@sluggerathletics.com</a>
        </p>
        <Link href="/team-order" className="inline-block mt-8 clip-slant bg-brand text-on-brand display text-lg px-8 py-4 hover:bg-brand-dark transition-colors">
          Start Your Order
        </Link>
      </section>
    </div>
  );
}
