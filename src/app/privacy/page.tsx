import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "/privacy" },
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
          <h2 className="display text-xl text-foreground">SMS / Text Messaging</h2>
          <p className="mt-2">
            When you provide your mobile phone number and agree to receive text
            messages, Slugger Athletics may send you SMS messages related to your
            orders and inquiries - for example order confirmations, design proof
            notifications, invoice and payment updates, shipping and delivery
            alerts, and replies to your customer-care questions. Message frequency
            varies based on your order activity. Message and data rates may apply.
          </p>
          <p className="mt-2">
            You can opt out at any time by replying <strong className="text-foreground">STOP</strong> to
            any message. Reply <strong className="text-foreground">HELP</strong> for help, or contact us
            at apparel@sluggerathletics.com or 352-414-7270.
          </p>
          <p className="mt-2">
            No mobile information will be shared with third parties or affiliates
            for marketing or promotional purposes. Text messaging originator opt-in
            data and consent will not be shared with any third parties, excluding
            the service providers acting on our behalf solely to deliver those
            messages.
          </p>
        </div>
        <div>
          <h2 className="display text-xl text-foreground">Contact</h2>
          <p className="mt-2">
            Questions about this policy? Email{" "}
            <a href="mailto:apparel@sluggerathletics.com" className="text-brand hover:underline">apparel@sluggerathletics.com</a>{" "}
            or call <a href="tel:+13524147270" className="text-brand hover:underline">352-414-7270</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
