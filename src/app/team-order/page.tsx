import type { Metadata } from "next";
import { TeamOrderForm } from "@/components/team-order-form";
import { dbEnabled } from "@/db";
import { getByStatusToken } from "@/lib/design-requests";
import { itemKeysFromDesignProducts } from "@/lib/order-items";

export const metadata: Metadata = {
  alternates: { canonical: "/team-order" },
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
  /** Item keys derived from what the design actually covers - pre-selected on
   *  the form so the order can't drift from the design (e.g. a hoodie design
   *  accidentally ordered as crew-neck jerseys). */
  items: string[];
  sport: string | null;
  designJerseyStyle: string | null;
  rush: boolean;
  neededBy: string | null;
  /** Every approved colorway/design a player can pick from. When there's more
   *  than one (e.g. "Pin Daddy" / "Pin Mommy"), the roster form shows a design
   *  picker per row so each size ties to the right artwork. */
  designs: { label: string; image: string; sku: string | null }[];
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
      // Every approved colorway players can pick from, labeled from proofLabels
      // when set (matches how the "Add to this order" flow builds its picker).
      const approvedList = req.approvedDesignUrls?.length
        ? req.approvedDesignUrls
        : req.approvedDesignUrl
          ? [req.approvedDesignUrl]
          : [];
      if (approvedList.length > 0) {
        const labels = req.proofLabels ?? {};
        const skuMap = req.designSkus ?? {};
        const designs = approvedList.map((url, i) => ({
          label: (labels[url] || `Design ${i + 1}`).trim(),
          image: url,
          sku: skuMap[url] ?? null,
        }));
        prefill = {
          designToken: design,
          teamName: req.teamName,
          contactName: req.contactName,
          contactEmail: req.contactEmail,
          contactPhone: req.contactPhone ?? "",
          approvedDesignUrl: req.approvedDesignUrl,
          items: itemKeysFromDesignProducts(req.productTypes),
          sport: req.sport,
          designJerseyStyle: req.jerseyStyle,
          rush: req.rush,
          neededBy: req.neededBy?.toISOString().slice(0, 10) ?? null,
          designs,
        };
      }
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-14">
      <header className="max-w-2xl">
        <span className="display text-brand text-sm">For Coaches &amp; Teams</span>
        <h1 className="display text-4xl sm:text-5xl text-foreground mt-1">Start a Team Order</h1>
        <p className="mt-3 text-muted">
          Start with a free design, then build your roster once the artwork is approved.
          We only need each player&apos;s name, number, and size - we handle the rest.
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
