"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AdminArchiveButton } from "@/components/admin-archive-button";
import { AdminGalleryToggle } from "@/components/admin-gallery-toggle";
import { FollowedUpButton } from "@/components/admin-followed-up-button";

type QueueKey = "action" | "design" | "waiting" | "ready" | "completed" | "all";

export type AdminDesignRequestListItem = {
  id: string;
  reference: string;
  teamName: string;
  status: string;
  contactName: string;
  contactEmail: string;
  revisionsUsed: number;
  neededBy: string | null;
  lastMessage: { from?: string; name?: string; at?: string } | null;
  source: string | null;
  archivedAt: string | null;
  archivedNote: string | null;
  hasApprovedDesign: boolean;
  galleryHidden: boolean;
  followedUpAt: string | null;
  updatedAt: string;
  needsAction: boolean;
  linkedOrder: { id: string; reference: string; status: string } | null;
};

const QUEUES: { key: QueueKey; label: string; shortLabel: string; description: string }[] = [
  { key: "action", label: "Needs our action", shortLabel: "Needs action", description: "New requests, change requests, and customer replies." },
  { key: "design", label: "In design", shortLabel: "In design", description: "Artwork is currently being prepared." },
  { key: "waiting", label: "Waiting on customer", shortLabel: "Waiting", description: "A proof was sent and the customer has the next move." },
  { key: "ready", label: "Approved", shortLabel: "Approved", description: "Artwork is approved and ready for a roster or order." },
  { key: "completed", label: "Order created", shortLabel: "Order created", description: "The design has moved into an order or was closed." },
  { key: "all", label: "All active", shortLabel: "All", description: "Every active design request." },
];

const STATUS_LABEL: Record<string, string> = {
  pending_payment: "Pending",
  submitted: "Submitted",
  in_design: "In design",
  proof_sent: "Proof sent",
  changes_requested: "Changes requested",
  approved: "Approved",
  ordered: "Order created",
  cancelled: "Cancelled",
};

const STATUS_TONE: Record<string, string> = {
  pending_payment: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  submitted: "border-brand/40 bg-brand/10 text-brand",
  in_design: "border-violet-400/40 bg-violet-400/10 text-violet-300",
  proof_sent: "border-sky-400/40 bg-sky-400/10 text-sky-300",
  changes_requested: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  approved: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
  ordered: "border-green-500/40 bg-green-500/10 text-green-300",
  cancelled: "border-line bg-steel text-muted",
};

