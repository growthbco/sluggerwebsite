import Link from "next/link";
import Image from "next/image";
import { categories } from "@/lib/sample-data";
import { SystemSection, Reviews, AboutBand, FaqTeaser } from "@/components/home-extras";
import { RecentDesigns } from "@/components/recent-designs";

export const metadata = {
  description:
    "Custom team uniforms and jerseys for every sport - baseball, softball, flag football, football, basketball and more - plus embroidered hats, made in Ocala FL. Design any uniform with a free AI mockup in minutes. Three-week standard production, ships nationwide.",
  alternates: { canonical: "/" },
};

// ISR: the Recent Designs strip pulls approved mockups from the DB. Re-render
// at most every 10 min so newly approved designs surface without going fully
// dynamic on every request.
export const revalidate = 600;

const HERO_SPORTS = [
  { href: "/custom-baseball-uniforms", label: "Baseball", image: "/sports/generated/baseball-sa-catalog.png" },
  { href: "/custom-basketball-uniforms", label: "Basketball", image: "/sports/generated/basketball-sa-catalog.png" },
  { href: "/custom-cheer-uniforms", label: "Cheer", image: "/sports/generated/cheer-sa-catalog.png" },
  { href: "/custom-volleyball-uniforms", label: "Volleyball", image: "/sports/generated/volleyball-sa-catalog.png" },
];

export default function Home() {
  return (
    <>
      {/* ---------------------------------------------------------------- */}
      {/* Hero                                                             */}
      {/* ---------------------------------------------------------------- */}
      <section className="relative bg-ink overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-60" />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background:
              "radial-gradient(ellipse at 70% 30%, rgba(184,163,108,0.40), transparent 55%)",
          }}
        />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.08fr_0.92fr] lg:py-24">
          <div className="max-w-3xl">
            <span className="inline-block clip-slant bg-brand text-on-brand display text-xs px-3 py-1">
              Free Custom Designs · All Sports
            </span>
            <h1 aria-label="Custom Team Gear That Hits" className="display mt-5 text-5xl sm:text-7xl lg:text-8xl text-foreground">
              Custom Team<br />
              <span className="text-brand">Gear</span> That Hits
            </h1>
            <p className="mt-6 text-lg text-muted max-w-xl">
              Uniforms for every sport,{" "}
              <Link href="/custom-hats" className="text-foreground underline underline-offset-4 decoration-brand hover:text-brand transition-colors">
                custom embroidered hats
              </Link>
              , and 3D hype chains. <span className="text-foreground font-semibold">Free designs, no obligation</span> -
              three-week standard production, with a confirmed two-week rush option. Shipping time is additional.
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
                  Free design, no commitment - see your team&apos;s mockup on us.
                </p>
              </Link>
              <Link
                href="/team-order"
                className="group bg-ink/60 border border-brand/70 hover:bg-brand/10 text-foreground p-5 transition-colors"
              >
                <span className="display text-[11px] tracking-wider text-brand">APPROVED ARTWORK READY?</span>
                <p className="display text-xl sm:text-2xl mt-1">Build Your Roster →</p>
                <p className="text-sm text-muted mt-1">Confirm your products, material, sizes, and total.</p>
              </Link>
            </div>
            <p className="mt-4 text-sm">
              <Link href="/gallery" className="text-muted hover:text-foreground underline underline-offset-4">
                See our recent work →
              </Link>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3" aria-label="Custom uniform examples by sport">
            {HERO_SPORTS.map((sport, index) => (
              <Link
                key={sport.href}
                href={sport.href}
                className="group relative aspect-square overflow-hidden border border-brand/35 bg-[#f4f1e9] shadow-2xl shadow-black/20"
              >
                <Image
                  src={sport.image}
                  alt={`Custom black and gold ${sport.label.toLowerCase()} uniform by Slugger Athletics`}
                  fill
                  preload={index === 0}
                  sizes="(max-width: 1024px) 50vw, 22vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
                <span className="absolute bottom-2 left-2 bg-ink/90 px-2.5 py-1 display text-[10px] text-foreground sm:text-xs">
                  {sport.label} →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section aria-label="Ordering highlights" className="bg-brand py-3">
        <div className="mx-auto flex max-w-7xl flex-wrap justify-center gap-x-6 gap-y-2 px-4 text-center text-on-brand display text-xs sm:text-sm">
          {["Free design", "3-week standard production", "$100 confirmed 2-week rush", "Live order portal"].map((item) => (
            <span key={item} className="inline-flex items-center gap-2 whitespace-nowrap">
              <span className="opacity-50" aria-hidden="true">◆</span> {item}
            </span>
          ))}
        </div>
      </section>

      {/* Auto-updating showcase of recently approved mockups - up high as
          social proof, right after the hero + trust strip */}
      <RecentDesigns />

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

      {/* Reviews / company proof / FAQ */}
      <Reviews />
      <AboutBand />
      <FaqTeaser />

    </>
  );
}
