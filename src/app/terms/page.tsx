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
            All custom items are made to order. You are responsible for reviewing and
            approving your design proof, including spelling of names and numbers,
            before production begins. Once a proof is approved, we are not responsible
            for errors it contained.
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
