import Link from "next/link";
import Image from "next/image";
import { categories } from "@/lib/sample-data";
import { SPORT_PAGES } from "@/lib/sport-pages";
import { heroPhoto } from "@/lib/gallery";
import { ElevateSection, SystemSection, Reviews, SocialGrid, AboutBand, FaqTeaser } from "@/components/home-extras";
import { DESIGN_FEE_WAIVED } from "@/lib/design-fee";

export const metadata = {
  description:
    "Custom team uniforms for every sport, embroidered hats made in-house in Ocala FL, and free team stores. Free design mockups, 2-3 week turnaround, 1-week rush.",
  alternates: { canonical: "/" },
};

export default function Home() {
  return (
    <>
      {/* ---------------------------------------------------------------- */}
      {/* Hero                                                             */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative bg-ink overflow-hidden">
        {heroPhoto && (
          <>
            <Image
              src={heroPhoto}
              alt="Slugger Athletics team"
              fill
              priority
              sizes="100vw"
              className="object-cover object-[center_25%]"
              unoptimized
            />
            {/* Dark on the left so the headline stays readable, fading to reveal
                the team photo on the right (matches the current site banner). */}
            <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/80 to-ink/25" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-transparent" />
          </>
        )}
        <div className="absolute inset-0 bg-grid opacity-60" />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background:
              "radial-gradient(ellipse at 70% 30%, rgba(184,163,108,0.40), transparent 55%)",
          }}
        />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 py-20 sm:py-28">
          <div className="max-w-3xl">
            <span className="inline-block clip-slant bg-brand text-on-brand display text-xs px-3 py-1">
              Free Custom Designs · All Sports
            </span>
            <h1 className="display mt-5 text-5xl sm:text-7xl lg:text-8xl text-foreground">
              Custom Team<br />
              <span className="text-brand">Gear</span> That Hits
            </h1>
            <p className="mt-6 text-lg text-muted max-w-xl">
              Uniforms for every sport,{" "}
              <Link href="/custom-hats" className="text-foreground underline underline-offset-4 decoration-brand hover:text-brand transition-colors">
                custom embroidered hats
              </Link>
              , and 3D hype chains. <span className="text-foreground font-semibold">Free designs, no obligation</span> -
              ready in 2-3 weeks, or as fast as one week with rush.
            </p>
            {/* Two clearly distinct entry points - most customers fit one of
                these two buckets, and we never want them guessing which to
                click. */}
            <div className="mt-9 grid sm:grid-cols-2 gap-3 max-w-2xl">
              <Link
                href="/design"
                className="group bg-brand hover:bg-brand-dark text-on-brand p-5 transition-colors"
              >
                <span className="display text-[11px] tracking-wider opacity-80">NEW CUSTOMER</span>
                <p className="display text-xl sm:text-2xl mt-1">Get a Free Design →</p>
                <p className="text-sm opacity-90 mt-1">
                  {DESIGN_FEE_WAIVED
                    ? "No design fee right now - free to start, no commitment."
                    : "$35 to start, credited 100% to your final order."}
                </p>
              </Link>
              <Link
                href="/team-order"
                className="group bg-ink/60 border border-brand/70 hover:bg-brand/10 text-foreground p-5 transition-colors"
              >
                <span className="display text-[11px] tracking-wider text-brand">HAVE YOUR DESIGN?</span>
                <p className="display text-xl sm:text-2xl mt-1">Start a Team Order →</p>
                <p className="text-sm text-muted mt-1">Skip ahead and submit your roster.</p>
              </Link>
            </div>
            <p className="mt-4 text-sm">
              <Link href="/custom-jersey-maker" className="text-brand hover:underline underline-offset-4 display">
                ⚡ NEW: Design your jersey with AI - see it in seconds →
              </Link>
              <span className="mx-2 text-muted">·</span>
              <Link href="/gallery" className="text-muted hover:text-foreground underline underline-offset-4">
                See our recent work →
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* Trust strip - infinite horizontal marquee */}
      <section className="bg-brand overflow-hidden py-3">
        <div className="flex w-max animate-marquee text-on-brand display text-sm">
          {/* Two identical halves so the -50% slide loops seamlessly. Each half
              repeats the items enough to span wide screens. */}
          {[0, 1].map((half) => (
            <div key={half} className="flex shrink-0" aria-hidden={half === 1}>
              {Array.from({ length: 3 }).flatMap(() =>
                ["Fast Shipping", "Embroidered Hats", "Team Stores", "Easy Ordering", "A+ Service"],
              ).map((t, i) => (
                <span key={`${half}-${i}`} className="flex items-center gap-2 px-6 whitespace-nowrap">
                  <span className="opacity-50">◆</span> {t}
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* Elevate Your Game - feature section */}
      <ElevateSection />

      {/* The automated ordering system - the "why us" pitch for new customers */}
      <SystemSection />

      {/* ---------------------------------------------------------------- */}
      {/* Categories                                                       */}
      {/* ---------------------------------------------------------------- */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 pb-16 sm:pb-20">
        <h2 className="display text-3xl sm:text-4xl text-foreground">What We Make</h2>
        <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {categories.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="group relative aspect-[4/5] overflow-hidden bg-steel border border-line"
            >
              <Image
                src={c.image}
                alt={c.label}
                fill
                sizes="(max-width: 1024px) 50vw, 25vw"
                className="object-cover opacity-80 transition-all duration-300 group-hover:opacity-95 group-hover:scale-105"
                unoptimized
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 p-5">
                <h3 className="display text-xl text-white">{c.label}</h3>
                <span className="text-sm text-brand display">Learn More →</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Every sport                                                      */}
      {/* ---------------------------------------------------------------- */}
      <section className="bg-steel border-y border-line">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-20">
          <div className="flex items-end justify-between gap-4">
            <div>
              <span className="display text-brand text-sm">Multi-Sport</span>
              <h2 className="display text-3xl sm:text-4xl text-foreground">Every Sport, One Shop</h2>
            </div>
            <Link href="/team-uniforms" className="display text-sm text-muted hover:text-foreground">
              All uniforms →
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {SPORT_PAGES.map((p) => (
              <Link key={p.slug} href={`/${p.slug}`} className="group bg-ink border border-line hover:border-brand/60 transition-colors">
                <div className="relative aspect-square bg-white overflow-hidden">
                  <Image src={p.mockup} alt={p.h1} fill sizes="(max-width: 1024px) 50vw, 20vw" className="object-cover transition-transform duration-300 group-hover:scale-105" />
                </div>
                <p className="px-3 py-2.5 display text-sm text-foreground group-hover:text-brand">{p.sport} →</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Reviews / social proof / about / FAQ */}
      <Reviews />
      <SocialGrid />
      <AboutBand />
      <FaqTeaser />

      {/* ---------------------------------------------------------------- */}
      {/* Team order CTA                                                   */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative overflow-hidden bg-ink border-t border-line">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            background:
              "linear-gradient(115deg, rgba(184,163,108,0.45), transparent 45%)",
          }}
        />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 py-20 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <span className="display text-brand text-sm">For Coaches & Teams</span>
            <h2 className="display text-4xl sm:text-5xl text-foreground mt-2">
              Outfit the Whole Team in Minutes
            </h2>
            <p className="mt-5 text-muted max-w-md">
              Send one link, let every player enter their own name, number, and
              size, and we handle the rest. No more chasing texts and
              spreadsheets.
            </p>
            <Link
              href="/team-order"
              className="inline-block mt-8 clip-slant bg-brand hover:bg-brand-dark text-on-brand display text-lg px-8 py-4 transition-colors"
            >
              Start a Team Order
            </Link>
          </div>
          <ol className="space-y-4">
            {[
              "Pick your style, material, and upload your approved design",
              "Share your roster link - players fill in their own details",
              "Review, submit, and we send it straight to production",
            ].map((step, i) => (
              <li key={i} className="flex gap-4 bg-steel border border-line p-5">
                <span className="display text-3xl text-brand leading-none">
                  {i + 1}
                </span>
                <span className="text-foreground/85 self-center">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
