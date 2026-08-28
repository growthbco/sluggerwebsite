import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { dbEnabled } from "@/db";
import { designNeedsAction, getById, MAX_REVISIONS, formatProducts } from "@/lib/design-requests";
import { getByDesignRequestId, getRoster, getPrintableJerseys, getSiblingChecklists } from "@/lib/team-orders";
import { getPaidAddonBatches } from "@/lib/team-order-addons";
import { JERSEY_MATERIALS, itemLabel, notDesignerMade } from "@/lib/order-items";
import { getStoreByDesignRequestId } from "@/lib/team-stores";
import { adminEnabled, getAdminSession, canAccess } from "@/lib/admin-auth";
import { toE164 } from "@/lib/sms";
import { AdminPageHeader } from "@/components/admin-page-header";
import { ManageTabs, type ManageTab } from "@/components/manage-tabs";
import { DesignManagePanel } from "@/components/design-manage-panel";
import { DesignConversation } from "@/components/design-conversation";
import { AiDesignStudio } from "@/components/ai-design-studio";
import { DesignProgress } from "@/components/design-progress";
import { PrintFileThumbs } from "@/components/print-file-thumbs";
import { TeamStoreTeaser } from "@/components/team-store-teaser";
import { PrintChecklist } from "@/components/print-checklist";
import { InboundTracking } from "@/components/inbound-tracking";
import { FollowedUpButton } from "@/components/admin-followed-up-button";

export const metadata: Metadata = { title: "Design Request", robots: { index: false } };
export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  pending_payment: "Pending",
  submitted: "Submitted",
  in_design: "In design",
  proof_sent: "Proof sent",
  changes_requested: "Changes requested",
  approved: "Approved",
  ordered: "Order created",
  cancelled: "Cancelled",
};

const STATUS_TONES: Record<string, string> = {
  pending_payment: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  submitted: "border-brand/40 bg-brand/10 text-brand",
  in_design: "border-violet-400/40 bg-violet-400/10 text-violet-300",
  proof_sent: "border-sky-400/40 bg-sky-400/10 text-sky-300",
  changes_requested: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  approved: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
  ordered: "border-green-500/40 bg-green-500/10 text-green-300",
  cancelled: "border-line bg-steel text-muted",
};

