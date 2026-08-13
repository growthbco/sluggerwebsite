import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "/terms" },
  title: "Terms & Conditions",
  description: "Terms and conditions for ordering custom gear from Slugger Athletics.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-14">
      <h1 className="display text-4xl sm:text-5xl text-foreground">Terms &amp; Conditions</h1>
      <p className="mt-3 text-sm text-muted">Last updated {new Date().getFullYear()}</p>

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
            Approval is final. Once you approve a proof, your order moves into production
            and cannot be changed, cancelled, or refunded. We are not responsible for any
            errors, omissions, or missing elements in a proof you approved.
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
            Standard production is typically 2-3 weeks after proof approval; rush is
            roughly one week and is not guaranteed. Specialty items may take longer.
            See our Shipping page for details.
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
        </div>
        <div>
          <h2 className="display text-xl text-foreground">Returns</h2>
          <p className="mt-2">
            Because items are custom-made, they generally cannot be returned or
            exchanged unless defective. See our Returns &amp; Exchanges page.
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
