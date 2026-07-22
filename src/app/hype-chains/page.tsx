import type { Metadata } from "next";
import { InfoPage } from "@/components/info-page";

export const metadata: Metadata = {
  title: "Custom 3D Hype Chains for Sports Teams - Ocala, FL",
  description:
    "Custom 3D hype chains and team accessories from Slugger Athletics in Ocala, FL. Bring the energy to the dugout with personalized team chains, pendants, and gear. Free design, fast turnaround.",
  keywords: [
    "hype chains",
    "custom 3D hype chains",
    "team hype chains",
    "baseball hype chain",
    "softball hype chain",
    "custom sports chains Ocala",
  ],
  alternates: { canonical: "/hype-chains" },
};

export default function HypeChainsPage() {
  return (
    <InfoPage
      eyebrow="3D Hype Chains · Ocala, FL"
      h1="Custom Hype Chains"
      intro={
        <>
          Bring the energy. Slugger Athletics makes <strong className="text-foreground">custom 3D hype chains</strong> and
          team accessories that fire up the dugout and celebrate the big play. Designed
          to match your team&apos;s look - made in Ocala, shipped anywhere.
        </>
      }
      offeringsTitle="Bring the Hype"
      offeringsBlurb="The finishing touch on game day - personalized to your team."
      offerings={[
        { t: "3D Hype Chains", d: "Bold, lightweight 3D-printed chains in your team colors - the ultimate celebration prop." },
        { t: "Custom Pendants", d: "Personalized pendants - mascots, logos, numbers, or whatever fires your team up." },
        { t: "Team Sets", d: "Order in bulk so the whole roster reps the chain after a clutch hit." },
        { t: "Simple Pricing", d: "Free mockup so you see it first. One-time $50 charge for the production 3D file, then each chain starts at $40 depending on detail and colors." },
      ]}
      exampleCategory="chains"
      exampleTitle="Hype Chains & Accessories"
      exampleAltSuffix=" - custom hype chain Ocala FL"
      manualExamples={[
        { src: "/products/chains/big-baller.jpg", alt: "Big Baller custom hype chain - Slugger Athletics Ocala FL" },
      ]}
      localTitle="Hype Chains for Teams in Central Florida"
      localBody={
        <>
          Made in Ocala for teams across Marion County and Central Florida - and shipped
          nationwide. Pair your <strong className="text-foreground">custom hype chains</strong> with a full
          uniform set for a look that turns heads on and off the field.
        </>
      }
      jsonLd={{
        "@context": "https://schema.org",
        "@type": "Service",
        serviceType: "Custom 3D Hype Chains",
        provider: {
          "@type": "LocalBusiness",
          name: "Slugger Athletics",
          email: "apparel@sluggerathletics.com",
          telephone: "+1-352-660-1232",
          areaServed: { "@type": "City", name: "Ocala, Florida" },
        },
        description: "Custom 3D hype chains and team accessories made in Ocala, FL.",
      }}
    />
  );
}
