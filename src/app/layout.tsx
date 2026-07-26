import type { Metadata } from "next";
import { Geist, Geist_Mono, Oswald } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { StaffShortcut } from "@/components/staff-shortcut";
import { SiteChat } from "@/components/site-chat";

// Sitewide LocalBusiness schema: ties every page to the Ocala shop and its
// Central Florida service area for local search.
const LOCAL_BUSINESS_JSONLD = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "Slugger Athletics",
  url: "https://www.sluggerathletics.com",
  email: "apparel@sluggerathletics.com",
  telephone: "+1-352-660-1232",
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
  priceRange: "$15-$120",
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
  metadataBase: new URL("https://www.sluggerathletics.com"),
  title: {
    default: "Slugger Athletics - Custom Team Uniforms, Jerseys & Embroidered Hats",
    template: "%s | Slugger Athletics",
  },
  description:
    "Custom team uniforms for every sport, embroidered hats, and 3D hype chains. Fast turnaround, in-house design, and easy team ordering.",
  openGraph: {
    title: "Slugger Athletics - Custom Team Gear",
    description:
      "Custom uniforms, embroidered hats, and hype chains for teams and fans.",
    type: "website",
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
          <SiteHeader />
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(LOCAL_BUSINESS_JSONLD) }} />
          <main className="flex-1">{children}</main>
          <SiteFooter />
          <StaffShortcut />
          <SiteChat />
        </CartProvider>
        <Analytics />
      </body>
    </html>
  );
}
