import type { Metadata } from "next";
import { PortalRequestForm } from "@/components/portal-request-form";

export const metadata: Metadata = {
  title: "My Orders - Slugger Athletics",
  description: "View your Slugger Athletics orders, designs, and invoices.",
  robots: { index: false },
};

export default function PortalPage() {
  return (
    <div className="mx-auto max-w-xl px-4 sm:px-6 py-16">
      <span className="display text-brand text-sm">Order Portal</span>
      <h1 className="display text-4xl sm:text-5xl text-foreground mt-2">Your Orders</h1>
      <p className="mt-4 text-muted">
        Enter your email and we&apos;ll send you a secure link to everything you have with us -
        team orders, store purchases, design requests, and invoices, all in one place.
      </p>
      <div className="mt-6">
        <PortalRequestForm />
      </div>
    </div>
  );
}
