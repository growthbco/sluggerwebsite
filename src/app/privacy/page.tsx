import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Slugger Athletics collects, uses, and protects your information.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-14">
      <h1 className="display text-4xl sm:text-5xl text-foreground">Privacy Policy</h1>
      <p className="mt-3 text-sm text-muted">Last updated {new Date().getFullYear()}</p>

      <div className="mt-8 space-y-6 text-muted leading-relaxed">
        <p>
          Slugger Athletics respects your privacy. This policy explains what
          information we collect and how we use it when you visit our site or place
          an order.
        </p>
        <div>
          <h2 className="display text-xl text-foreground">Information We Collect</h2>
          <p className="mt-2">
            We collect the information you provide when placing an order or starting
            a team order, such as your name, email, phone number, shipping address,
            and roster details (player names, numbers, and sizes). Payments are
            processed securely by Stripe; we do not store your full card details.
          </p>
        </div>
        <div>
          <h2 className="display text-xl text-foreground">How We Use It</h2>
          <p className="mt-2">
            We use your information to design, produce, and ship your order, to
            communicate about your order, and to provide customer support. We do not
            sell your personal information.
          </p>
        </div>
        <div>
          <h2 className="display text-xl text-foreground">Sharing</h2>
          <p className="mt-2">
            We share information only with the service providers needed to fulfill
            your order (for example, payment processing and shipping).
          </p>
        </div>
        <div>
          <h2 className="display text-xl text-foreground">Contact</h2>
          <p className="mt-2">
            Questions about this policy? Email{" "}
            <a href="mailto:apparel@sluggerathletics.com" className="text-brand hover:underline">apparel@sluggerathletics.com</a>{" "}
            or call <a href="tel:+13526601232" className="text-brand hover:underline">352-660-1232</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
