import type { Metadata } from "next";
import { TeamOrderForm } from "@/components/team-order-form";

export const metadata: Metadata = {
  title: "Team Order - Outfit Your Whole Team",
  description:
    "Start a custom team order with Slugger Athletics. Pick your jersey style and add your roster - name, number, and size. Free design, fast turnaround.",
};

export default function TeamOrderPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-14">
      <header className="max-w-2xl">
        <span className="display text-brand text-sm">For Coaches &amp; Teams</span>
        <h1 className="display text-4xl sm:text-5xl text-foreground mt-1">Start a Team Order</h1>
        <p className="mt-3 text-muted">
          Pick your style and add your roster. We only need each player&apos;s
          name, number, and size - we handle the rest. Free design proof, then
          your gear ships in 2-3 weeks.
        </p>
      </header>

      <div className="mt-10">
        <TeamOrderForm />
      </div>
    </div>
  );
}
