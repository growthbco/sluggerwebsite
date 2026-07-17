import type { Metadata } from "next";
import { Geist, Geist_Mono, Oswald } from "next/font/google";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
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
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </CartProvider>
        {/* LeadConnector chat widget - loaded after page is interactive so
            it doesn't block first paint. */}
        <Script
          src="https://beta.leadconnectorhq.com/loader.js"
          data-resources-url="https://beta.leadconnectorhq.com/chat-widget/loader.js"
          data-widget-id="6a1a594796c166bea6d701a5"
          strategy="afterInteractive"
        />
        <Analytics />
      </body>
    </html>
  );
}
