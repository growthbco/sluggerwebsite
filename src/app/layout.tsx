import type { Metadata } from "next";
import { Geist, Geist_Mono, Oswald } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { HideOnAdmin } from "@/components/hide-on-admin";
import { HideOnStore } from "@/components/hide-on-store";
import { SiteFooter } from "@/components/site-footer";
import { StaffShortcut } from "@/components/staff-shortcut";
import { SiteChat } from "@/components/site-chat";
import { AttributionCapture } from "@/components/attribution-capture";

import reviewsData from "@/data/reviews.json";

// Canonical business entity id, referenced by @id across the schema graph so
// Google resolves every mention to one business (and inherits rating/hours).
export const BUSINESS_ID = "https://sluggerathletics.com/#business";

// Verified public profiles. Each additional profile strengthens entity
// resolution + AI signals.
const SAME_AS = [
  "https://www.instagram.com/sluggerathletics/",
  "https://www.facebook.com/sluggerathletics/",
];

// Sitewide LocalBusiness schema: ties every page to the Ocala shop and its
// Central Florida service area for local search, and exposes the real
// 4.9-star / 79 review aggregate as a trust signal.
const LOCAL_BUSINESS_JSONLD = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": BUSINESS_ID,
  name: "Slugger Athletics",
  legalName: "Slugger Athletics LLC",
  url: "https://sluggerathletics.com",
  logo: "https://sluggerathletics.com/slugger-logo.png",
  image: "https://sluggerathletics.com/slugger-logo.png",
  email: "apparel@sluggerathletics.com",
  telephone: "+1-352-414-7270",
  address: { "@type": "PostalAddress", addressLocality: "Ocala", addressRegion: "FL", addressCountry: "US" },
  description: "Custom team uniforms, sublimated jerseys, embroidered hats, and 3D hype chains - designed and produced in Ocala, Florida.",
  areaServed: [
    { "@type": "City", name: "Ocala, Florida" },
    { "@type": "City", name: "The Villages, Florida" },
    { "@type": "City", name: "Gainesville, Florida" },
    { "@type": "City", name: "Belleview, Florida" },
    { "@type": "City", name: "Summerfield, Florida" },
    { "@type": "City", name: "Dunnellon, Florida" },
    { "@type": "City", name: "Leesburg, Florida" },
    { "@type": "AdministrativeArea", name: "Marion County, Florida" },
  ],
  openingHoursSpecification: {
    "@type": "OpeningHoursSpecification",
    dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    opens: "09:00",
    closes: "17:00",
  },
  sameAs: SAME_AS,
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: String(reviewsData.totalRating),
    reviewCount: String(reviewsData.totalReviews),
    bestRating: "5",
    worstRating: "1",
  },
  priceRange: "$15-$120",
};

const WEBSITE_JSONLD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "https://sluggerathletics.com/#website",
  url: "https://sluggerathletics.com",
  name: "Slugger Athletics",
  publisher: { "@id": BUSINESS_ID },
};
import { CartProvider } from "@/lib/cart";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// Heavy condensed display face for the bold athletic headlines.
const display = Oswald({
  variable: "--font-display",
  weight: ["600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://sluggerathletics.com"),
  title: {
    default: "Slugger Athletics - Custom Team Uniforms, Jerseys & Embroidered Hats",
    template: "%s | Slugger Athletics",
  },
  description:
    "Custom team uniforms for every sport, embroidered hats, and 3D hype chains. Fast turnaround, in-house design, and easy team ordering.",
  // Default link-preview card (coaches share links in team FB groups / GroupMe
  // / texts). Pages can override openGraph.images with their own product shot.
  openGraph: {
    type: "website",
    siteName: "Slugger Athletics",
    title: "Slugger Athletics - Custom Team Uniforms, Jerseys & Embroidered Hats",
    description:
      "Custom team uniforms for every sport, embroidered hats, and 3D hype chains. Fast turnaround, in-house design, no minimums on team stores.",
    url: "https://sluggerathletics.com",
    images: [{ url: "/slugger-logo.png", width: 1200, height: 630, alt: "Slugger Athletics - custom team uniforms" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Slugger Athletics - Custom Team Uniforms & Jerseys",
    description: "Custom team uniforms, jerseys, and embroidered hats. Fast turnaround, in-house design.",
    images: ["/slugger-logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${display.variable} h-full antialiased`}
    >
      <head>
        {/* Apply saved theme before paint to avoid a flash / hydration mismatch. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{document.documentElement.dataset.theme=localStorage.getItem('slugger-theme')||'dark'}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <CartProvider>
          <HideOnAdmin>
            <HideOnStore>
              <SiteHeader />
            </HideOnStore>
          </HideOnAdmin>
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(LOCAL_BUSINESS_JSONLD) }} />
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_JSONLD) }} />
          <main className="flex-1">{children}</main>
          <HideOnAdmin>
            {/* Private team stores render their own minimal footer, so the
                marketing footer/chat/staff shortcut are hidden there too. */}
            <HideOnStore>
              <SiteFooter />
              <StaffShortcut />
              <SiteChat />
            </HideOnStore>
          </HideOnAdmin>
          <AttributionCapture />
        </CartProvider>
        <Analytics />
      </body>
    </html>
  );
}
