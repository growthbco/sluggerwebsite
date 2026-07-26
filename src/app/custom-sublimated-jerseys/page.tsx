import type { Metadata } from "next";
import { InfoPage } from "@/components/info-page";

export const metadata: Metadata = {
  title: "Custom Sublimated Jerseys - Any Sport, From $28, Free Design",
  description:
    "Custom sublimated jerseys for any sport from $28 - unlimited colors, names, numbers, and logos dyed into the fabric so they never crack or peel. Free design mockup, made in Ocala FL.",
  alternates: { canonical: "/custom-sublimated-jerseys" },
};

export default function SublimatedJerseysPage() {
  return (
    <InfoPage
      eyebrow="Full Dye Sublimation · Ocala, FL"
      h1="Custom Sublimated Jerseys"
      intro={
        <>
          Sublimation dyes your design <strong className="text-foreground">into the fabric itself</strong> -
          unlimited colors, gradients, logos, names, and numbers with nothing to crack, peel, or fade,
          ever. Custom sublimated jerseys start at <strong className="text-foreground">$28</strong> with
          the design work included and a free mockup before production. 6-piece minimum per design.
        </>
      }
      offeringsTitle="Why Sublimation Wins"
      offeringsBlurb="Screen printing puts ink on top of the fabric. Sublimation makes the fabric the design."
      offerings={[
        { t: "Unlimited Colors, One Price", d: "Gradients, patterns, camo, pinstripes, sponsor logos - complexity costs nothing extra with full-dye sublimation." },
        { t: "Never Cracks or Peels", d: "The design is part of the polyester fiber - wash it all season, it looks like day one." },
        { t: "Every Style & Sport", d: "Crew from $28, two-button $32, full-button $35, quarter-zip $38 - baseball, softball, basketball, soccer, and beyond." },
        { t: "Names & Numbers Included", d: "Per-player personalization is baked into the price, entered by each player through your team's roster link." },
      ]}
      exampleCategory="uniforms"
      exampleTitle="Recent Sublimated Work"
      exampleAltSuffix=" - custom sublimated jerseys Ocala FL"
      localTitle="Sublimated Jerseys, Local Service"
      localBody={
        <>
          Designed in-house in Ocala with free mockups and revisions, produced with premium full-dye
          sublimation, and delivered across Central Florida or shipped nationwide. See{" "}
          <a href="/pricing" className="text-brand hover:underline">2026 pricing</a> or start a{" "}
          <a href="/design" className="text-brand hover:underline">free design</a>.
        </>
      }
      jsonLd={{
        "@context": "https://schema.org",
        "@type": "Service",
        serviceType: "Custom Sublimated Jerseys",
        provider: {
          "@type": "LocalBusiness",
          name: "Slugger Athletics",
          email: "apparel@sluggerathletics.com",
          telephone: "+1-352-660-1232",
          address: { "@type": "PostalAddress", addressLocality: "Ocala", addressRegion: "FL", addressCountry: "US" },
        },
        areaServed: [{ "@type": "City", name: "Ocala, Florida" }, { "@type": "Country", name: "United States" }],
        description: "Custom full-dye sublimated jerseys for any sport, made in Ocala, Florida.",
      }}
    />
  );
}
