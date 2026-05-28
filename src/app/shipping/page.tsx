import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Shipping & Delivery - Turnaround & Rates",
  description:
    "How Slugger Athletics produces and ships custom team orders and buy-ins: production turnaround, rush options, shipping rates, and tracking.",
};

const SECTIONS = [
  {
    h: "Production turnaround",
    body: [
      "Custom orders are made to order, so the clock starts when you approve your free design proof - not when you place the order.",
      "Most orders ship within 2-3 weeks of proof approval. Specialty items like hoodies, pants, and long-sleeve jerseys can add a few days.",
      "Need it faster? Rush production gets your order out the door in about a week. Ask us before you order so we can confirm timing for your specific items.",
    ],
  },
  {
    h: "Shipping rates & methods",
    body: [
      "Orders ship via USPS or UPS, with the carrier chosen based on weight and destination for the best balance of speed and cost.",
      "Shipping is calculated at checkout based on your order size and address. Larger team orders typically ship as a single bulk shipment to your coach or team contact.",
    ],
  },
  {
    h: "Tracking your order",
    body: [
      "Once your order ships, we email a tracking number to the address on the order. For team orders, tracking goes to the team contact who placed it.",
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
          Tell us your deadline and we&apos;ll let you know if rush is needed. Email{" "}
          <a href="mailto:apparel@sluggerathletics.com" className="text-brand hover:underline">apparel@sluggerathletics.com</a> or call{" "}
          <a href="tel:+13526601232" className="text-brand hover:underline">352-660-1232</a>.
        </p>
        <Link href="/contact" className="inline-block mt-5 clip-slant bg-brand text-on-brand display px-6 py-3 hover:bg-brand-dark transition-colors">
          Contact Us
        </Link>
      </div>
    </div>
  );
}
