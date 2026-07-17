import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Team Stores - Custom Online Store for Your Team",
  description:
    "Set up a branded online team store with Slugger Athletics. Players and fans order custom gear directly. Great for teams, leagues, schools, and fundraisers in Ocala and Central Florida.",
  keywords: ["team stores", "online team store", "spirit wear store", "booster club fundraiser store"],
  alternates: { canonical: "/team-stores" },
};

const PERKS = [
  { t: "Your Own Branded Store", d: "A dedicated store page with your team's logo, colors, and gear - ready to share with players and fans." },
  { t: "No Upfront Inventory", d: "Players and parents order directly. No bulk buying, no leftover stock, no chasing payments." },
  { t: "Great for Fundraising", d: "Add a margin to each item and the store doubles as a fundraiser for your team or program." },
  { t: "Open When You Need It", d: "Run a timed store window for a season, or keep it open for ongoing reorders and new members." },
];

export default function TeamStoresPage() {
  return (
    <div>
      <section className="mx-auto max-w-4xl px-4 sm:px-6 py-16 text-center">
        <span className="display text-brand text-sm">For Teams, Leagues &amp; Schools</span>
        <h1 className="display text-4xl sm:text-6xl text-foreground mt-2">Team Stores</h1>
        <p className="mt-5 text-lg text-muted max-w-2xl mx-auto">
          Give your players and fans one place to order custom gear. We set up a
          branded online store for your team so everyone orders directly, no bulk
          buying or collecting cash required.
        </p>
        <Link href="/contact" className="inline-block mt-8 clip-slant bg-brand text-on-brand display text-lg px-8 py-4 hover:bg-brand-dark transition-colors">
          Request a Team Store
        </Link>
      </section>

      <section className="bg-steel border-y border-line">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-16">
          <h2 className="display text-3xl sm:text-4xl text-foreground">Why a Team Store?</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PERKS.map((p) => (
              <div key={p.t} className="bg-ink border border-line p-6">
                <h3 className="display text-lg text-foreground">{p.t}</h3>
                <p className="mt-2 text-sm text-muted">{p.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 sm:px-6 py-16 text-center">
        <h2 className="display text-3xl sm:text-4xl text-foreground">Ready to set one up?</h2>
        <p className="mt-4 text-muted max-w-2xl mx-auto">
          Tell us about your team and we&apos;ll build your store. Email{" "}
          <a href="mailto:apparel@sluggerathletics.com" className="text-brand hover:underline">apparel@sluggerathletics.com</a>{" "}
          or call <a href="tel:+13526601232" className="text-brand hover:underline">352-660-1232</a>.
        </p>
        <Link href="/contact" className="inline-block mt-8 clip-slant bg-brand text-on-brand display text-lg px-8 py-4 hover:bg-brand-dark transition-colors">
          Get Started
        </Link>
      </section>
    </div>
  );
}
