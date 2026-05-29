import type { Metadata } from "next";
import { TeamOrderForm } from "@/components/team-order-form";
import { dbEnabled } from "@/db";
import { getByStatusToken } from "@/lib/design-requests";

export const metadata: Metadata = {
  title: "Team Order - Outfit Your Whole Team",
  description:
    "Start a custom team order with Slugger Athletics. Pick your jersey style and add your roster - name, number, and size. Free design, fast turnaround.",
};

type Prefill = {
  designToken: string;
  teamName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  approvedDesignUrl: string | null;
};

export default async function TeamOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ design?: string }>;
}) {
  const { design } = await searchParams;

  // If the user arrived from an approved design, pre-fill the form so they
  // don't have to retype team/contact and the order is auto-linked.
  let prefill: Prefill | null = null;
  if (design && dbEnabled()) {
    const req = await getByStatusToken(design);
    if (req && (req.status === "approved" || req.status === "ordered")) {
      prefill = {
        designToken: design,
        teamName: req.teamName,
        contactName: req.contactName,
        contactEmail: req.contactEmail,
        contactPhone: req.contactPhone ?? "",
        approvedDesignUrl: req.approvedDesignUrl,
      };
    }
  }

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
        {prefill && (
          <div className="mt-5 bg-steel border border-brand/60 p-4 text-sm">
            <p className="display text-foreground">✓ Design approved - attached to this order</p>
            <p className="text-muted mt-1">Your team and contact info are pre-filled. Just add your roster below.</p>
          </div>
        )}
      </header>

      <div className="mt-10">
        <TeamOrderForm prefill={prefill ?? undefined} />
      </div>
    </div>
  );
}
