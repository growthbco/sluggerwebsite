import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SeasonalJerseyPricing } from "@/components/seasonal-jersey-pricing";
import { CHRISTMAS_DESIGNS, christmasDesignUrl } from "@/lib/christmas-designs";
import { RUSH_PRICE_COPY } from "@/lib/customer-policy";

const title = "Custom Christmas Jerseys for Teams & Holiday Tournaments";
const description = "Bring holiday spirit to game day with custom Christmas team jerseys. Explore crewneck and long-sleeve examples, see starting prices, and request a free design mockup.";
export const metadata: Metadata = {
  title, description,
  alternates: { canonical: "/christmas-jerseys" },
  openGraph: { title, description, url: "/christmas-jerseys", images: [{ url: "/mockups/sa-christmas-jersey-hero.png", alt: "Christmas team jersey example, front and back" }] },
  twitter: { card: "summary_large_image", title, description, images: ["/mockups/sa-christmas-jersey-hero.png"] },
};

const button = "inline-flex min-h-12 w-full items-center justify-center bg-brand px-5 py-3 text-center display text-on-brand transition-colors hover:bg-brand-dark focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand sm:w-auto";

export default function ChristmasJerseysPage() {
  return (
    <div>
      <section className="border-b border-brand/25 bg-[radial-gradient(ellipse_at_top_right,#244031_0%,#181a10_55%,#101209_90%)]">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-12 sm:px-6 sm:py-20 lg:grid-cols-2">
          <div className="min-w-0">
            <p className="display text-sm tracking-[0.2em] text-brand">HOLIDAY SPIRIT. GAME-DAY ENERGY.</p>
            <h1 className="display mt-5 text-[clamp(2.75rem,12vw,4.5rem)] leading-[0.98] text-foreground">MERRY.<br /><span className="text-brand">BRIGHT.</span><br />READY TO PLAY.</h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted">Custom Christmas jerseys for holiday tournaments, winter leagues, and teams with a festive side.</p>
            <p className="mt-3 max-w-lg text-muted">Ugly-sweater energy. Your team identity. Choose a starting point or bring us an original holiday idea.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={christmasDesignUrl("original")} className={button}>Start My Christmas Design →</Link>
              <a href="#christmas-examples" className="inline-flex min-h-12 w-full items-center justify-center border border-brand/50 px-5 py-3 text-center display text-foreground hover:bg-brand/10 sm:w-auto">View Jersey Examples ↓</a>
            </div>
            <p className="mt-4 text-sm text-brand">Free design to start · No commitment</p>
          </div>
          <figure className="overflow-hidden border border-brand/30 bg-white">
            <div className="relative aspect-square">
              <Image src="/mockups/sa-christmas-jersey-hero.png" alt="Red, green, and black Christmas crewneck example with front artwork and back name and number" fill preload sizes="(max-width: 1024px) 92vw, 600px" className="object-contain" />
            </div>
            <figcaption className="bg-steel px-5 py-4 text-sm text-muted">Example mockup, front and back. Your team details and final artwork are confirmed in your proof.</figcaption>
          </figure>
        </div>
      </section>

      <SeasonalJerseyPricing />

      <section id="christmas-examples" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-14 sm:px-6 sm:py-16">
        <p className="display text-sm tracking-widest text-brand">01 / FIND YOUR HOLIDAY LOOK</p>
        <h2 className="display mt-3 text-4xl text-foreground sm:text-5xl">Festive looks. Made yours.</h2>
        <p className="mt-4 max-w-2xl text-muted">Softball, baseball, kickball, bowling, and more. Choose your sport and preferred style in the Design Center. These examples are inspiration, not a limit on what we can create.</p>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {(["christmas-crewneck", "christmas-long-sleeve"] as const).map((concept) => {
            const design = CHRISTMAS_DESIGNS[concept];
            return (
              <article key={concept} className="flex flex-col overflow-hidden border border-brand/30 bg-steel">
                <a href={design.reference} target="_blank" rel="noopener noreferrer" aria-label={`Enlarge ${design.title} example`} className="relative block aspect-square bg-white">
                  <Image src={design.reference} alt={`${design.title} example, front and back`} fill sizes="(max-width: 768px) 92vw, 600px" className="object-contain p-3" />
                </a>
                <div className="flex flex-1 flex-col items-start border-t border-line p-5 sm:p-6">
                  <p className="display text-xs tracking-widest text-brand">{concept === "christmas-crewneck" ? "SHORT-SLEEVE CREWNECK" : "LONG-SLEEVE OPTION · REQUEST A QUOTE"}</p>
                  <h3 className="display mt-2 text-3xl text-foreground">{design.title}</h3>
                  <p className="mt-3 flex-1 text-muted">{concept === "christmas-crewneck" ? "A festive red, green, and black look with sweater-inspired details. Make it your own with your team identity and player details." : "Bring the holiday look into a long-sleeve design. Tell us your quantity and preferred fit so we can confirm the price with your quote."}</p>
                  <Link href={christmasDesignUrl(concept)} className={`${button} mt-5`}>Start With This Look →</Link>
                </div>
              </article>
            );
          })}
        </div>
        <article className="mt-6 grid items-center gap-6 border border-brand/30 bg-[linear-gradient(120deg,#213b2c,#211817)] p-6 sm:p-8 lg:grid-cols-[1fr_auto]">
          <div><p className="display text-sm tracking-widest text-brand">SOMETHING ORIGINAL</p><h3 className="display mt-3 text-3xl text-foreground">Your mascot. In holiday mode.</h3><p className="mt-3 max-w-2xl text-muted">Snowflakes, candy-cane stripes, festive team mascots, or your own ugly-sweater pattern. Bring us your idea and we&apos;ll create a look for your team.</p></div>
          <Link href={christmasDesignUrl("original")} className={button}>Create Something Original →</Link>
        </article>
      </section>

      <section className="border-y border-line bg-steel">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <p className="display text-sm tracking-widest text-brand">02 / FROM HOLIDAY IDEA TO GAME DAY</p>
          <ol className="mt-7 grid gap-8 md:grid-cols-3">
            {[
              ["01", "Tell us your idea", "Share your sport, team colors, estimated quantity, and event date. Your selected example comes with your request."],
              ["02", "Review your free proof", "Our designer prepares your artwork. Review the details and request changes before approving."],
              ["03", "Complete your team order", "Confirm products, sizes, names and numbers where needed, and your production option in your order portal."],
            ].map(([n, heading, text]) => <li key={n}><span className="display text-4xl text-brand/60">{n}</span><h3 className="display mt-3 text-2xl text-foreground">{heading}</h3><p className="mt-3 leading-relaxed text-muted">{text}</p></li>)}
          </ol>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 sm:py-16 lg:grid-cols-2">
        <div><p className="display text-sm tracking-widest text-brand">03 / PLAN AHEAD FOR THE HOLIDAYS</p><h2 className="display mt-3 text-4xl text-foreground">Give us your event date. Not just Christmas.</h2><p className="mt-4 max-w-lg leading-relaxed text-muted">Production starts after final artwork approval, final order details, and the required payment. Carrier transit follows production. Share the date you actually need your jerseys—we&apos;ll confirm availability before committing. A design request does not guarantee Christmas delivery.</p></div>
        <div className="space-y-4">
          <div className="border border-line bg-steel p-5"><h3 className="display text-xl text-foreground">Standard / 3-week production</h3><p className="mt-2 text-sm text-muted">50% deposit required. Shipping is calculated separately, or choose free Ocala pickup.</p></div>
          <div className="border border-brand/50 bg-brand/5 p-5"><h3 className="display text-xl text-brand">Rush / 2-week production</h3><p className="mt-2 text-sm text-foreground">{RUSH_PRICE_COPY}. Shipping included; no additional shipping charge.</p><p className="mt-2 text-sm text-muted">Full team orders only. Full payment and availability confirmation required. Not available for individual team-store purchases.</p></div>
        </div>
      </section>
      <section className="border-t border-brand/30 bg-brand/10 px-4 py-14 text-center">
        <h2 className="display text-4xl text-foreground sm:text-5xl">Bring the holiday spirit. We&apos;ll bring the design.</h2>
        <p className="mt-4 text-muted">Your next team tradition starts with a free mockup.</p>
        <Link href={christmasDesignUrl("original")} className={`${button} mt-7`}>Start My Christmas Design →</Link>
        <p className="mt-5"><Link href="/halloween-jerseys" className="inline-flex min-h-11 items-center text-sm text-brand underline underline-offset-4">Planning a fall tournament? Explore Halloween jerseys →</Link></p>
      </section>
    </div>
  );
}
