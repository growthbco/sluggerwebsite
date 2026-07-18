import type { Metadata } from "next";
import { InfoPage } from "@/components/info-page";

export const metadata: Metadata = {
  title: "Custom Team Uniforms & Jerseys in Ocala, FL",
  description:
    "Custom team uniforms and sublimated jerseys in Ocala, FL. Slugger Athletics designs and produces baseball, softball, and all-sport uniforms with free design and fast turnaround across Central Florida.",
  keywords: [
    "custom team uniforms Ocala",
    "custom jerseys Ocala FL",
    "sublimated jerseys Florida",
    "softball uniforms Ocala",
    "baseball uniforms Central Florida",
    "custom sports uniforms",
  ],
  alternates: { canonical: "/team-uniforms" },
};

export default function TeamUniformsPage() {
  return (
    <InfoPage
      eyebrow="Custom Team Uniforms · Ocala, FL"
      h1="Custom Team Uniforms in Ocala"
      intro={
        <>
          Slugger Athletics designs and produces <strong className="text-foreground">custom team uniforms and sublimated jerseys</strong> for
          baseball, softball, and every sport - right here in Ocala and across Central
          Florida. Designed in-house for free, built to perform, and shipped fast.
          Jerseys start at <strong className="text-foreground">$28</strong> with flat, no-minimum pricing -{" "}
          <a href="/pricing" className="text-brand hover:underline">see the full price list</a>.
        </>
      }
      offeringsTitle="Full Uniform Programs"
      offeringsBlurb="Outfit your whole roster - jerseys are our specialty, and we round out the kit."
      offerings={[
        { t: "Custom Jerseys", d: "Fully sublimated jerseys in any color, pattern, or theme - crew, V-neck, full-button, and two-button styles." },
        { t: "Pants & Shorts", d: "Matching pants and shorts to complete the uniform, in team colors and sizes from youth to adult." },
        { t: "Team Hoodies & Outerwear", d: "Hoodies, quarter-zips, and warmups for the dugout and off-field." },
        { t: "Full Team Sets", d: "Home & away packages with names and numbers - one roster, one order, one look." },
      ]}
      exampleCategory="uniforms"
      exampleTitle="Recent Custom Uniforms"
      exampleAltSuffix=" - custom team uniforms Ocala FL"
      localTitle="Team Uniforms Near You in Central Florida"
      localBody={
        <>
          Based in Ocala, we outfit teams, leagues, and schools throughout Marion
          County and Central Florida - including The Villages, Gainesville, and beyond.
          Searching for <strong className="text-foreground">custom team uniforms in Ocala</strong>? We make
          full team ordering simple with player self-entry rosters. Top off the look with{" "}
          <a href="/custom-hats" className="text-brand hover:underline">custom embroidered hats</a> -
          no minimum, with matching player numbers.
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
          areaServed: { "@type": "City", name: "Ocala, Florida" },
        },
        areaServed: "Ocala, FL and Central Florida",
        description: "Custom sublimated team uniforms and jerseys for all sports in Ocala, FL.",
      }}
    />
  );
}
