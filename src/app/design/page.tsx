import type { Metadata } from "next";
import { DesignIntakeForm } from "@/components/design-intake-form";
import { DESIGN_FEE_WAIVED } from "@/lib/design-fee";

export const metadata: Metadata = {
  title: "Start a Design - Custom Jersey & Uniform Design",
  description:
    "Start your custom design with Slugger Athletics. Upload inspiration, describe your look, and our in-house designer creates a free mockup for you to approve. No commitment.",
  alternates: { canonical: "/design" },
};

export default function DesignPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-14">
      <header className="max-w-2xl">
        <span className="display text-brand text-sm">Free with Order</span>
        <h1 className="display text-4xl sm:text-5xl text-foreground mt-1">Start Your Design</h1>
        <p className="mt-3 text-muted">
          Tell us what you want. Drop in inspiration images or describe your
          vision &mdash; our in-house designer works up a mockup, sends it
          back, and you approve when you love it.
        </p>
        {DESIGN_FEE_WAIVED ? (
          <p className="mt-3 text-sm text-foreground/90 border-l-2 border-brand pl-3">
            <span className="display text-brand">Free to start right now.</span> No $35 design
            fee &mdash; see your team&apos;s mockup on us, no commitment. Limited-time.
          </p>
        ) : (
          <p className="mt-3 text-sm text-foreground/90 border-l-2 border-brand pl-3">
            <span className="display text-brand">$35 to start.</span> Credited 100% to your
            final order &mdash; so the design is free with purchase.
            Returning customers: we waive the fee automatically.
          </p>
        )}
      </header>

      <ol className="mt-8 grid sm:grid-cols-3 gap-3">
        {[
          { n: 1, t: "Describe & upload", d: "Share your vision and any inspiration images." },
          { n: 2, t: "We mock it up", d: "Our designer sends you a free proof to review." },
          { n: 3, t: "Approve & order", d: "Approve the design, then your team places the order." },
        ].map((s) => (
          <li key={s.n} className="bg-steel border border-line p-4">
            <div className="h-8 w-8 grid place-items-center clip-slant bg-brand text-on-brand display text-sm">{s.n}</div>
            <h3 className="display text-foreground mt-3 text-sm">{s.t}</h3>
            <p className="text-sm text-muted mt-1">{s.d}</p>
          </li>
        ))}
      </ol>

      <div className="mt-10">
        <DesignIntakeForm />
      </div>
    </div>
  );
}
