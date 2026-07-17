import type { Metadata } from "next";
import { dbEnabled } from "@/db";
import { getByStatusToken, MAX_REVISIONS } from "@/lib/design-requests";
import { DesignStatusPanel } from "@/components/design-status-panel";
import { DesignMessages } from "@/components/design-messages";

export const metadata: Metadata = { title: "Your Design Request", robots: { index: false } };

function Centered({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-lg px-4 sm:px-6 py-24 text-center">
      <h1 className="display text-3xl text-foreground">{title}</h1>
      <p className="mt-3 text-muted">{children}</p>
    </div>
  );
}

export default async function DesignStatusPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!dbEnabled()) return <Centered title="Not available yet">Design requests aren&apos;t turned on yet.</Centered>;

  const request = await getByStatusToken(token);
  if (!request) return <Centered title="Link not found">This link is invalid or has expired.</Centered>;

  // Surface the design-fee state above the status panel so the customer
  // always knows where they stand on the $35 (paid / waived / pending).
  const feeState: { label: string; tone: "good" | "warn" } = request.designFeeWaivedReason
    ? {
        label:
          request.designFeeWaivedReason === "returning_customer"
            ? "✓ Design fee waived - returning customer"
            : "✓ Design fee waived",
        tone: "good",
      }
    : request.designFeePaidAt
    ? { label: "✓ $35 design fee paid - credited 100% to your final order", tone: "good" }
    : request.status === "pending_payment"
    ? { label: "⏳ Awaiting payment - your designer starts once the $35 lands", tone: "warn" }
    : { label: `$35 design fee on file (${request.status})`, tone: "good" };

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-14 space-y-4">
      <div
        className={`text-sm px-4 py-2 border ${
          feeState.tone === "good"
            ? "border-brand/40 bg-brand/5 text-foreground"
            : "border-amber-500/40 bg-amber-500/5 text-foreground"
        }`}
      >
        {feeState.label}
      </div>
      <DesignStatusPanel
        token={token}
        reference={request.reference}
        teamName={request.teamName}
        status={request.status}
        proofImages={request.proofImages ?? []}
        initialApprovedUrl={request.approvedDesignUrl}
        teamOrderUrl={`/team-order?design=${token}`}
        revisionsUsed={request.revisionsUsed ?? 0}
        maxRevisions={MAX_REVISIONS}
      />
      <div className="pt-6 border-t border-line">
        <DesignMessages token={token} role="client" initialMessages={request.messages ?? []} />
      </div>
    </div>
  );
}
