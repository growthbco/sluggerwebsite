import type { Metadata } from "next";
import { InfoPage } from "@/components/info-page";

export const metadata: Metadata = {
  title: "Custom Practice Jerseys - $20 Dry-Fit, Free Design",
  description:
    "Custom dry-fit practice jerseys for $20 - quality performance fabric with your team print. Practice sets, coaches shirts, and parent/fan gear. Free design, made in Ocala FL.",
  alternates: { canonical: "/custom-practice-jerseys" },
};

export default function PracticeJerseysPage() {
  return (
    <InfoPage
      eyebrow="Practice Gear · Ocala, FL"
      h1="Custom Practice Jerseys - $20"
      intro={
        <>
          Quality <strong className="text-foreground">dry-fit practice jerseys for $20 flat</strong> -
          your team name, logo, and colors on breathable performance fabric that survives every rep.
          Perfect for practice sets, coaches shirts, and parent and fan gear that matches the team.
        </>
      }
      offeringsTitle="One Shirt, Many Jobs"
      offeringsBlurb="The $20 workhorse of every team program."
      offerings={[
        { t: "Practice Sets", d: "Outfit the whole roster for practice without touching the game-jersey budget." },
        { t: "Coaches & Staff", d: "Matching coach shirts so the whole program looks connected on game day." },
        { t: "Parents & Fans", d: "Add them to your free team store so families buy their own - no collecting money." },
        { t: "Business & Events", d: "The same $20 shirt works for company outings, tournaments, and fundraisers." },
      ]}
      exampleCategory="uniforms"
      exampleTitle="Recent Team Work"
      exampleAltSuffix=" - custom practice jerseys Ocala FL"
      localTitle="Practice Jerseys for Central Florida Teams"
      localBody={
        <>
          Made for Ocala and Central Florida teams with free design and local pickup - and shipped
          nationwide. Pair them with{" "}
          <a href="/custom-hats" className="text-brand hover:underline">no-minimum embroidered hats</a>{" "}
          or add them to any <a href="/team-order" className="text-brand hover:underline">team order</a>.
        </>
      }
      jsonLd={{
        "@context": "https://schema.org",
        "@type": "Product",
        name: "Custom Dry-Fit Practice Jersey",
        description: "Custom dry-fit practice jersey with team print, $20 each.",
        brand: { "@type": "Brand", name: "Slugger Athletics" },
        offers: { "@type": "Offer", price: "20.00", priceCurrency: "USD", availability: "https://schema.org/InStock" },
      }}
    />
  );
}
