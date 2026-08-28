import type { Metadata } from "next";
import Link from "next/link";

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
      "Most orders ship in about 2-3 weeks after those steps are complete, but this is an estimate rather than a guaranteed delivery date. Specialty items and larger orders may take longer.",
      "Fall is our busiest season. Production queues and carrier networks can slow down, so order as early as possible and leave a buffer before your first game, event, or competition.",
      "Need it faster? Rush service starts at $100. The final fee and available timeline depend on the items and quantity, and rush is not confirmed until Slugger approves it for your specific order.",
    ],
  },
  {
    h: "Shipping rates & methods",
    body: [
      "Orders ship via USPS or UPS, with the carrier chosen based on weight and destination for the best balance of speed and cost.",
      "Shipping is calculated at checkout based on your order size and address. Larger team orders typically ship as a single bulk shipment to your coach or team contact.",
      "Once a package is accepted by the carrier, weather, routing, customs, and carrier-network delays are outside Slugger Athletics' control. We will help locate and track a delayed package, but extra or upgraded shipping caused by a late order or carrier delay is the customer's responsibility unless Slugger agrees otherwise in writing.",
    ],
  },
  {
    h: "Tracking your order",
    body: [
      "For standard orders, customer tracking is created only after Slugger Athletics has the finished order in hand and prepares the final shipment to you. We email that tracking number to the address on the order; for team orders, it goes to the team contact who placed it.",
      "Tracking from a designer, factory, or supplier to Slugger Athletics is internal production tracking. It is not customer delivery tracking, so it is not shared or displayed on the customer order page.",
      "If you haven't seen a tracking email and it's been more than three weeks since you approved your proof, reach out and we'll track it down for you.",
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
