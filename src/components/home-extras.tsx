import Link from "next/link";
import Image from "next/image";
import { galleryPhotos, allMedia } from "@/lib/gallery";
import { ReviewWidget } from "@/components/review-widget";

/* "Elevate Your Game" - feature section carried over from the current site. */
const ELEVATE_BENEFITS = [
  { t: "Quick Turnaround Times", d: "Meet tight deadlines with our efficient production and delivery." },
  { t: "Hassle-Free Order Management", d: "A smooth process from design to delivery, with easy reorders and adjustments." },
  { t: "Snug-Fit Necklines", d: "No more loose collars - our necklines stay in place during intense play." },
];

export function ElevateSection() {
  // A clear, uniform-highlighting action shot (not the fence photo).
  const photo =
    allMedia.find((m) => /dscf3242/i.test(m.file))?.file ??
    allMedia.find((m) => /dscf3009/i.test(m.file))?.file ??
    galleryPhotos[0]?.file;

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-20 grid md:grid-cols-2 gap-10 lg:gap-14 items-center">
      {photo && (
        <div className="relative aspect-[4/5] overflow-hidden rounded-lg border border-line">
          <Image src={photo} alt="Slugger Athletics player at bat" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" unoptimized />
        </div>
      )}
      <div>
        <h2 className="display text-4xl sm:text-5xl text-foreground leading-[0.95]">
          Elevate Your Game,<br />Gear Up with <span className="text-brand">Passion</span>
        </h2>
        <p className="mt-5 text-lg text-muted max-w-md">
          We outfit teams with gear that matches their ambition and drive. Our
          uniforms are designed to enhance performance and team identity.
        </p>
        <ul className="mt-8 space-y-5">
          {ELEVATE_BENEFITS.map((b) => (
            <li key={b.t} className="flex gap-4">
              <span className="shrink-0 grid place-items-center h-9 w-9 rounded-full bg-brand text-on-brand text-sm">✓</span>
              <span>
                <span className="display text-foreground">{b.t}</span>
                <span className="block text-muted text-sm mt-0.5">{b.d}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Reviews() {
  return (
    <section className="bg-steel border-y border-line">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-20">
        <div className="text-center max-w-2xl mx-auto">
          <span className="display text-brand text-sm">Don&apos;t Take Our Word For It</span>
          <h2 className="display text-3xl sm:text-4xl text-foreground mt-1">What Teams Are Saying</h2>
        </div>
        <div className="mt-10">
          <ReviewWidget />
        </div>
      </div>
    </section>
  );
}

export function SocialGrid() {
  const photos = galleryPhotos.slice(0, 12);
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-20">
      <div className="flex items-end justify-between gap-4">
        <div>
          <span className="display text-brand text-sm">On The Field</span>
          <h2 className="display text-3xl sm:text-4xl text-foreground mt-1">@sluggerathletics</h2>
        </div>
        <a
          href="https://www.instagram.com/sluggerathletics/"
          target="_blank"
          rel="noopener noreferrer"
          className="display text-sm text-muted hover:text-foreground"
        >
          Follow us →
        </a>
      </div>
      <div className="mt-8 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        {photos.map((m) => (
          <div key={m.id} className="relative aspect-square overflow-hidden bg-steel border border-line group">
            <Image
              src={m.file}
              alt={m.alt || "Slugger Athletics team"}
              fill
              sizes="(max-width: 640px) 33vw, 16vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              unoptimized
            />
          </div>
        ))}
      </div>
    </section>
  );
}

export function AboutBand() {
  const photo = galleryPhotos[1]?.file ?? galleryPhotos[0]?.file;
  return (
    <section className="bg-steel border-y border-line">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-20 grid md:grid-cols-2 gap-10 items-center">
        {photo && (
          <div className="relative aspect-[4/3] overflow-hidden border border-line order-last md:order-first">
            <Image src={photo} alt="Slugger Athletics gear in action" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" unoptimized />
          </div>
        )}
        <div>
          <span className="display text-brand text-sm">Quality From Experience</span>
          <h2 className="display text-3xl sm:text-4xl text-foreground mt-2">More Than a Uniform Supplier</h2>
          <p className="mt-5 text-muted">
            We&apos;re your team&apos;s partner in performance. Every set is designed
            in-house, field-tested, and built to survive the season - not one wash.
            From buy-in drops to full team stores, we make standing out easy.
          </p>
          <ul className="mt-6 space-y-2 text-foreground/90">
            {["Field-tested, durable fabrics", "Free in-house design proofs", "Flexible delivery - 2-3 weeks or 1-week rush", "Real people, real customer support"].map((b) => (
              <li key={b} className="flex gap-2"><span className="text-brand">✓</span> {b}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

const FAQS = [
  { q: "How do I place a team order?", a: "Head to Team Order, pick your jersey style, then either enter your roster yourself or share a link so each player adds their own name, number, and size. We email your total and a free design proof to approve before production." },
  { q: "Is there a minimum order?", a: "Team orders are built for groups, but reach out for small runs - we'll work with you. Individual buy-in drops have no minimum; you just buy your size." },
  { q: "How long does production take?", a: "Most orders ship in 2-3 weeks after you approve your design. Need it sooner? Rush gets you there in about a week (specialty items may add a few days)." },
  { q: "How does sizing work?", a: "Our signature jerseys have a relaxed fit and run slightly large. Each product page has a size guide, and players pick their own size on team orders to cut down on returns." },
  { q: "Do you really design for free?", a: "Yes - our in-house artists create your design at no charge. You only pay once you love the proof." },
];

export function FaqTeaser() {
  return (
    <section className="mx-auto max-w-3xl px-4 sm:px-6 py-16 sm:py-20">
      <div className="text-center">
        <span className="display text-brand text-sm">Questions?</span>
        <h2 className="display text-3xl sm:text-4xl text-foreground mt-1">Frequently Asked</h2>
      </div>
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
      <div className="text-center mt-8">
        <Link href="/contact" className="display text-sm text-muted hover:text-foreground">Still have a question? Contact us →</Link>
      </div>
    </section>
  );
}