function fmtDate(value: Date | null | undefined) {
  if (!value) return "Not provided";
  return value.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Staff/designer workspace for a single design request, inside the admin
// sidebar chrome (not the public marketing header). Same building blocks as the
// old /design/manage page, but organized into tabs so it's not one long scroll.
export default async function AdminDesignRequestPage({ params }: { params: Promise<{ id: string }> }) {
  if (!adminEnabled()) redirect("/admin");
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!canAccess(session.role, "/admin/design-requests")) redirect("/admin");
  if (!dbEnabled()) redirect("/admin");

  const { id } = await params;
  const request = await getById(id);
  if (!request) redirect("/admin/design-requests");

  const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const token = request.manageToken!;
  const smsPhone = request.contactPhone ? toE164(request.contactPhone) : null;

  // Linked-order production data (same derivation as the old manage page).
  const linkedOrder = await getByDesignRequestId(request.id);
  const linkedRoster = linkedOrder ? await getRoster(linkedOrder.id) : [];
  const printRoster = linkedRoster.filter(
    (r) =>
      (r.size ?? "").trim() ||
      Object.entries(r.sizes ?? {}).some(([k, v]) => !notDesignerMade(k) && (v ?? "").trim()),
  );
  const personalized = printRoster.some((r) => (r.playerName ?? "").trim() || (r.playerNumber ?? "").trim());
  const printJerseys = linkedOrder ? await getPrintableJerseys(linkedOrder.id) : [];
  const siblingChecklists = linkedOrder ? await getSiblingChecklists(request.id, linkedOrder.id) : [];
  const addonBatches = linkedOrder ? await getPaidAddonBatches(linkedOrder.id) : [];
  const originalPieces = printRoster
    .filter((r) => r.filledBy !== "addon")
    .map((r) => {
      const sized = Object.entries(r.sizes ?? {}).find(([k, v]) => !notDesignerMade(k) && (v ?? "").trim());
      return {
        item: sized ? itemLabel(sized[0]) : "Jersey",
        name: (r.playerName ?? "").trim(),
        number: (r.playerNumber ?? "").trim(),
        size: sized?.[1] ?? r.sizes?.jersey ?? r.size ?? "",
      };
    });

  const storeEligible = request.status === "approved" || request.status === "ordered";
  const store = storeEligible ? await getStoreByDesignRequestId(request.id) : null;
  const statusUrl = `${SITE}/design/status/${request.statusToken}`;
  const lastMessage = request.messages?.[request.messages.length - 1] ?? null;
  const needsAction = designNeedsAction(request);
  const printFileVerified = Boolean(linkedOrder?.printFileVerifiedAt) || (Boolean(linkedOrder) && printRoster.length > 0 && !personalized);
  const canOpenLinkedOrder = Boolean(linkedOrder && canAccess(session.role, `/admin/team-order/${linkedOrder.id}`));

  let waitingOn = "Slugger";
  if (!needsAction && request.status === "in_design") waitingOn = "Design team";
  else if (!needsAction && request.status === "proof_sent") waitingOn = "Customer";
  else if (!needsAction && request.status === "approved") waitingOn = linkedOrder ? "Roster / payment" : "Roster / order";
  else if (!needsAction && request.status === "ordered") waitingOn = "Production";
  else if (!needsAction && request.status === "cancelled") waitingOn = "—";

  let nextAction = "Review the project and choose the next workflow step.";
  let nextTab = "overview";
  if (needsAction && request.status === "changes_requested") {
    nextAction = "Review the requested changes and send an updated proof.";
    nextTab = "proofs";
  } else if (needsAction && lastMessage?.from === "client") {
    nextAction = "Reply to the customer’s latest message.";
    nextTab = "messages";
  } else if (needsAction && request.status === "submitted") {
    nextAction = "Review the brief and begin the first design.";
  } else if (linkedOrder && printRoster.length > 0 && !printFileVerified) {
    nextAction = "Run print-file QA before production continues.";
    nextTab = "production";
  } else if (request.status === "proof_sent") {
    nextAction = "Waiting for customer feedback on the current proof.";
  } else if (request.status === "approved" && !linkedOrder) {
    nextAction = "The artwork is approved; the customer can begin the roster or order.";
  } else if (linkedOrder?.status === "in_production" && !linkedOrder.inboundTrackingNumber && !linkedOrder.trackingNumber) {
    nextAction = "Add production tracking when the factory ships.";
    nextTab = "production";
  }

  const deadlineTone = request.rush ? "text-amber-300" : "text-foreground";

  const managePanel = (view: "overview" | "proofs") => (
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
      source={request.source ?? "Direct"}
      inspirationImages={request.inspirationImages ?? []}
      proofImages={request.proofImages ?? []}
      proofLabels={request.proofLabels ?? {}}
      designSkus={request.designSkus ?? {}}
      approvedUrls={request.approvedDesignUrls ?? (request.approvedDesignUrl ? [request.approvedDesignUrl] : [])}
      statusUrl={statusUrl}
      revisionsUsed={request.revisionsUsed ?? 0}
      maxRevisions={MAX_REVISIONS}
      changeRequests={request.changeRequests ?? []}
      rush={request.rush}
      neededBy={request.neededBy ? request.neededBy.toISOString() : null}
      rushApprovedAt={request.rushApprovedAt ? request.rushApprovedAt.toISOString() : null}
      rushApprovedBy={request.rushApprovedBy ?? null}
      showRequestHeader={false}
      view={view}
    />
  );

  const overview = (
    <div className="space-y-8">
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
                (linkedOrder.items ?? []).filter((k) => !notDesignerMade(k)).map(itemLabel).join(" + "),
              ]
                .filter(Boolean)
                .join(" · ")
            : null
        }
        printFileVerified={printFileVerified}
        showNextAction={false}
      />

      {managePanel("overview")}
    </div>
  );

  const production = (
    <div className="space-y-8">
      <section className="border border-line bg-steel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="display text-xl text-foreground">Order &amp; production</h2>
            <p className="mt-1 text-sm text-muted">Roster, print-file QA, shipment tracking, and team-store handoff.</p>
          </div>
          {linkedOrder && canOpenLinkedOrder && (
            <Link href={`/admin/team-order/${linkedOrder.id}`} className="border border-brand/40 px-3 py-2 text-sm text-brand hover:bg-brand/10">
              Open full order
            </Link>
          )}
        </div>
        {linkedOrder ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="border border-line bg-ink/40 p-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted">Order</p>
              <p className="mt-1 font-mono text-sm text-brand">{linkedOrder.reference}</p>
              <p className="mt-0.5 text-xs text-muted">{linkedOrder.status.replace(/_/g, " ")}</p>
            </div>
            <div className="border border-line bg-ink/40 p-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted">Roster</p>
              <p className="mt-1 text-lg text-foreground">{printRoster.length} player{printRoster.length === 1 ? "" : "s"}</p>
            </div>
            <div className="border border-line bg-ink/40 p-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted">Print-file QA</p>
              <p className={`mt-1 text-sm ${printFileVerified ? "text-green-300" : "text-amber-300"}`}>{printFileVerified ? "Verified" : "Needs verification"}</p>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted">No team order is linked to this design yet.</p>
        )}
      </section>

      {/* Production QA: print-file checklists + inbound tracking, shown once a
          linked roster exists. */}
      {linkedOrder && printJerseys.length > 0 && (
        <PrintChecklist
          token={linkedOrder.manageToken!}
          jerseys={printJerseys.map((j) => ({ ...j, verifiedAt: j.verifiedAt ? new Date(j.verifiedAt).toISOString() : null }))}
        />
      )}

      {siblingChecklists.map((sc) => (
        <div key={sc.id} className="space-y-2">
          <p className="text-sm text-amber-300 display">🧢 Also on this print sheet - ordered separately: {sc.label} <span className="font-mono text-xs text-muted">({sc.reference})</span></p>
          <PrintChecklist
            token={sc.token}
            jerseys={sc.jerseys.map((j) => ({ ...j, verifiedAt: j.verifiedAt ? new Date(j.verifiedAt).toISOString() : null }))}
          />
        </div>
      ))}

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

      {linkedOrder && linkedOrder.manageToken && (
        <InboundTracking
          token={linkedOrder.manageToken}
          initial={
            linkedOrder.inboundTrackingNumber
              ? { trackingNumber: linkedOrder.inboundTrackingNumber, carrier: linkedOrder.inboundCarrier ?? "Other" }
              : null
          }
        />
      )}

      {storeEligible && (
        <div className="pt-2">
          <TeamStoreTeaser
            manageToken={token}
            store={store ? { url: `${SITE}/store/${store.slug ?? store.storeToken}`, active: store.storeActive } : null}
          />
        </div>
      )}

      {linkedOrder && linkedRoster.length === 0 && (
        <p className="text-sm text-muted">
          Print file QA appears here once the team submits at least one player on their roster (team order{" "}
          <span className="font-mono">{linkedOrder.reference}</span>).
        </p>
      )}
    </div>
  );

  // AI studio instruction + inspiration, same derivation as the manage page.
  const crs = request.changeRequests ?? [];
  const cr = crs[crs.length - 1];
  const crNotes = cr ? [cr.generalNote, ...(cr.annotations ?? []).map((a) => a.note)].filter(Boolean) : [];
  const since = cr ? new Date(cr.at).getTime() : 0;
  const laterMsgs = (request.messages ?? [])
    .filter((m) => m.from === "client" && new Date(m.at).getTime() > since && (m.attachments?.length ?? 0) > 0)
    .map((m) => m.text.trim())
    .filter(Boolean);
  const latestChangeRequest = [...crNotes, ...laterMsgs].join("; ") || undefined;
  const studioInspiration = [
    ...new Set([
      ...(request.inspirationImages ?? []),
      ...(request.messages ?? []).filter((m) => m.from === "client").flatMap((m) => m.attachments ?? []),
    ]),
  ];

  const tabs: ManageTab[] = [
    { key: "overview", label: "Overview", content: overview },
    { key: "proofs", label: `Proofs (${request.proofImages?.length ?? 0})`, content: managePanel("proofs") },
    {
      key: "messages",
      label: `Messages (${request.messages?.length ?? 0})`,
      content: (
        <DesignConversation
          token={token}
          phone={smsPhone}
          name={request.contactName}
          initialDesignMessages={request.messages ?? []}
        />
      ),
    },
    {
      key: "studio",
      label: "Studio",
      content: (
        <AiDesignStudio
          token={token}
          teamName={request.teamName}
          latestChangeRequest={latestChangeRequest}
          initialVersions={request.aiDesignState?.versions ?? []}
          inspirationImages={studioInspiration}
        />
      ),
    },
    ...(linkedOrder || storeEligible ? [{ key: "production", label: "Order & Production", content: production }] : []),
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <Link href="/admin/design-requests" className="mb-4 inline-flex text-sm text-muted hover:text-brand">
        ← All design requests
      </Link>
      <AdminPageHeader
        eyebrow={`Design Request · ${request.reference}`}
        title={request.teamName}
      >
        <span className={`border px-3 py-1.5 text-xs ${STATUS_TONES[request.status] ?? "border-line bg-steel text-muted"}`}>
          {STATUS_LABELS[request.status] ?? request.status.replace(/_/g, " ")}
        </span>
        {(needsAction || request.followedUpAt) && (
          <FollowedUpButton id={request.id} followedUp={Boolean(request.followedUpAt)} />
        )}
      </AdminPageHeader>

      <section className={`border p-4 ${needsAction ? "border-amber-500/40 bg-amber-500/10" : "border-line bg-steel/60"}`}>
        <p className="text-[10px] uppercase tracking-[0.16em] text-muted">Next action</p>
        <p className={`mt-1 text-base ${needsAction ? "font-medium text-amber-200" : "text-foreground"}`}>{nextAction}</p>
      </section>

      <section aria-label="Request summary" className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="border border-line bg-steel/50 p-4">
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted">Waiting on</p>
          <p className={`mt-1 text-base ${needsAction ? "font-medium text-amber-300" : "text-foreground"}`}>{waitingOn}</p>
        </div>
        <div className="border border-line bg-steel/50 p-4">
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted">Customer in-hand date</p>
          <p className={`mt-1 text-base tabular-nums ${deadlineTone}`}>{fmtDate(request.neededBy)}</p>
          {request.rush && <p className="mt-0.5 text-xs text-amber-300">Rush timeline</p>}
        </div>
        <div className="border border-line bg-steel/50 p-4">
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted">Revisions</p>
          <p className="mt-1 text-base text-foreground">{request.revisionsUsed ?? 0} of {MAX_REVISIONS}</p>
        </div>
        <div className="border border-line bg-steel/50 p-4">
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted">Linked order</p>
          {linkedOrder ? (
            canOpenLinkedOrder ? (
              <Link href={`/admin/team-order/${linkedOrder.id}`} className="mt-1 block font-mono text-sm text-brand hover:underline">{linkedOrder.reference}</Link>
            ) : (
              <p className="mt-1 font-mono text-sm text-foreground">{linkedOrder.reference}</p>
            )
          ) : (
            <p className="mt-1 text-base text-muted">Not started</p>
          )}
          {linkedOrder && <p className="mt-0.5 text-xs text-muted">{linkedOrder.status.replace(/_/g, " ")}</p>}
        </div>
      </section>

      <div className="mt-6">
        <ManageTabs tabs={tabs} defaultTab={nextTab} />
      </div>
    </div>
  );
}
