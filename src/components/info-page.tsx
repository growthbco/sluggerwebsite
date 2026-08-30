import Link from "next/link";
import Image from "next/image";
import { byCategory, primaryImage, type Category } from "@/lib/catalog";

export type Offering = { t: string; d: string };
export type Step = { n: number; t: string; d: string };
export type Faq = { q: string; a: string };

export type InfoPageProps = {
  eyebrow: string;
  h1: string;
  intro: React.ReactNode;
  heroImages?: { src: string; alt: string; label: string }[];
  heroHighlights?: string[];
  primaryCta?: { href: string; label: string };
  secondaryCta?: { href: string; label: string };
  offeringsTitle: string;
  offeringsBlurb?: string;
  offerings: Offering[];
  exampleCategory?: Category;
  exampleTitle?: string;
  exampleAltSuffix?: string;
  // Manual example images (used when there are no catalog products yet).
  manualExamples?: { src: string; alt: string }[];
  // "contain" (default) frames product cutouts on white; "cover" fills the
  // tile edge-to-edge (for full-photo examples like the grass hype-chain shots).
  exampleFit?: "contain" | "cover";
  steps?: Step[];
  // Optional deeper content section (plain prose paragraphs) for SEO depth.
  bodyTitle?: string;
  body?: React.ReactNode;
  // Optional FAQ - rendered as a section AND emitted as FAQPage schema.
  faq?: Faq[];
  localTitle: string;
  localBody: React.ReactNode;
  jsonLd: object;
};

const DEFAULT_STEPS: Step[] = [
  { n: 1, t: "Send your idea", d: "Share your logo, colors, or concept - our in-house team designs it for free." },
  { n: 2, t: "Approve a proof", d: "We send a free proof so you see exactly how it'll look before we produce anything." },
  { n: 3, t: "We make & ship", d: "Standard production is three weeks after approval, final roster, and deposit. Confirmed rush targets two weeks; shipping time is additional." },
];

export function InfoPage(props: InfoPageProps) {
  const steps = props.steps ?? DEFAULT_STEPS;
  const hasHeroImages = Boolean(props.heroImages?.length);
  const primaryCta = props.primaryCta ?? { href: "/team-order", label: "Start an Order" };
  const secondaryCta = props.secondaryCta ?? { href: "/contact", label: "Get a Quote" };
  const catalogExamples = props.exampleCategory ? byCategory(props.exampleCategory).slice(0, 4) : [];
  const examples =
    catalogExamples.length > 0
      ? catalogExamples.map((p) => ({ href: `/product/${p.slug}`, src: primaryImage(p), alt: `${p.name}${props.exampleAltSuffix ?? ""}` }))
      : (props.manualExamples ?? []).map((m) => ({ href: undefined as string | undefined, src: m.src, alt: m.alt }));

  const faqLd =
    props.faq && props.faq.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: props.faq.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }
      : null;

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(props.jsonLd) }} />
      {faqLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />}

      <section className={`mx-auto px-4 sm:px-6 py-14 sm:py-16 ${hasHeroImages ? "max-w-7xl grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]" : "max-w-4xl text-center"}`}>
        <div>
          <span className="display text-brand text-sm">{props.eyebrow}</span>
          <h1 className={`display text-4xl text-foreground mt-2 ${hasHeroImages ? "sm:text-5xl" : "sm:text-6xl"}`}>{props.h1}</h1>
          <p className={`mt-5 text-lg text-muted ${hasHeroImages ? "max-w-2xl" : "max-w-2xl mx-auto"}`}>{props.intro}</p>
          {props.heroHighlights && props.heroHighlights.length > 0 && (
            <div className="mt-5 grid gap-2 text-sm text-foreground sm:grid-cols-2">
              {props.heroHighlights.map((highlight) => (
                <p key={highlight} className="border-l-2 border-brand pl-3">{highlight}</p>
              ))}
            </div>
          )}
          <div className={`mt-7 flex flex-wrap gap-3 ${hasHeroImages ? "justify-start" : "justify-center"}`}>
            <Link href={primaryCta.href} className="clip-slant bg-brand text-on-brand display text-lg px-8 py-4 hover:bg-brand-dark transition-colors">
              {primaryCta.label}
            </Link>
            <Link href={secondaryCta.href} className="clip-slant border border-line text-foreground display text-lg px-8 py-4 hover:bg-foreground/5 transition-colors">
              {secondaryCta.label}
            </Link>
          </div>
        </div>

        {hasHeroImages && (
          <div className="grid w-full max-w-[460px] grid-cols-2 gap-2 justify-self-center lg:justify-self-end">
            {props.heroImages!.map((image, index) => (
              <div key={image.src} className="group overflow-hidden border border-line bg-[#f4f1e9]">
                <div className="relative aspect-square">
                  <Image
                    src={image.src}
                    alt={image.alt}
                    fill
                    preload={index === 0}
                    sizes="(max-width: 640px) 50vw, 220px"
                    className="object-contain p-2 transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                </div>
                <p className="border-t border-line bg-ink px-3 py-2 display text-xs text-foreground">{image.label}</p>
              </div>
            ))}
          </div>
        )}
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
              const cover = props.exampleFit === "cover";
              const inner = (
                <div className={`relative ${cover ? "aspect-[3/4]" : "aspect-square"}`}>
                  <Image src={ex.src} alt={ex.alt} fill sizes="25vw" className={`${cover ? "object-contain" : "object-contain p-2"} transition-transform group-hover:scale-105`} unoptimized />
                </div>
              );
              // "cover" tiles hold full-photo examples (no white cutout box); a
              // dark tile lets the whole chain show without cropping.
              const cls = cover ? "bg-ink border border-line group overflow-hidden" : "bg-white p-3 border border-line group";
              return ex.href ? (
                <Link key={i} href={ex.href} className={cls}>{inner}</Link>
              ) : (
                <div key={i} className={cls}>{inner}</div>
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

      {props.body && (
        <section className="mx-auto max-w-3xl px-4 sm:px-6 py-16">
          {props.bodyTitle && <h2 className="display text-3xl sm:text-4xl text-foreground">{props.bodyTitle}</h2>}
          <div className="mt-6 space-y-4 text-muted leading-relaxed">{props.body}</div>
        </section>
      )}

      {props.faq && props.faq.length > 0 && (
        <section className="bg-steel border-y border-line">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 py-16">
            <h2 className="display text-3xl sm:text-4xl text-foreground text-center">Frequently Asked Questions</h2>
            <div className="mt-8 divide-y divide-line">
              {props.faq.map((f) => (
                <div key={f.q} className="py-5">
                  <h3 className="display text-lg text-foreground">{f.q}</h3>
                  <p className="mt-2 text-muted">{f.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-4xl px-4 sm:px-6 py-16 text-center">
        <h2 className="display text-3xl sm:text-4xl text-foreground">{props.localTitle}</h2>
        <p className="mt-4 text-muted max-w-2xl mx-auto">{props.localBody}</p>
        <p className="mt-6 text-muted">
          Call <a href="tel:+13524147270" className="text-brand hover:underline">352-414-7270</a> or
          email <a href="mailto:apparel@sluggerathletics.com" className="text-brand hover:underline">apparel@sluggerathletics.com</a>
        </p>
        <Link href="/team-order" className="inline-block mt-8 clip-slant bg-brand text-on-brand display text-lg px-8 py-4 hover:bg-brand-dark transition-colors">
          Start Your Order
        </Link>
      </section>
    </div>
  );
}
