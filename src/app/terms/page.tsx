import type { Metadata } from "next";

export const metadata: Metadata = {
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
            or call <a href="tel:+13526601232" className="text-brand hover:underline">352-660-1232</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
