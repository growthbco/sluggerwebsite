import type { Metadata } from "next";
import { InfoPage } from "@/components/info-page";

export const metadata: Metadata = {
  title: "Custom 3D Hype Chains for Sports Teams - Ocala, FL",
  description:
    "Custom 3D-printed hype chains for baseball, softball, and travel teams. Your colors, your logo, your celebration. Free mockup, fast turnaround, made in Ocala, FL and shipped nationwide.",
  keywords: [
    "hype chains",
    "custom 3D hype chains",
    "team hype chains",
    "baseball hype chain",
    "softball hype chain",
    "dugout celebration chain",
    "3D printed hype chain",
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
          Every big hit deserves a moment. Slugger Athletics makes{" "}
          <strong className="text-foreground">custom 3D-printed hype chains</strong> that turn a home
          run or a clutch strikeout into a dugout celebration. Made to match your team&apos;s colors as
          closely as our 3D filament allows, with your own logo or mascot on the pendant - lightweight,
          bold, and built to be worn all season.
          Designed and printed in Ocala, shipped anywhere.
        </>
      }
      offeringsTitle="Bring the Hype"
      offeringsBlurb="The finishing touch on game day - personalized to your team's look."
      offerings={[
        { t: "3D-Printed Chains", d: "Bold, lightweight links in colors matched from our available filament - alternate two colors for that unmistakable dugout look." },
        { t: "Custom Pendants", d: "Your logo, mascot, initials, or number rendered as a solid, colorful pendant that pops on camera." },
        { t: "Team Sets", d: "Order for the whole roster so the chain gets passed to whoever comes up clutch." },
        { t: "Simple Pricing", d: "Free mockup so you see it first. One-time $50 for the production 3D file, then each chain starts at $40 depending on detail and colors." },
      ]}
      exampleTitle="Hype Chains We've Made"
      exampleAltSuffix=" - custom 3D hype chain Ocala FL"
      exampleFit="cover"
      manualExamples={[
        { src: "/products/chains/knicks-blue-orange.jpg", alt: "Blue and orange custom Knicks hype chain with 3D-printed pendant - Slugger Athletics Ocala FL" },
        { src: "/products/chains/avengers-red-blue.jpg", alt: "Red and blue custom Avengers hype chain with 3D-printed pendant - Slugger Athletics Ocala FL" },
        { src: "/products/chains/ocala-grind.jpg", alt: "Ocala Grind blue and black custom baseball hype chain - Slugger Athletics Ocala FL" },
        { src: "/products/chains/big-baller.jpg", alt: "Big Baller custom hype chain - Slugger Athletics Ocala FL" },
      ]}
      steps={[
        { n: 1, t: "Send your idea", d: "Share your logo, colors, and the pendant you want - our in-house team designs it for free." },
        { n: 2, t: "Approve the mockup", d: "We send a free mockup so you see the exact chain and pendant before anything is printed." },
        { n: 3, t: "We print & ship", d: "Once approved we produce your chains and ship them fast - one chain or the whole team." },
      ]}
      bodyTitle="What Is a Custom Hype Chain?"
      body={
        <>
          <p>
            A hype chain is the celebration prop that&apos;s taken over dugouts and sidelines: a chunky,
            3D-printed necklace a player throws on after a big moment - a home run, a stolen base, a
            game-saving play. Ours are printed from durable, lightweight plastic in colors{" "}
            <strong className="text-foreground">matched as closely as possible to your team&apos;s</strong>{" "}
            from our available 3D filament, with oversized links that alternate two colors so they read
            from across the field and on video.
          </p>
          <p>
            The pendant is where it gets personal. We build it from your team&apos;s logo, mascot,
            initials, or jersey number as a solid, colorful piece - not a flimsy charm. Because every
            chain is made to order, you&apos;re never picking from a catalog of stock designs: if you can
            describe it, we can print it.
          </p>
          <p>
            Hype chains pair perfectly with a full{" "}
            <a href="/team-uniforms" className="text-brand hover:underline">custom uniform set</a> or{" "}
            <a href="/custom-hats" className="text-brand hover:underline">team hats</a> - one look, head
            to toe, for teams that want to stand out.
          </p>
          <p>
            <a
              href="/product/custom-hype-chain"
              className="inline-block clip-slant bg-brand text-on-brand display text-lg px-8 py-4 hover:bg-brand-dark transition-colors"
            >
              Buy a Custom Hype Chain - $40
            </a>
            <span className="block mt-2 text-sm text-muted">$40 per chain, plus a one-time $50 design-file fee. Free mockup - we finalize your colors and pendant after you order.</span>
          </p>
        </>
      }
      faq={[
        {
          q: "How much does a custom hype chain cost?",
          a: "The mockup is always free. There's a one-time $50 charge to create the production 3D file for your design, and then each chain starts at $40 depending on the detail, colors, and pendant complexity. Order for the whole team and we'll work with you on volume.",
        },
        {
          q: "How long do custom hype chains take?",
          a: "Most orders ship in about 2 to 3 weeks after you approve the mockup, and we can often turn a rush order in about a week. Timing depends on the size of the order and how many chains you need.",
        },
        {
          q: "Can you match our team colors and logo?",
          a: "We get as close as we can. Chains are 3D-printed, so colors are matched from the filament we have on hand rather than a Pantone-exact match - for most team colors that's a very close match. We build the pendant from your logo, mascot, initials, or number, and the links can alternate two colors for that classic dugout look.",
        },
        {
          q: "Is there a minimum order?",
          a: "No hard minimum - we can make a single chain or a full roster set. Tell us how many you need and we'll quote it.",
        },
        {
          q: "Are they durable enough to actually wear?",
          a: "They're built for celebration, not fine jewelry - lightweight 3D-printed plastic that holds up to being thrown on and passed around the dugout all season, without weighing a player down.",
        },
        {
          q: "Can I order matching uniforms and hats too?",
          a: "Absolutely. Most teams pair their hype chain with custom uniforms and hats so the whole look ties together. We can design it all as one set - just ask.",
        },
      ]}
      localTitle="Hype Chains for Teams in Central Florida"
      localBody={
        <>
          Designed and 3D-printed in Ocala for teams across Marion County and Central Florida - and
          shipped nationwide. Pair your <strong className="text-foreground">custom hype chains</strong>{" "}
          with a full uniform set for a look that turns heads on and off the field.
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
          telephone: "+1-352-414-7270",
          areaServed: { "@type": "City", name: "Ocala, Florida" },
        },
        description: "Custom 3D-printed hype chains and team accessories made in Ocala, FL.",
      }}
    />
  );
}
