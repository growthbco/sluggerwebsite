import type { Metadata } from "next";
import { dbEnabled } from "@/db";
import { getByManageToken, MAX_REVISIONS, formatProducts } from "@/lib/design-requests";
import { getByDesignRequestId, getRoster, getPrintableJerseys } from "@/lib/team-orders";
import { getPaidAddonBatches } from "@/lib/team-order-addons";
import { JERSEY_MATERIALS, itemLabel, isInHouseItem } from "@/lib/order-items";
import { getStoreByDesignRequestId, STORE_ITEM_PRESETS } from "@/lib/team-stores";
import { DesignManagePanel } from "@/components/design-manage-panel";
import { DesignMessages } from "@/components/design-messages";
import { AiDesignStudio } from "@/components/ai-design-studio";
import { DesignProgress } from "@/components/design-progress";
import { PrintFileThumbs } from "@/components/print-file-thumbs";
import { TeamStoreTeaser } from "@/components/team-store-teaser";
import { PrintChecklist } from "@/components/print-checklist";
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
  // Plain gear (no names or numbers on any row) has nothing to cross-check
  // against a print file, so the whole QA step is skipped per shop policy.
  const personalized = printRoster.some(
    (r) => (r.playerName ?? "").trim() || (r.playerNumber ?? "").trim(),
  );
  // Per-jersey print-file QA: every printable jersey with its own verified state.
  const printJerseys = linkedOrder ? await getPrintableJerseys(linkedOrder.id) : [];
  // Roster history: the original order (non-add-on rows) plus every paid add-on
  // batch with its own verified status, so the full order history is visible.
  const addonBatches = linkedOrder ? await getPaidAddonBatches(linkedOrder.id) : [];
  // The original order's pieces (non-add-on rows), listed like the add-on
  // batches. Item label derived from each row's sized (non-in-house) item.
  const originalPieces = printRoster
    .filter((r) => r.filledBy !== "addon")
    .map((r) => {
      const sized = Object.entries(r.sizes ?? {}).find(([k, v]) => !isInHouseItem(k) && (v ?? "").trim());
      return {
        item: sized ? itemLabel(sized[0]) : "Jersey",
        name: (r.playerName ?? "").trim(),
        number: (r.playerNumber ?? "").trim(),
        size: sized?.[1] ?? r.sizes?.jersey ?? r.size ?? "",
      };
    });

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
        printFileVerified={Boolean(linkedOrder?.printFileVerifiedAt) || (Boolean(linkedOrder) && printRoster.length > 0 && !personalized)}
      />

      {linkedOrder && printJerseys.length > 0 && (
        // Per-jersey checklist QA. Auth: the team-order manage token (the
        // designer reaches this page from the staff-only Discord thread).
        <PrintChecklist
          token={linkedOrder.manageToken!}
          jerseys={printJerseys.map((j) => ({ ...j, verifiedAt: j.verifiedAt ? new Date(j.verifiedAt).toISOString() : null }))}
        />
      )}

      {linkedOrder && addonBatches.length > 0 && (
        <section className="bg-steel border border-line p-5">
          <h2 className="display text-lg text-foreground">Roster history</h2>
          <p className="text-sm text-muted mt-1">The original order plus every paid add-on batch. Add-ons are printed as their own batch.</p>
          <div className="mt-4 space-y-3">
            <details className="border border-line/60 rounded p-3 group/orig" open>
              <summary className="flex items-center justify-between gap-3 cursor-pointer list-none">
                <span className="display text-sm text-foreground">Original order <span className="text-muted font-normal transition-transform inline-block group-open/orig:rotate-90">›</span></span>
                <span className="text-xs text-muted">{originalPieces.length} piece{originalPieces.length === 1 ? "" : "s"}</span>
              </summary>
              <ul className="mt-2 text-sm text-muted space-y-0.5">
                {originalPieces.map((p, j) => (
                  <li key={j}>
                    {p.item} · {p.size}
                    {p.name ? ` · ${p.name.toUpperCase()}` : ""}{p.number ? ` #${p.number}` : ""}
                  </li>
                ))}
              </ul>
              {linkedOrder.originalPrintFileUrls?.length ? <PrintFileThumbs urls={linkedOrder.originalPrintFileUrls} /> : null}
            </details>
            {addonBatches.map((b, i) => (
              <div key={b.id} className="border border-line/60 rounded p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="display text-sm text-foreground">
                    Add-on {addonBatches.length - i}
                    {b.paidAt && <span className="text-muted font-normal"> · {new Date(b.paidAt).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" })}</span>}
                  </span>
                  <span className={`text-xs display px-2 py-0.5 rounded border ${b.verified ? "text-emerald-400 border-emerald-400/40" : "text-brand border-brand/40"}`}>
                    {b.verified ? "✓ Verified" : "Needs verify"}
                  </span>
                </div>
                <ul className="mt-2 text-sm text-muted space-y-0.5">
                  {b.pieces.map((p, j) => (
                    <li key={j}>
                      {p.quantity > 1 ? `${p.quantity}× ` : ""}{p.label} · {p.size}
                      {p.name ? ` · ${p.name.toUpperCase()}` : ""}{p.number ? ` #${p.number}` : ""}
                    </li>
                  ))}
                </ul>
                {b.printFileUrls.length > 0 && <PrintFileThumbs urls={b.printFileUrls} />}
              </div>
            ))}
          </div>
        </section>
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
        estimatedPieces={request.estimatedPieces ?? null}
        vision={request.vision}
        colors={request.colors}
        colorHexes={request.colorHexes ?? []}
        contact={{ name: request.contactName, email: request.contactEmail, phone: request.contactPhone }}
        inspirationImages={request.inspirationImages ?? []}
        proofImages={request.proofImages ?? []}
        proofLabels={request.proofLabels ?? {}}
        designSkus={request.designSkus ?? {}}
        approvedUrls={request.approvedDesignUrls ?? (request.approvedDesignUrl ? [request.approvedDesignUrl] : [])}
        statusUrl={`${SITE}/design/status/${request.statusToken}`}
        revisionsUsed={request.revisionsUsed ?? 0}
        maxRevisions={MAX_REVISIONS}
        changeRequests={request.changeRequests ?? []}
        rush={request.rush}
        neededBy={request.neededBy ? request.neededBy.toISOString() : null}
      />

      <AiDesignStudio
        token={token}
        teamName={request.teamName}
        latestChangeRequest={(() => {
          // Latest structured change request + any client messages sent since
          // (feedback often arrives split across both) - one ready instruction.
          const crs = request.changeRequests ?? [];
          const cr = crs[crs.length - 1];
          const crNotes = cr ? [cr.generalNote, ...(cr.annotations ?? []).map((a) => a.note)].filter(Boolean) : [];
          // Only post-CR messages WITH attachments join the instruction (their
          // text explains the image); plain chatter stays out of the prompt.
          const since = cr ? new Date(cr.at).getTime() : 0;
          const laterMsgs = (request.messages ?? [])
            .filter((m) => m.from === "client" && new Date(m.at).getTime() > since && (m.attachments?.length ?? 0) > 0)
            .map((m) => m.text.trim())
            .filter(Boolean);
          return [...crNotes, ...laterMsgs].join("; ") || undefined;
        })()}
        initialVersions={request.aiDesignState?.versions ?? []}
        inspirationImages={(() => {
          // Everything the client has sent us: original inspiration uploads +
          // images attached to their messages, deduped, newest last.
          const fromMessages = (request.messages ?? [])
            .filter((m) => m.from === "client")
            .flatMap((m) => m.attachments ?? []);
          return [...new Set([...(request.inspirationImages ?? []), ...fromMessages])];
        })()}
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
