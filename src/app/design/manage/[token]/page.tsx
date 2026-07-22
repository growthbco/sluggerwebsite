import type { Metadata } from "next";
import { dbEnabled } from "@/db";
import { getByManageToken, MAX_REVISIONS, formatProducts } from "@/lib/design-requests";
import { getByDesignRequestId, getRoster } from "@/lib/team-orders";
import { JERSEY_MATERIALS, itemLabel, isInHouseItem } from "@/lib/order-items";
import { getStoreByDesignRequestId, STORE_ITEM_PRESETS } from "@/lib/team-stores";
import { DesignManagePanel } from "@/components/design-manage-panel";
import { DesignMessages } from "@/components/design-messages";
import { DesignProgress } from "@/components/design-progress";
import { TeamStoreTeaser } from "@/components/team-store-teaser";
import { PrintFileQA } from "@/components/print-file-qa";
import { InboundTracking } from "@/components/inbound-tracking";

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
  // - we don't want to put the print-file check in front of the customer.
  const linkedOrder = await getByDesignRequestId(request.id);
  const linkedRoster = linkedOrder ? await getRoster(linkedOrder.id) : [];
  // This page is designer-facing, and in-house items (hats, embroidered at
  // the shop) aren't the designer's work: they're dropped from the spec line
  // and print-file QA. Rows that exist only for in-house pieces are excluded.
  const printRoster = linkedRoster.filter(
    (r) =>
      (r.size ?? "").trim() ||
      Object.entries(r.sizes ?? {}).some(([k, v]) => !isInHouseItem(k) && (v ?? "").trim()),
  );

  // Per-person team store (only offered once the design is approved).
  const storeEligible = request.status === "approved" || request.status === "ordered";
  const store = storeEligible ? await getStoreByDesignRequestId(request.id) : null;

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-14 space-y-10">
      {/* Status first, then the active production gate (print-file QA), then
          everything else - the page reads in the order the work happens. */}
      <DesignProgress
        status={request.status}
        orderStatus={linkedOrder?.status}
        orderReference={linkedOrder?.reference}
        orderSpec={
          linkedOrder
            ? [
                linkedOrder.jerseyStyle,
                linkedOrder.jerseyMaterial
                  ? JERSEY_MATERIALS.find((m) => m.key === linkedOrder.jerseyMaterial)?.label ?? linkedOrder.jerseyMaterial
                  : null,
                (linkedOrder.items ?? []).filter((k) => !isInHouseItem(k)).map(itemLabel).join(" + "),
              ]
                .filter(Boolean)
                .join(" · ")
            : null
        }
        printFileVerified={Boolean(linkedOrder?.printFileVerifiedAt)}
      />

      {linkedOrder && printRoster.length > 0 && (
        <PrintFileQA
          // Auth: the verify endpoint accepts the team-order's manage token.
          // The designer reaches this page from the Discord thread (which only
          // staff can see), so it's safe to surface the team-order token here.
          token={linkedOrder.manageToken!}
          rosterCount={printRoster.length}
          roster={printRoster.map((r) => ({
            name: r.playerName ?? "",
            number: r.playerNumber ?? "",
            size: r.sizes?.jersey ?? r.size ?? "",
          }))}
          initialPrintFileUrls={
            linkedOrder.printFileUrls ?? (linkedOrder.printFileUrl ? [linkedOrder.printFileUrl] : [])
          }
          initialResult={linkedOrder.printFileVerification ?? null}
        />
      )}

      {/* Designer-only inbound tracking (factory -> Slugger). Same auth story
          as print-file QA: the team-order manage token, reached via the
          staff-only Discord thread. Customers never see this section. */}
      {linkedOrder && linkedOrder.manageToken && (
        <InboundTracking
          token={linkedOrder.manageToken}
          initial={
            linkedOrder.inboundTrackingNumber
              ? {
                  trackingNumber: linkedOrder.inboundTrackingNumber,
                  carrier: linkedOrder.inboundCarrier ?? "Other",
                }
              : null
          }
        />
      )}

      <DesignManagePanel
        token={token}
        reference={request.reference}
        teamName={request.teamName}
        status={request.status}
        products={formatProducts(request.productTypes, request.jerseyStyle) || null}
        vision={request.vision}
        colors={request.colors}
        colorHexes={request.colorHexes ?? []}
        contact={{ name: request.contactName, email: request.contactEmail, phone: request.contactPhone }}
        inspirationImages={request.inspirationImages ?? []}
        proofImages={request.proofImages ?? []}
        approvedUrls={request.approvedDesignUrls ?? (request.approvedDesignUrl ? [request.approvedDesignUrl] : [])}
        statusUrl={`${SITE}/design/status/${request.statusToken}`}
        revisionsUsed={request.revisionsUsed ?? 0}
        maxRevisions={MAX_REVISIONS}
        changeRequests={request.changeRequests ?? []}
        rush={request.rush}
        neededBy={request.neededBy ? request.neededBy.toISOString() : null}
      />

      <div className="pt-6 border-t border-line">
        <DesignMessages token={token} role="designer" initialMessages={request.messages ?? []} status={request.status} />
      </div>

      {storeEligible && (
        <div className="pt-6 border-t border-line">
          {/* Compact teaser only - the full setup lives on its own page. */}
          <TeamStoreTeaser
            manageToken={token}
            store={store ? { url: `${SITE}/store/${store.slug ?? store.storeToken}`, active: store.storeActive } : null}
          />
        </div>
      )}

      {linkedOrder && linkedRoster.length === 0 && (
        <p className="text-sm text-muted text-center">
          Print file QA will appear at the top once the team submits at least one player on their
          roster (team order <span className="font-mono">{linkedOrder.reference}</span>).
        </p>
      )}
    </div>
  );
}
