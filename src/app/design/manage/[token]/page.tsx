import type { Metadata } from "next";
import { dbEnabled } from "@/db";
import { getByManageToken, MAX_REVISIONS } from "@/lib/design-requests";
import { getByDesignRequestId, getRoster } from "@/lib/team-orders";
import { getStoreByDesignRequestId, STORE_ITEM_PRESETS } from "@/lib/team-stores";
import { DesignManagePanel } from "@/components/design-manage-panel";
import { DesignMessages } from "@/components/design-messages";
import { TeamStorePanel } from "@/components/team-store-panel";
import { PrintFileQA } from "@/components/print-file-qa";

export const metadata: Metadata = { title: "Manage Design Request", robots: { index: false } };

function Centered({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-lg px-4 sm:px-6 py-24 text-center">
      <h1 className="display text-3xl text-foreground">{title}</h1>
      <p className="mt-3 text-muted">{children}</p>
    </div>
  );
}

export default async function ManageDesignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!dbEnabled()) return <Centered title="Not available yet">Design requests aren&apos;t turned on yet.</Centered>;

  const request = await getByManageToken(token);
  if (!request) return <Centered title="Link not found">This management link is invalid or has expired.</Centered>;

  const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  // Designer-only print-file QA: only renders once the client has approved this
  // design AND started a linked team order with at least one roster entry.
  // The coach's view (/team-order/manage/...) deliberately does NOT show this
  // — we don't want to put the print-file check in front of the customer.
  const linkedOrder = await getByDesignRequestId(request.id);
  const linkedRoster = linkedOrder ? await getRoster(linkedOrder.id) : [];

  // Per-person team store (only offered once the design is approved).
  const storeEligible = request.status === "approved" || request.status === "ordered";
  const store = storeEligible ? await getStoreByDesignRequestId(request.id) : null;

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-14 space-y-10">
      <DesignManagePanel
        token={token}
        reference={request.reference}
        teamName={request.teamName}
        status={request.status}
        vision={request.vision}
        colors={request.colors}
        contact={{ name: request.contactName, email: request.contactEmail, phone: request.contactPhone }}
        inspirationImages={request.inspirationImages ?? []}
        proofImages={request.proofImages ?? []}
        statusUrl={`${SITE}/design/status/${request.statusToken}`}
        revisionsUsed={request.revisionsUsed ?? 0}
        maxRevisions={MAX_REVISIONS}
        changeRequests={request.changeRequests ?? []}
        rush={request.rush}
        neededBy={request.neededBy ? request.neededBy.toISOString() : null}
      />

      <div className="pt-6 border-t border-line">
        <DesignMessages token={token} role="designer" initialMessages={request.messages ?? []} />
      </div>

      {storeEligible && (
        <div className="pt-6 border-t border-line">
          <TeamStorePanel
            manageToken={token}
            presets={STORE_ITEM_PRESETS.map((p) => ({ key: p.key, label: p.label, priceCents: p.priceCents }))}
            initialStore={
              store
                ? {
                    url: `${SITE}/store/${store.storeToken}`,
                    active: store.storeActive,
                    itemLabels: (store.storeItems ?? []).map((i) => i.label),
                  }
                : null
            }
          />
        </div>
      )}

      {linkedOrder && linkedRoster.length > 0 && (
        <PrintFileQA
          // Auth: the verify endpoint accepts the team-order's manage token.
          // The designer reaches this page from the Discord thread (which only
          // staff can see), so it's safe to surface the team-order token here.
          token={linkedOrder.manageToken!}
          rosterCount={linkedRoster.length}
          initialPrintFileUrl={linkedOrder.printFileUrl}
          initialResult={linkedOrder.printFileVerification ?? null}
        />
      )}

      {linkedOrder && linkedRoster.length === 0 && (
        <p className="text-sm text-muted text-center">
          Print file QA will appear here once the team submits at least one player on their roster
          (team order <span className="font-mono">{linkedOrder.reference}</span>).
        </p>
      )}
    </div>
  );
}
