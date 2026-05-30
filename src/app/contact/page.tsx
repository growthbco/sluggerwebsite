import type { Metadata } from "next";
import { ContactForm } from "@/components/contact-form";

export const metadata: Metadata = {
  title: "Contact - Get in Touch",
  description:
    "Reach Slugger Athletics about team orders, custom designs, order status, and returns. Email, call, or send us a message - we reply within one business day.",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Slugger Athletics",
  email: "apparel@sluggerathletics.com",
  telephone: "+1-352-660-1232",
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer service",
    email: "apparel@sluggerathletics.com",
    telephone: "+1-352-660-1232",
  },
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className="max-w-2xl">
        <span className="display text-brand text-sm">Get in Touch</span>
        <h1 className="display text-4xl sm:text-5xl text-foreground mt-1">Contact Us</h1>
        <p className="mt-3 text-muted">
          Questions about a team order, a custom design, or an existing order? Send us a
          note and we&apos;ll get back to you within one business day.
        </p>
      </header>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_320px]">
        <div>
          <ContactForm />
        </div>

        <aside className="space-y-6">
          <div className="bg-steel border border-line p-6">
            <h2 className="display text-lg text-foreground">Fastest way to reach us</h2>
            <a
              href="sms:+13526601232"
              className="mt-4 flex items-center justify-center gap-2 clip-slant bg-brand text-on-brand display text-base px-5 py-3 hover:bg-brand-dark transition-colors"
            >
              💬 Text us: (352) 660-1232
            </a>
            <p className="mt-3 text-xs text-muted text-center">
              Text gets you a same-day reply during business hours.
            </p>
            <dl className="mt-5 space-y-3 text-sm border-t border-line pt-4">
              <div>
                <dt className="text-muted">Email</dt>
                <dd>
                  <a href="mailto:apparel@sluggerathletics.com" className="text-brand hover:underline">
                    apparel@sluggerathletics.com
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-muted">Call</dt>
                <dd>
                  <a href="tel:+13526601232" className="text-brand hover:underline">(352) 660-1232</a>
                </dd>
              </div>
              <div>
                <dt className="text-muted">Hours</dt>
                <dd className="text-foreground">Mon-Fri, 9am-5pm ET</dd>
              </div>
            </dl>
          </div>

          <div className="bg-steel border border-line p-6">
            <h2 className="display text-lg text-foreground">Ready to order?</h2>
            <p className="mt-2 text-sm text-muted">
              Skip the back-and-forth and start your team order - we&apos;ll send a free design
              proof before anything goes to production.
            </p>
            <a
              href="/team-order"
              className="inline-block mt-4 clip-slant bg-brand text-on-brand display px-5 py-2.5 hover:bg-brand-dark transition-colors"
            >
              Start a Team Order
            </a>
          </div>
        </aside>
      </div>
    </div>
  );
}
