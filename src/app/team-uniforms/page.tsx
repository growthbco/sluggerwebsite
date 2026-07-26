import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { InfoPage } from "@/components/info-page";
import { SPORT_PAGES } from "@/lib/sport-pages";
import { SERVICE_AREAS } from "@/lib/service-areas";

export const metadata: Metadata = {
  title: "Custom Team Uniforms & Jerseys in Ocala, FL",
  description:
    "Custom team uniforms and sublimated jerseys in Ocala, FL. Slugger Athletics designs and produces baseball, softball, basketball, soccer, and flag football uniforms with free design across Central Florida - travel ball teams welcome.",
  keywords: [
    "custom team uniforms Ocala",
    "custom jerseys Ocala FL",
    "sublimated jerseys Florida",
    "softball uniforms Ocala",
    "baseball uniforms Central Florida",
    "travel baseball uniforms",
    "custom sports uniforms",
  ],
  alternates: { canonical: "/team-uniforms" },
};

// Real local teams we outfit - genuine proof, and the team names double as
// local search terms parents actually type.
const LOCAL_TEAMS = [
  {
    name: "Mamba Baseball",
    img: "https://wnbdipjkyfozqxrj.public.blob.vercel-storage.com/design-proofs/mamba-black-sleeves.jpg",
  },
  {
    name: "Triboro Troopers 8U",
    img: "https://wnbdipjkyfozqxrj.public.blob.vercel-storage.com/design-proofs/WhatsApp%20Image%202026-07-17%20at%203.18.29%20AM-HdruBSEPe7bd6M2uwDXaeFaOM36tEp.jpeg",
  },
  {
    name: "Monstars",
    img: "https://wnbdipjkyfozqxrj.public.blob.vercel-storage.com/design-proofs/WhatsApp%20Image%202026-07-23%20at%205.26.59%20PM-OmUPtSTb63A3zDG8ii8U0AkJLzC8li.jpeg",
  },
];

export default function TeamUniformsPage() {
  return (
    <>
      <InfoPage
        eyebrow="Custom Team Uniforms · Ocala, FL"
        h1="Custom Team Uniforms in Ocala"
        intro={
          <>
            Slugger Athletics designs and produces <strong className="text-foreground">custom team uniforms and sublimated jerseys</strong> for
            baseball, softball, and every sport - right here in Ocala and across Central
            Florida. Designed in-house for free, built to perform, and shipped fast.
            Jerseys start at <strong className="text-foreground">$28</strong> with flat 2026 pricing
            (6-piece minimum per design) -{" "}
            <a href="/pricing" className="text-brand hover:underline">see the full price list</a>.
          </>
        }
        offeringsTitle="Full Uniform Programs"
        offeringsBlurb="Outfit your whole roster - jerseys are our specialty, and we round out the kit."
        offerings={[
          { t: "Custom Jerseys", d: "Fully sublimated jerseys in any color, pattern, or theme - crew, two-button, full-button, and quarter-zip styles." },
          { t: "Travel Ball Programs", d: "Home & away travel baseball and softball uniforms with bundles from $90 per player - plus free team stores for parent orders." },
          { t: "Pants, Hats & Extras", d: "Matching pants, in-house embroidered hats, hoodies, and custom socks to complete the kit." },
          { t: "Full Team Sets", d: "Home & away packages with names and numbers - one roster, one order, one look." },
        ]}
        exampleCategory="uniforms"
        exampleTitle="Recent Custom Uniforms"
        exampleAltSuffix=" - custom team uniforms Ocala FL"
        localTitle="Team Uniforms Near You in Central Florida"
        localBody={
          <>
            Based in Ocala, we outfit teams, leagues, schools, and travel ball clubs throughout
            Marion County and Central Florida - including{" "}
            {SERVICE_AREAS.map((a, i) => (
              <span key={a.slug}>
                <Link href={`/custom-uniforms/${a.slug}`} className="text-brand hover:underline">{a.city}</Link>
                {i < SERVICE_AREAS.length - 1 ? ", " : ""}
              </span>
            ))}
            . Searching for <strong className="text-foreground">custom team uniforms in Ocala</strong>? We make
            full team ordering simple with player self-entry rosters. Top off the look with{" "}
            <a href="/custom-hats" className="text-brand hover:underline">custom embroidered hats</a> -
            no minimum on hats, with matching player numbers.
          </>
        }
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Service",
          serviceType: "Custom Team Uniforms & Jerseys",
          provider: {
            "@type": "LocalBusiness",
            name: "Slugger Athletics",
            email: "apparel@sluggerathletics.com",
            telephone: "+1-352-660-1232",
            address: { "@type": "PostalAddress", addressLocality: "Ocala", addressRegion: "FL", addressCountry: "US" },
          },
          areaServed: [
            { "@type": "City", name: "Ocala, Florida" },
            ...SERVICE_AREAS.map((a) => ({ "@type": "City", name: `${a.city}, Florida` })),
          ],
          description: "Custom sublimated team uniforms and jerseys for all sports in Ocala, FL and Central Florida.",
        }}
      />

      {/* Local proof: real teams in real Slugger uniforms. */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-16">
        <h2 className="display text-3xl sm:text-4xl text-foreground">Local Teams We Outfit</h2>
        <p className="mt-2 text-muted max-w-2xl">
          Real Central Florida teams in uniforms we designed and produced - travel ball to rec league.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {LOCAL_TEAMS.map((t) => (
            <figure key={t.name} className="bg-steel border border-line">
              <div className="relative aspect-[4/3] bg-white">
                <Image src={t.img} alt={`${t.name} custom uniforms by Slugger Athletics`} fill sizes="(max-width: 640px) 100vw, 33vw" className="object-contain" unoptimized />
              </div>
              <figcaption className="px-4 py-2.5 display text-sm text-foreground">{t.name}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* Multi-sport hub links */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pb-20">
        <h2 className="display text-3xl sm:text-4xl text-foreground">Every Sport, One Shop</h2>
        <div className="mt-6 grid grid-cols-2 lg:grid-cols-5 gap-3">
          {SPORT_PAGES.map((p) => (
            <Link key={p.slug} href={`/${p.slug}`} className="group bg-steel border border-line hover:border-brand/50 transition-colors">
              <div className="relative aspect-square bg-white">
                <Image src={p.mockup} alt={p.h1} fill sizes="(max-width: 1024px) 50vw, 20vw" className="object-cover" />
              </div>
              <p className="px-3 py-2.5 display text-sm text-foreground group-hover:text-brand">{p.sport} →</p>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
