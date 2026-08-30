import type { Metadata } from "next";
import Link from "next/link";
import {
  PRIORITY_PRODUCTION_COPY,
  RUSH_PRODUCTION_COPY,
  SHIPPING_CARRIER_COPY,
  SHIPPING_TIMING_COPY,
  STANDARD_PRODUCTION_COPY,
} from "@/lib/customer-policy";

export const metadata: Metadata = {
  alternates: { canonical: "/shipping" },
  title: "Shipping & Delivery - Turnaround & Rates",
  description:
    "How Slugger Athletics produces and ships custom team orders: production turnaround, rush options, shipping rates, and tracking.",
};

const SECTIONS = [
  {
    h: "Production turnaround",
    body: [
      "Custom orders are made to order, so the production clock starts after your proof is approved, your final roster is confirmed, and your deposit is paid.",
      `${STANDARD_PRODUCTION_COPY} This is the target for the order to be ready to ship or pick up, not a guaranteed in-hand date. Specialty items and larger orders may take longer.`,
      "Fall is our busiest season. Production queues and carrier networks can slow down, so order as early as possible and leave a buffer before your first game, event, or competition.",
      `${RUSH_PRODUCTION_COPY} ${PRIORITY_PRODUCTION_COPY} ${SHIPPING_TIMING_COPY}`,
    ],
  },
  {
    h: "Shipping rates & methods",
    body: [
      SHIPPING_CARRIER_COPY,
      "Shipping is calculated at checkout based on your order size and address. Larger team orders typically ship as a single bulk shipment to your coach or team contact.",
      "Once a package is accepted by the carrier, weather, routing, customs, and carrier-network delays are outside Slugger Athletics' control. We will help locate and track a delayed package, but extra or upgraded shipping caused by a late order or carrier delay is the customer's responsibility unless Slugger agrees otherwise in writing.",
    ],
  },
  {
    h: "Tracking your order",
    body: [
      "For standard orders, customer tracking is created only after Slugger Athletics has the finished order in hand and prepares the final shipment to you. We email that tracking number to the address on the order; for team orders, it goes to the team contact who placed it.",
      "Some approved rush orders may ship directly from one of our production partners. When that happens, Slugger Athletics sends the customer tracking alert and remains responsible for customer service. Carrier tracking may display the production facility, shipment origin, or country of origin.",
      "Tracking for a package traveling from a designer, factory, or supplier to Slugger Athletics remains internal production tracking. It is not customer delivery tracking, so it is not shared or displayed on the customer order page.",
      "Direct-shipped orders should not require the customer to pay unexpected customs charges or duties. If a carrier requests an unapproved payment, contact Slugger Athletics before paying it.",
      "When every package in an order is marked delivered, we email a delivery confirmation and show the delivery date and report-by date in the customer portal. Inspect all items promptly and report a suspected defect, production error, wrong or missing item, or shipping damage within 7 calendar days of the carrier-recorded delivery time. For multi-package orders, the window starts when the final package is marked delivered.",
      "If you haven't seen a tracking email by your production target, reach out and we'll track it down for you. Remember that the clock starts only after proof approval, final roster submission, and deposit payment are all complete.",
    ],
  },
  {
    h: "Where we ship",
    body: [
      "We ship anywhere in the United States. For orders outside the U.S., contact us first so we can quote shipping and confirm timing before you order.",
    ],
  },
];

export default function ShippingPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-14">
      <header className="max-w-2xl">
        <span className="display text-brand text-sm">Shipping</span>
        <h1 className="display text-4xl sm:text-5xl text-foreground mt-1">Shipping &amp; Delivery</h1>
        <p className="mt-3 text-muted">
          Everything custom is made to order. Here&apos;s how long it takes and how it gets to you.
        </p>
      </header>

      <div className="mt-12 space-y-10">
        {SECTIONS.map((s) => (
          <section key={s.h}>
            <h2 className="display text-2xl text-foreground">{s.h}</h2>
            <div className="mt-3 space-y-3 text-muted">
              {s.body.map((p, i) => <p key={i}>{p}</p>)}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-12 bg-steel border border-line p-6 text-center">
        <h2 className="display text-xl text-foreground">Need it by a certain date?</h2>
        <p className="mt-2 text-muted text-sm">
          Tell us before you order. We&apos;ll review the products, quantity, and destination, then confirm whether rush is available and what it will cost. Email{" "}
          <a href="mailto:apparel@sluggerathletics.com" className="text-brand hover:underline">apparel@sluggerathletics.com</a> or call{" "}
          <a href="tel:+13524147270" className="text-brand hover:underline">352-414-7270</a>.
        </p>
        <Link href="/contact" className="inline-block mt-5 clip-slant bg-brand text-on-brand display px-6 py-3 hover:bg-brand-dark transition-colors">
          Contact Us
        </Link>
      </div>
    </div>
  );
}
