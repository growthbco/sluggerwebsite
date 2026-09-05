import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { halloweenDesignUrl } from "@/lib/halloween-designs";
import { RUSH_PRICE_COPY } from "@/lib/customer-policy";

const title = "Custom Halloween Jerseys for Teams & Tournaments";
const description = "Bring a Halloween look to your next tournament. Explore custom jersey inspiration, add your team identity, and start a free design with Slugger Athletics.";
export const metadata: Metadata = {
  title, description,
  alternates: { canonical: "/halloween-jerseys" },
  openGraph: { title, description, url: "/halloween-jerseys", images: [{ url: "/media/NeonHalloweenTransparentJerseyFront.png", alt: "Halloween team jersey example" }] },
  twitter: { card: "summary_large_image", title, description, images: ["/media/NeonHalloweenTransparentJerseyFront.png"] },
};

const button = "inline-flex min-h-12 items-center justify-center bg-brand px-6 py-3 display text-on-brand transition-colors hover:bg-brand-dark focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand";

export default function HalloweenJerseysPage() {
  return (
    <div className="overflow-hidden">
      <section className="relative border-b border-brand/25 bg-[radial-gradient(ellipse_at_80%_40%,#50301f_0%,#181a10_45%,#101209_80%)]">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-12 sm:px-6 sm:py-20 lg:grid-cols-2">
          <div className="relative z-10">
            <p className="display text-sm tracking-[0.2em] text-brand">TOURNAMENT SEASON · AFTER DARK</p>
            <h1 className="display mt-5 text-5xl leading-[0.98] text-foreground sm:text-7xl">YOUR TEAM.<br />A <span className="text-brand">FRIGHTENINGLY</span><br />GOOD LOOK.</h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted">Custom Halloween jerseys for tournaments, leagues, and teams that want to show up with a little more spirit.</p>
            <p className="mt-3 max-w-lg text-muted">Your team name. Your colors. Your player details. Start with an example or let us create something original.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={halloweenDesignUrl("original")} className={button}>Start My Halloween Design →</Link>
              <a href="#jersey-examples" className="inline-flex min-h-12 items-center border border-brand/50 px-6 py-3 display text-foreground hover:bg-brand/10">View Jersey Examples ↓</a>
            </div>
            <p className="mt-4 text-sm text-brand">Free design to start · No commitment</p>
          </div>
          <div className="relative mx-auto grid w-full max-w-xl grid-cols-2 items-center gap-1 py-6">
            {["Front", "Back"].map((side, index) => (
              <div key={side} className={index ? "translate-y-5 rotate-6" : "-rotate-6"}>
                <div className="relative aspect-[3/4]">
                  <Image src={`/media/NeonHalloweenTransparentJersey${side}.png`} alt={`Neon Halloween custom jersey — ${side.toLowerCase()} view`} fill preload={index === 0} sizes="(max-width: 1024px) 45vw, 290px" className="object-contain drop-shadow-2xl" />
                </div>
                <p className="mt-3 text-center display text-xs tracking-widest text-brand">{side} / Example design</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="jersey-examples" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-16 sm:px-6">
        <p className="display text-sm tracking-widest text-brand">01 / FIND YOUR LOOK</p>
        <h2 className="display mt-3 text-4xl text-foreground sm:text-5xl">A starting point. Not a limit.</h2>
        <p className="mt-4 max-w-2xl text-muted">Softball, baseball, kickball, bowling, and beyond. Choose your sport in the Design Center, then tell us what makes this team yours.</p>
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <article className="overflow-hidden border border-brand/30 bg-steel">
            <div className="grid grid-cols-2 gap-4 bg-black/30 p-5 sm:p-8">
              {["Front", "Back"].map((side) => (
                <a key={side} href={`/media/NeonHalloweenTransparentJersey${side}.png`} target="_blank" rel="noopener noreferrer" aria-label={`Enlarge Halloween jersey ${side.toLowerCase()}`} className="relative block aspect-[3/4]">
                  <Image src={`/media/NeonHalloweenTransparentJersey${side}.png`} alt={`Neon Halloween example, ${side.toLowerCase()}`} fill sizes="(max-width: 1024px) 44vw, 320px" className="object-contain transition-transform hover:scale-105" />
                </a>
              ))}
            </div>
            <div className="border-t border-line p-6">
              <h3 className="display text-3xl text-foreground">Neon Halloween</h3>
              <p className="mt-3 text-muted">High-contrast color, Halloween details, and room for your team identity. These are example mockups; your final artwork is confirmed in your proof.</p>
              <Link href={halloweenDesignUrl("neon-halloween")} className={`${button} mt-5`}>Start With This Look →</Link>
            </div>
          </article>
          <article className="flex flex-col justify-between border border-brand/30 bg-[radial-gradient(ellipse_at_top_right,#493323,transparent_70%)] p-7 sm:p-10">
            <div>
              <p className="display text-sm tracking-widest text-brand">SOMETHING ONLY YOUR TEAM WOULD WEAR</p>
              <h3 className="display mt-5 text-4xl text-foreground sm:text-5xl">Bring us your<br />wild idea.</h3>
              <p className="mt-5 leading-relaxed text-muted">Classic orange and black. A ghostly team mascot. Pumpkins, skeletons, bats, or an unexpected neon palette. Tell us the theme and we&apos;ll help bring it together.</p>
              <ul className="mt-7 space-y-4 text-sm text-foreground">
                <li className="border-b border-line pb-4">Your sport and preferred jersey style</li>
                <li className="border-b border-line pb-4">Your team colors, name, and logos</li>
                <li>Names and numbers where your team needs them</li>
              </ul>
            </div>
            <Link href={halloweenDesignUrl("original")} className={`${button} mt-10`}>Create Something Original →</Link>
          </article>
        </div>
      </section>

      <section className="border-y border-line bg-steel">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <p className="display text-sm tracking-widest text-brand">02 / FROM IDEA TO GAME DAY</p>
          <ol className="mt-7 grid gap-8 md:grid-cols-3">
            {[
              ["01", "Start your design", "Tell us your sport, estimated quantity, event date, and the look you have in mind."],
              ["02", "Approve your proof", "Review your custom artwork and request changes before you approve it."],
              ["03", "Complete your team order", "Confirm products, sizes, player details where needed, and production speed in your existing order portal."],
            ].map(([n, heading, text]) => <li key={n}><span className="display text-4xl text-brand/60">{n}</span><h3 className="display mt-3 text-2xl text-foreground">{heading}</h3><p className="mt-3 leading-relaxed text-muted">{text}</p></li>)}
          </ol>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-2">
        <div>
          <p className="display text-sm tracking-widest text-brand">03 / PLAN FOR YOUR FIRST GAME</p>
          <h2 className="display mt-3 text-4xl text-foreground">Tell us your tournament date.</h2>
          <p className="mt-4 max-w-lg leading-relaxed text-muted">Production starts after final artwork approval, your final roster, and the required payment. Carrier transit follows production. We&apos;ll review your event date before confirming availability—ordering here does not guarantee Halloween delivery.</p>
          <Link href="/pricing" className="mt-5 inline-flex min-h-11 items-center text-brand underline underline-offset-4">Explore jersey styles and pricing →</Link>
        </div>
        <div className="space-y-4">
          <div className="border border-line bg-steel p-5"><h3 className="display text-xl text-foreground">Standard / 3-week production</h3><p className="mt-2 text-sm text-muted">50% deposit required. Shipping is calculated separately, or choose free Ocala pickup.</p></div>
          <div className="border border-brand/50 bg-brand/5 p-5"><h3 className="display text-xl text-brand">Rush / 2-week production</h3><p className="mt-2 text-sm text-foreground">{RUSH_PRICE_COPY}. Shipping included; no additional shipping charge.</p><p className="mt-2 text-sm text-muted">Full team orders only. Full payment and availability confirmation required. Not available for individual team-store purchases.</p></div>
        </div>
      </section>
      <section className="border-t border-brand/30 bg-brand/10 px-4 py-14 text-center">
        <h2 className="display text-4xl text-foreground sm:text-5xl">Make this your team&apos;s season.</h2>
        <p className="mt-4 text-muted">Start with an idea. We&apos;ll take it to the proof.</p>
        <Link href={halloweenDesignUrl("original")} className={`${button} mt-7`}>Start My Halloween Design →</Link>
      </section>
    </div>
  );
}