function queueFor(item: AdminDesignRequestListItem): Exclude<QueueKey, "all"> {
  if (item.needsAction) return "action";
  if (item.status === "in_design") return "design";
  if (item.status === "proof_sent") return "waiting";
  if (item.status === "approved") return "ready";
  if (item.status === "ordered" || item.status === "cancelled") return "completed";
  return "action";
}

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function dateKey(value: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function deadlineState(item: AdminDesignRequestListItem, now: string) {
  if (!item.neededBy || queueFor(item) === "completed") return "normal" as const;
  const due = dateKey(item.neededBy);
  const today = dateKey(now);
  if (due < today) return "overdue" as const;
  const days = Math.ceil((new Date(`${due}T12:00:00Z`).getTime() - new Date(`${today}T12:00:00Z`).getTime()) / 86_400_000);
  return days <= 7 ? ("soon" as const) : ("normal" as const);
}

function waitingOn(item: AdminDesignRequestListItem) {
  const queue = queueFor(item);
  if (queue === "action") return "Slugger";
  if (queue === "design") return "Design team";
  if (queue === "waiting") return "Customer";
  if (queue === "ready") return item.linkedOrder ? "Roster / payment" : "Roster / order";
  return "—";
}

function urgencyRank(item: AdminDesignRequestListItem, now: string) {
  const state = deadlineState(item, now);
  if (state === "overdue") return 0;
  if (state === "soon") return 1;
  if (item.neededBy) return 2;
  return 3;
}

function DesignRow({ item, now }: { item: AdminDesignRequestListItem; now: string }) {
  const deadline = deadlineState(item, now);
  const lastActor = item.lastMessage?.from === "client" ? "Customer message" : item.lastMessage ? `${item.lastMessage.name || "Slugger"} replied` : "Updated";
  const requestHref = `/admin/design-requests/${item.id}`;
  const primaryHref = item.linkedOrder && item.status === "ordered" ? `/admin/team-order/${item.linkedOrder.id}` : requestHref;
  const primaryLabel = item.linkedOrder && item.status === "ordered" ? "Open order" : "Open request";

  return (
    <article className="border-t border-line px-4 py-4 first:border-t-0 hover:bg-steel/45">
      <div className="grid gap-4 xl:grid-cols-[minmax(210px,1.45fr)_145px_130px_125px_140px_minmax(112px,auto)] xl:items-center">
        <div className="min-w-0">
          <Link href={requestHref} className="font-medium text-foreground hover:text-brand hover:underline">
            {item.teamName}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            <span className="font-mono text-brand">{item.reference}</span>
            <span aria-hidden="true">·</span>
            <span className="truncate">{item.contactName}</span>
          </div>
        </div>

        <div>
          <span className={`inline-flex border px-2.5 py-1 text-xs ${STATUS_TONE[item.status] ?? "border-line bg-steel text-muted"}`}>
            {STATUS_LABEL[item.status] ?? item.status.replace(/_/g, " ")}
          </span>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted xl:hidden">Waiting on</p>
          <p className={queueFor(item) === "action" ? "text-sm font-medium text-amber-300" : "text-sm text-foreground"}>{waitingOn(item)}</p>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted xl:hidden">In-hand date</p>
          <p className={`text-sm tabular-nums ${deadline === "overdue" ? "font-medium text-red-300" : deadline === "soon" ? "font-medium text-amber-300" : "text-muted"}`}>
            {fmtDate(item.neededBy)}
          </p>
          {deadline !== "normal" && <p className={`mt-0.5 text-xs ${deadline === "overdue" ? "text-red-300" : "text-amber-300"}`}>{deadline === "overdue" ? "Overdue" : "Due within 7 days"}</p>}
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted xl:hidden">Last activity</p>
          <p className="text-sm text-foreground">{lastActor}</p>
          <p className="mt-0.5 text-xs text-muted">{fmtDate(item.lastMessage?.at ?? item.updatedAt)}</p>
        </div>

        <div className="flex items-center gap-2 xl:justify-end">
          <Link href={primaryHref} className="whitespace-nowrap bg-brand px-3 py-2 text-xs text-on-brand hover:bg-brand-dark">
            {primaryLabel}
          </Link>
          <details className="group relative">
            <summary className="flex h-8 w-9 cursor-pointer list-none items-center justify-center border border-line text-muted hover:border-brand/50 hover:text-foreground" aria-label={`More actions for ${item.teamName}`}>
              <span aria-hidden="true">•••</span>
            </summary>
            <div className="absolute right-0 z-30 mt-2 w-64 border border-line bg-ink p-3 shadow-2xl">
              <div className="space-y-1 text-xs text-muted">
                <p className="break-all">{item.contactEmail}</p>
                <p>Source: {item.source?.split(" → ")[0] || "Unknown"}</p>
                <p>Revisions: {item.revisionsUsed}/5</p>
                {item.linkedOrder && (
                  <Link href={`/admin/team-order/${item.linkedOrder.id}`} className="block text-brand hover:underline">
                    {item.linkedOrder.reference} · {item.linkedOrder.status.replace(/_/g, " ")}
                  </Link>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                {(item.needsAction || item.followedUpAt) && <FollowedUpButton id={item.id} followedUp={Boolean(item.followedUpAt)} />}
                {item.status === "approved" && item.hasApprovedDesign && <AdminGalleryToggle designId={item.id} hidden={item.galleryHidden} />}
                <AdminArchiveButton kind="design_request" id={item.id} archived={false} />
              </div>
            </div>
          </details>
        </div>
      </div>
    </article>
  );
}

export function AdminDesignRequestWorkspace({ items, now }: { items: AdminDesignRequestListItem[]; now: string }) {
  const active = useMemo(() => items.filter((item) => !item.archivedAt), [items]);
  const archived = useMemo(() => items.filter((item) => item.archivedAt), [items]);
  const [queue, setQueue] = useState<QueueKey>("action");
  const [search, setSearch] = useState("");

  const counts = useMemo(() => {
    const result: Record<QueueKey, number> = { action: 0, design: 0, waiting: 0, ready: 0, completed: 0, all: active.length };
    for (const item of active) result[queueFor(item)] += 1;
    return result;
  }, [active]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return active
      .filter((item) => queue === "all" || queueFor(item) === queue)
      .filter((item) => !query || `${item.teamName} ${item.reference} ${item.contactName} ${item.contactEmail}`.toLowerCase().includes(query))
      .sort((a, b) => urgencyRank(a, now) - urgencyRank(b, now) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [active, now, queue, search]);

  const overdue = active.filter((item) => deadlineState(item, now) === "overdue").length;
  const dueSoon = active.filter((item) => deadlineState(item, now) === "soon").length;
  const selectedQueue = QUEUES.find((item) => item.key === queue)!;

  return (
    <>
      <section aria-label="Design request summary" className="grid gap-3 sm:grid-cols-3">
        <div className="border border-amber-500/35 bg-amber-500/10 p-4">
          <span className="text-2xl font-semibold tabular-nums text-amber-300">{counts.action}</span>
          <span className="ml-2 text-sm text-foreground">need our action</span>
        </div>
        <div className="border border-red-500/30 bg-red-500/10 p-4">
          <span className="text-2xl font-semibold tabular-nums text-red-300">{overdue}</span>
          <span className="ml-2 text-sm text-foreground">past in-hand date</span>
        </div>
        <div className="border border-line bg-steel/60 p-4">
          <span className="text-2xl font-semibold tabular-nums text-foreground">{dueSoon}</span>
          <span className="ml-2 text-sm text-muted">due within 7 days</span>
        </div>
      </section>

      <section className="mt-6" aria-label="Design request queues">
        <div className="flex gap-2 overflow-x-auto border-b border-line pb-3">
          {QUEUES.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setQueue(item.key)}
              aria-pressed={queue === item.key}
              className={`flex shrink-0 items-center gap-2 border px-3 py-2 text-sm ${queue === item.key ? "border-brand bg-brand/10 text-brand" : "border-line text-muted hover:border-brand/40 hover:text-foreground"}`}
            >
              {item.shortLabel}
              <span className={`min-w-5 px-1.5 py-0.5 text-center text-xs tabular-nums ${queue === item.key ? "bg-brand text-on-brand" : "bg-steel text-muted"}`}>{counts[item.key]}</span>
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="display text-xl text-foreground">{selectedQueue.label}</h2>
            <p className="mt-1 text-sm text-muted">{selectedQueue.description}</p>
          </div>
          <label className="block w-full sm:w-80">
            <span className="sr-only">Search design requests</span>
            <input
              type="search"
              value={search}
              onChange={(event) => {
                const value = event.target.value;
                setSearch(value);
                if (value.trim()) setQueue("all");
              }}
              placeholder="Search team, reference, or contact"
              className="w-full border border-line bg-ink px-3 py-2.5 text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
            />
          </label>
        </div>

        <div className="mt-4 border border-line bg-ink">
          <div className="hidden grid-cols-[minmax(210px,1.45fr)_145px_130px_125px_140px_minmax(112px,auto)] gap-4 bg-steel px-4 py-2 text-[10px] uppercase tracking-[0.14em] text-muted xl:grid">
            <span>Team / contact</span>
            <span>Stage</span>
            <span>Waiting on</span>
            <span>In-hand date</span>
            <span>Last activity</span>
            <span className="text-right">Actions</span>
          </div>
          {filtered.length > 0 ? (
            filtered.map((item) => <DesignRow key={item.id} item={item} now={now} />)
          ) : (
            <div className="px-5 py-12 text-center">
              <p className="text-foreground">{search ? "No requests match that search." : `Nothing is in ${selectedQueue.label.toLowerCase()} right now.`}</p>
              {!search && queue === "action" && <p className="mt-1 text-sm text-muted">You are caught up. Check the waiting or approved queues next.</p>}
            </div>
          )}
        </div>
      </section>

      {archived.length > 0 && (
        <details className="group mt-6 border border-line bg-steel/40">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3">
            <span className="display text-sm text-muted">Archived design requests ({archived.length})</span>
            <span className="text-brand transition-transform group-open:rotate-45">+</span>
          </summary>
          <div className="divide-y divide-[color:var(--line)] border-t border-line">
            {archived.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <Link href={`/admin/design-requests/${item.id}`} className="font-mono text-xs text-brand hover:underline">{item.reference}</Link>
                  <span className="ml-2 text-foreground">{item.teamName}</span>
                  <span className="ml-2 text-muted">{item.contactName}</span>
                  {item.archivedNote && <span className="ml-2 text-xs text-amber-300">&quot;{item.archivedNote}&quot;</span>}
                  <span className="ml-2 text-xs text-muted">archived {fmtDate(item.archivedAt)}</span>
                </div>
                <AdminArchiveButton kind="design_request" id={item.id} archived />
              </div>
            ))}
          </div>
        </details>
      )}
    </>
  );
}
