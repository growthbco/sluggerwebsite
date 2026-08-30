import type { Metadata } from "next";
import Link from "next/link";
import {
  PRIORITY_PRODUCTION_COPY,
  RUSH_PRODUCTION_COPY,
  SHIPPING_TIMING_COPY,
  STANDARD_PRODUCTION_COPY,
} from "@/lib/customer-policy";

export const metadata: Metadata = {
  alternates: { canonical: "/terms" },
  title: "Terms & Conditions",
  description: "Terms and conditions for ordering custom gear from Slugger Athletics.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-14">
      <h1 className="display text-4xl sm:text-5xl text-foreground">Terms &amp; Conditions</h1>
      <p className="mt-3 text-sm text-muted">Last updated August 30, 2026</p>

      <div className="mt-8 space-y-6 text-muted leading-relaxed">
        <p>
          By placing an order with Slugger Athletics you agree to the following terms.
        </p>
        <div>
          <h2 className="display text-xl text-foreground">Custom Orders &amp; Proofs</h2>
          <p className="mt-2">
            All custom items are made to order. Before production begins, you are
            responsible for carefully reviewing and approving your design proof &mdash;
            including all spelling of names and numbers, sizes, colors, logos, artwork,
            and any specific elements you requested.
          </p>
          <p className="mt-2">
            The approved proof is the complete and final specification for your order.
            We produce exactly what the approved proof shows, and we do not include
            anything that does not appear on it &mdash; even if it was discussed or
            requested earlier in the design process. If something you wanted is missing
            or incorrect, you must request changes before approving. Do not approve a
            proof that is not exactly what you want.
          </p>
          <p className="mt-2">
            Proof approval is final for the artwork shown, but approval by itself does not
            start the production clock. We are not responsible for errors, omissions, or
            missing elements in a proof you approved.
          </p>
          <p className="mt-2">
            The production clock starts only after the final proof is approved, the final
            roster is submitted, and the deposit is paid. You may correct the roster and
            order specifications before payment. Once a deposit or full payment is recorded,
            the roster and confirmed order specifications are locked for production. Any
            later addition or requested change must be accepted by Slugger Athletics and may
            be handled as a separately priced add-on with its own production and shipping timeline.
          </p>
        </div>
        <div>
          <h2 className="display text-xl text-foreground">Payments, Deposits &amp; Balances</h2>
          <p className="mt-2">
            Unless your invoice states otherwise, a 50% deposit is required to begin
            production and the remaining balance is due before the order ships or is released
            for pickup. Tax, shipping, and clearly disclosed specialty or expedited-service
            fees are separate from listed merchandise prices.
          </p>
          <p className="mt-2">
            Payment confirms the products, material, artwork, roster, sizes, service level,
            requested date, and subtotal shown on the order or invoice. Contact us immediately
            if anything is incorrect; a change is not accepted until Slugger Athletics confirms
            it in writing.
          </p>
        </div>
        <div>
          <h2 className="display text-xl text-foreground">Standard Slugger Athletics Branding</h2>
          <p className="mt-2">
            Every final production jersey includes standard Slugger Athletics branding: a
            size barcode tag on the lower-right front, our SA logo at the top of the back,
            and a woven neck label that reads &quot;Slugger Athletics.&quot; These elements
            may not appear on every mockup or proof, but they are included on the finished
            product.
          </p>
        </div>
        <div>
          <h2 className="display text-xl text-foreground">SMS Terms of Service</h2>
          <p className="mt-2">
            By providing your mobile number and opting in, you agree to receive
            order-related and customer-care text messages from Slugger Athletics
            (for example: order confirmations, design proof alerts, invoices,
            and shipping updates). Consent is not a condition of purchase.
            Message frequency varies. Message and data rates may apply. Reply{" "}
            <strong className="text-foreground">STOP</strong> to cancel at any time or{" "}
            <strong className="text-foreground">HELP</strong> for help. Carriers are not liable
            for delayed or undelivered messages. See our{" "}
            <a href="/privacy" className="text-brand hover:underline">Privacy Policy</a> for
            how we handle your information.
          </p>
        </div>
        <div>
          <h2 className="display text-xl text-foreground">Turnaround &amp; Shipping</h2>
          <p className="mt-2">
            {STANDARD_PRODUCTION_COPY} This is a ready-to-ship or pickup target, not a
            guaranteed in-hand date. Specialty items, larger orders, and peak fall-season
            volume may take longer.
          </p>
          <p className="mt-2">
            {RUSH_PRODUCTION_COPY} {PRIORITY_PRODUCTION_COPY} The available timeline is not
            confirmed until Slugger Athletics approves it for the specific order. Rush
            prioritizes production; it does not guarantee carrier transit after the package
            ships. {SHIPPING_TIMING_COPY}{" "}
            <Link href="/shipping" className="text-brand hover:underline">See our Shipping page for details.</Link>
          </p>
          <p className="mt-2">
            We work hard to hit every deadline and we&apos;ll always tell you up front if a
            date is tight. That said, some things are outside our control &mdash; carrier
            delays, customs holds, weather, and factory backlogs can add time even after
            an order leaves our hands, and shipping timeframes are estimates, not
            guarantees. Please build in a buffer when you order for an event or season,
            and place your order as early as you can. If you have a hard deadline, tell us
            before you order so we can be honest about whether we can meet it.
          </p>
          <p className="mt-2">
            Once a package is accepted by the carrier, Slugger Athletics is not
            responsible for carrier, weather, routing, customs, or other transit delays
            outside our control. We will assist with tracking and carrier claims when
            appropriate, but extra or upgraded shipping caused by a late order or a
            carrier delay is the customer&apos;s responsibility unless we agree otherwise in writing.
          </p>
          <p className="mt-2">
            Customer tracking is provided for the final shipment to the customer.
            Tracking for production shipments from a designer, factory, or supplier
            to Slugger Athletics is internal and is not shared as customer delivery tracking.
            For standard orders, customer tracking is issued after we receive the
            finished order and prepare it for final shipment.
          </p>
        </div>
        <div>
          <h2 className="display text-xl text-foreground">Returns</h2>
          <p className="mt-2">
            Because items are custom-made, they generally cannot be returned or
            exchanged unless defective.{" "}
            <Link href="/returns" className="text-brand hover:underline">See our Returns &amp; Exchanges page.</Link>
          </p>
        </div>
        <div>
          <h2 className="display text-xl text-foreground">Contact</h2>
          <p className="mt-2">
            Questions? Email{" "}
            <a href="mailto:apparel@sluggerathletics.com" className="text-brand hover:underline">apparel@sluggerathletics.com</a>{" "}
            or call <a href="tel:+13524147270" className="text-brand hover:underline">352-414-7270</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
