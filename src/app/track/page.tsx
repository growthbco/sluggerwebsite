import type { Metadata } from "next";
import { TrackOrder } from "@/components/track-order";

export const metadata: Metadata = {
  title: "Track Your Order",
  description: "Check the status of your Slugger Athletics order with your order number and email.",
};

export default function TrackPage() {
  return (
    <div className="mx-auto max-w-lg px-4 sm:px-6 py-14">
      <header>
        <span className="display text-brand text-sm">Order Status</span>
        <h1 className="display text-4xl sm:text-5xl text-foreground mt-1">Track Your Order</h1>
        <p className="mt-3 text-muted">
          Enter your order number (starts with TO- or SA-) and the email you used. Both are on your
          confirmation email.
        </p>
      </header>
      <div className="mt-8">
        <TrackOrder />
      </div>
      <p className="mt-8 text-sm text-muted">
        Can&apos;t find your order number? Text us at{" "}
        <a href="sms:+13526601232" className="text-brand hover:underline">(352) 660-1232</a> or email{" "}
        <a href="mailto:apparel@sluggerathletics.com" className="text-brand hover:underline">
          apparel@sluggerathletics.com
        </a>
        .
      </p>
    </div>
  );
}
