"use client";

import Image from "next/image";
import { useMemo, useState, type ChangeEvent } from "react";
import type { BillableOrder } from "@/lib/designer-invoices";

type Line = {
  team: string;
  garment: string;
  qty: string;
  unit: string;
  teamOrderId?: string;
  ourQty?: number;
};

// An already-submitted (still unpaid) invoice the designer can reopen and edit.
export type EditableInvoice = {
  id: string;
  reference: string;
  designerName: string | null;
  notes: string | null;
  dutyCents: number;
  previousBalanceCents: number;
  totalCents: number;
  submittedAt: string | null;
  vendorRef?: string | null;
  attachmentUrls?: string[];
  lines: { team: string; garment: string; qty: number; unitCents: number; teamOrderId?: string; ourQty?: number }[];
};

// A paid invoice - read-only history, like a customer's past orders.
export type PaidInvoice = {
  id: string;
  reference: string;
  totalCents: number;
  paidAt: string | null;
  lineCount: number;
};

type Filter = "unbilled" | "addons" | "billed";

const inputCls =
  "w-full bg-ink border border-line px-3 py-2.5 text-foreground placeholder:text-muted/50 focus:border-brand focus:outline-none clip-slant";

const dollars = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const money2 = (c: number) => `$${(c / 100).toFixed(2)}`;

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${m}/${d}/${y.slice(2)}`;
}

/** Unbilled delta for a row: full pieces for a fresh job, just the add-on
 *  remainder for one that was already partly billed/settled. */
function deltaFor(o: BillableOrder): number {
  const billed = o.billedPieces ?? 0;
  return billed > 0 && billed < o.pieces ? o.pieces - billed : o.pieces;
}
function isTopUp(o: BillableOrder): boolean {
  const billed = o.billedPieces ?? 0;
  return billed > 0 && billed < o.pieces;
}

export function DesignerInvoiceForm({
  token,
  billable,
  editable = [],
  paid = [],
  embedded = false,
}: {
  token: string;
  billable: BillableOrder[];
  editable?: EditableInvoice[];
  paid?: PaidInvoice[];
  embedded?: boolean;
}) {
  const [designerName, setDesignerName] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [duty, setDuty] = useState("");
  const [prevBalance, setPrevBalance] = useState("");
  const [notes, setNotes] = useState("");
  const [vendorRef, setVendorRef] = useState("");
  const [attachments, setAttachments] = useState<{ url: string; name: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ reference: string; edited: boolean } | null>(null);
  // When set, we're editing an existing invoice (PATCH), not creating one.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("unbilled");

  const num = (s: string) => Math.max(0, Number(s) || 0);

  const subtotal = useMemo(() => lines.reduce((s, l) => s + num(l.qty) * num(l.unit), 0), [lines]);
  const dutyN = num(duty);
  const prevN = num(prevBalance);
  const total = subtotal + dutyN + prevN;
  const dutyPct = subtotal > 0 ? (dutyN / subtotal) * 100 : 0;
  const dutyOutOfBand = subtotal > 0 && dutyN > 0 && (dutyPct < 15 || dutyPct > 19);

  const addedIds = useMemo(() => new Set(lines.map((l) => l.teamOrderId).filter(Boolean)), [lines]);

  // Counts per filter, before search - drives the tab labels.
  const counts = useMemo(() => {
    let unbilled = 0, addons = 0, billed = 0;
    for (const o of billable) {
      if (o.alreadyBilledOn) billed++;
      else { unbilled++; if (isTopUp(o)) addons++; }
    }
    return { unbilled, addons, billed };
  }, [billable]);

  // The rows for the active filter + search. Search matches team, buyer, group,
  // or order ref (so "Dawgs" or "TO-…" both work). Duplicates are distinct rows
  // because each carries its own order ref.
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return billable.filter((o) => {
      if (filter === "billed" && !o.alreadyBilledOn) return false;
      if (filter === "unbilled" && o.alreadyBilledOn) return false;
      if (filter === "addons" && !(!o.alreadyBilledOn && isTopUp(o))) return false;
      if (!q) return true;
      return [o.teamName, o.chipLabel, o.group, o.reference].some((s) => (s ?? "").toLowerCase().includes(q));
    });
  }, [billable, filter, query]);

  function addFromOrder(o: BillableOrder) {
    if (o.alreadyBilledOn) return;
    if (o.teamOrderId && addedIds.has(o.teamOrderId)) return; // already on this invoice
    const qty = deltaFor(o);
    const garment = isTopUp(o)
      ? `Add-on: ${qty} ${o.garments.length === 1 ? o.garments[0].garment : "pieces"}`
      : o.garments.map((g) => `${g.qty} ${g.garment}`).join(", ") || "Order";
    // For a shop order the buyer is the identity; for a team order it's the team.
    const label = o.kind === "order" ? `${o.teamName}` : o.teamName;
    setLines((prev) => [
      ...prev,
      {
        team: label.trim(),
        garment: `${garment} · ${o.reference}`,
        qty: String(qty),
        unit: o.unitCostCents ? (o.unitCostCents / 100).toFixed(2) : "",
        teamOrderId: o.teamOrderId,
        ourQty: qty,
      },
    ]);
  }

  function addAll() {
    for (const o of rows) {
      if (o.alreadyBilledOn) continue;
      if (o.teamOrderId && addedIds.has(o.teamOrderId)) continue;
      addFromOrder(o);
    }
  }

  const update = (i: number, field: keyof Line, val: string) =>
    setLines((p) => p.map((l, idx) => (idx === i ? { ...l, [field]: val } : l)));
  const remove = (i: number) => setLines((p) => p.filter((_, idx) => idx !== i));

  // A blank line for something the system didn't surface - team + garment are
  // free text here (no order to tie to), qty/cost as usual.
  function addCustomLine() {
    setLines((prev) => [...prev, { team: "", garment: "", qty: "1", unit: "" }]);
  }

  function startEdit(inv: EditableInvoice) {
    setEditingId(inv.id);
    setDesignerName(inv.designerName ?? "");
    setLines(inv.lines.map((l) => ({
      team: l.team,
      garment: l.garment,
      qty: String(l.qty),
      unit: (l.unitCents / 100).toFixed(2),
      teamOrderId: l.teamOrderId,
      ourQty: l.ourQty,
    })));
    setDuty(inv.dutyCents ? (inv.dutyCents / 100).toFixed(2) : "");
    setPrevBalance(inv.previousBalanceCents ? (inv.previousBalanceCents / 100).toFixed(2) : "");
    setNotes(inv.notes ?? "");
    setVendorRef(inv.vendorRef ?? "");
    setAttachments((inv.attachmentUrls ?? []).map((url) => ({ url, name: url.split("/").pop()?.split("-").slice(0, -1).join("-") || "invoice" })));
    setError(null);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function reset() {
    setLines([]);
    setDuty("");
    setPrevBalance("");
    setNotes("");
    setVendorRef("");
    setAttachments([]);
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    reset();
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/designer/invoice/${token}/upload`, { method: "POST", body: fd });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || "Upload failed.");
      setAttachments((prev) => [...prev, { url: d.url, name: d.name }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function submit() {
    setError(null);
    const clean = lines.filter((l) => l.team || l.garment || num(l.qty) || num(l.unit));
    if (!clean.length) {
      setError("Add at least one job before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/designer/invoice/${token}`, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editingId ? { invoiceId: editingId } : {}),
          designerName: designerName.trim() || undefined,
          lines: clean.map((l) => ({
            team: l.team,
            garment: l.garment,
            qty: num(l.qty),
            unitCents: Math.round(num(l.unit) * 100),
            teamOrderId: l.teamOrderId,
          })),
          dutyCents: Math.round(dutyN * 100),
          previousBalanceCents: Math.round(prevN * 100),
          notes: notes.trim() || undefined,
          vendorRef: vendorRef.trim() || undefined,
          attachmentUrls: attachments.map((a) => a.url),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Could not submit the invoice.");
      setDone({ reference: data.reference, edited: Boolean(editingId) });
      setEditingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  const BrandBar = (
    <div className="border-b border-line sticky top-0 z-20 bg-ink/95 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <Image src="/slugger-logo.png" alt="Slugger Athletics" width={140} height={44} className="h-8 w-auto" priority />
        <span className="display text-xs tracking-wider text-muted">Print vendor invoice</span>
      </div>
    </div>
  );

  if (done) {
    return (
      <main className="min-h-dvh bg-ink text-foreground">
        {BrandBar}
        <div className="mx-auto max-w-2xl px-4 py-20 text-center">
          <div className="mx-auto h-16 w-16 grid place-items-center clip-slant bg-brand text-on-brand display text-3xl">✓</div>
          <h1 className="display text-4xl mt-6">{done.edited ? "Invoice Updated" : "Invoice Submitted"}</h1>
          <p className="mt-4 text-muted leading-relaxed">
            Reference <span className="text-brand font-semibold">{done.reference}</span>. Slugger has been
            notified{done.edited ? " of the change" : " and will take care of payment"}. You can close this page.
          </p>
          <button
            onClick={() => { setDone(null); reset(); }}
            className="mt-8 border border-line clip-slant px-6 py-3 text-sm text-foreground hover:border-brand transition-colors"
          >
            Submit another
          </button>
        </div>
      </main>
    );
  }

  const tabs: { key: Filter; label: string; n: number }[] = [
    { key: "unbilled", label: "Unbilled", n: counts.unbilled },
    { key: "addons", label: "Add-ons", n: counts.addons },
    { key: "billed", label: "Billed", n: counts.billed },
  ];

  return (
    <main className={`${embedded ? "min-h-0" : "min-h-dvh"} bg-ink text-foreground pb-28 lg:pb-10`}>
      {!embedded && BrandBar}
      <div className="mx-auto max-w-6xl px-4 py-6 lg:grid lg:grid-cols-[1fr_380px] lg:gap-6 lg:items-start">
        {/* ── LEFT: find the job ─────────────────────────────────────── */}
        <div className="min-w-0">
          <header className="mb-4">
            <h1 className="display text-2xl sm:text-3xl">Your invoice to Slugger</h1>
            <p className="mt-1 text-sm text-muted">Find the job, add it, set your cost, submit. Slugger is pinged instantly and pays you.</p>
            <p className="mt-2 text-xs text-muted">Only Slugger staff can approve an invoice or mark it paid.</p>
          </header>

          {editingId && (
            <div className="mb-4 flex items-center justify-between gap-3 bg-brand/10 border border-brand/50 clip-slant px-4 py-3">
              <span className="text-sm text-foreground">Editing an existing invoice. Changes save on submit.</span>
              <button onClick={cancelEdit} className="text-xs text-brand border border-brand/50 clip-slant px-3 py-1.5 hover:bg-brand/10 shrink-0">
                Cancel / new
              </button>
            </div>
          )}

          {/* Search */}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search team or order number (e.g. Dawgs or TO-)…"
            className={`${inputCls} mb-3`}
            aria-label="Search jobs"
          />

          {/* Filter tabs */}
          <div className="flex items-center gap-2 mb-3">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                className={`clip-slant px-3 py-1.5 text-sm transition-colors ${
                  filter === t.key ? "bg-brand text-on-brand" : "bg-steel border border-line text-muted hover:border-brand/50"
                }`}
              >
                {t.label} <span className="tabular-nums opacity-80">{t.n}</span>
              </button>
            ))}
            {filter !== "billed" && rows.some((o) => !o.alreadyBilledOn && !(o.teamOrderId && addedIds.has(o.teamOrderId))) && (
              <button
                onClick={addAll}
                className="ml-auto clip-slant px-3 py-1.5 text-sm border border-brand/60 text-brand hover:bg-brand/10 transition-colors whitespace-nowrap"
              >
                + Add all
              </button>
            )}
          </div>

          {/* Jobs list (table-like rows; no horizontal scroll) */}
          <div className="border border-line clip-slant divide-y divide-[color:var(--line)]">
            {/* Column header (desktop) */}
            <div className="hidden sm:grid grid-cols-[1fr_auto_auto] gap-3 px-4 py-2 bg-steel text-[11px] uppercase tracking-wide text-muted">
              <span>Team / Order</span>
              <span className="text-right w-28">Qty · Cost</span>
              <span className="w-20 text-right">Add</span>
            </div>
            {rows.length === 0 ? (
              <div className="px-4 py-8 text-sm text-muted text-center">
                {query ? "No jobs match that search." : filter === "billed" ? "No billed jobs yet." : "Nothing to bill right now. Jobs appear once the customer has paid."}
              </div>
            ) : (
              rows.map((o) => {
                const added = Boolean(o.teamOrderId && addedIds.has(o.teamOrderId));
                const topUp = isTopUp(o);
                const delta = deltaFor(o);
                const isShop = o.kind === "order";
                return (
                  <div key={o.teamOrderId} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_auto] gap-3 px-4 py-3 items-center">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-foreground font-semibold text-sm truncate">{o.teamName}</span>
                        <span className={`shrink-0 text-[10px] uppercase tracking-wide px-1.5 py-0.5 clip-slant ${isShop ? "bg-brand/15 text-brand" : "bg-steel text-muted"}`}>
                          {isShop ? "Shop" : "Team"}
                        </span>
                        {topUp && <span className="shrink-0 text-[10px] uppercase tracking-wide px-1.5 py-0.5 clip-slant bg-brand/15 text-brand">Add-on</span>}
                      </div>
                      <div className="text-xs text-muted truncate">
                        <span className="font-mono">{o.reference}</span>
                        {isShop && o.group ? ` · ${o.group}` : ""}
                        {o.alreadyBilledOn ? ` · billed ${o.alreadyBilledDate ? fmtDate(o.alreadyBilledDate) : o.alreadyBilledOn}` : ""}
                      </div>
                    </div>
                    <div className="text-right sm:w-28 tabular-nums text-sm">
                      <span className={topUp ? "text-brand" : "text-foreground"}>{topUp ? `+${delta}` : delta} pc</span>
                      <span className="text-muted">{o.unitCostCents ? ` · $${(o.unitCostCents / 100).toFixed(0)}` : " · —"}</span>
                    </div>
                    <div className="col-span-2 sm:col-span-1 sm:w-20 flex sm:flex-col items-stretch sm:items-end gap-1.5">
                      {o.alreadyBilledOn ? (
                        <span className="text-xs text-muted/60 self-center sm:self-end">billed</span>
                      ) : added ? (
                        <span className="text-xs text-brand self-center sm:self-end">✓ added</span>
                      ) : (
                        <button
                          onClick={() => addFromOrder(o)}
                          className="flex-1 sm:flex-none bg-brand text-on-brand display text-sm px-4 py-1.5 clip-slant hover:bg-brand-dark transition-colors"
                        >
                          Add
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Your invoices: unpaid (editable) + paid history */}
          {(editable.length > 0 || paid.length > 0) && (
            <section className="mt-8">
              <h2 className="display text-lg mb-2">Your invoices</h2>
              <div className="border border-line clip-slant divide-y divide-[color:var(--line)]">
                {editable.map((inv) => (
                  <button
                    key={inv.id}
                    onClick={() => startEdit(inv)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-steel transition-colors text-left"
                  >
                    <span className="min-w-0">
                      <span className="text-foreground font-semibold font-mono">{inv.reference}</span>
                      <span className="text-muted"> · {inv.lines.length} line{inv.lines.length === 1 ? "" : "s"} · {fmtDate(inv.submittedAt)}</span>
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 clip-slant bg-amber-400/15 text-amber-300">Awaiting pay</span>
                      <span className="text-foreground tabular-nums">{money2(inv.totalCents)}</span>
                      <span className="text-brand text-xs">Edit</span>
                    </span>
                  </button>
                ))}
                {paid.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span className="min-w-0">
                      <span className="text-foreground font-semibold font-mono">{inv.reference}</span>
                      <span className="text-muted"> · {inv.lineCount} line{inv.lineCount === 1 ? "" : "s"} · paid {fmtDate(inv.paidAt)}</span>
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 clip-slant bg-brand/15 text-brand">Paid</span>
                      <span className="text-muted tabular-nums">{money2(inv.totalCents)}</span>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* ── RIGHT: the invoice being built (sticky on desktop) ──────── */}
        <aside className="mt-8 lg:mt-0 lg:sticky lg:top-16 lg:self-start">
          <div className="bg-steel border border-line clip-slant p-5">
            <div className="display text-sm text-foreground mb-3">
              {editingId ? "Editing invoice" : "This invoice"}
              {lines.length > 0 && <span className="text-muted"> · {lines.length} line{lines.length === 1 ? "" : "s"}</span>}
            </div>

            {lines.length === 0 ? (
              <p className="text-sm text-muted">Add a job from the list to start. Your lines, duty, and total show here.</p>
            ) : (
              <div className="space-y-3 lg:max-h-[38vh] lg:overflow-auto lg:-mx-1 lg:px-1">
                {lines.map((l, i) => {
                  const lineTotal = num(l.qty) * num(l.unit);
                  const mismatch = typeof l.ourQty === "number" && l.ourQty !== num(l.qty);
                  return (
                    <div key={i} className={`bg-ink border clip-slant p-3 ${mismatch ? "border-[#e5533c]" : "border-line"}`}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        {l.teamOrderId ? (
                          <div className="min-w-0">
                            <div className="text-foreground font-semibold text-sm truncate">{l.team || "-"}</div>
                            {l.garment ? <div className="text-muted text-[11px] truncate">{l.garment}</div> : null}
                          </div>
                        ) : (
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <input value={l.team} onChange={(e) => update(i, "team", e.target.value)} placeholder="Team / order name" className={`${inputCls} py-1.5 text-sm`} />
                            <input value={l.garment} onChange={(e) => update(i, "garment", e.target.value)} placeholder="What it is (e.g. 3 Full-Button Jersey)" className={`${inputCls} py-1.5 text-xs`} />
                          </div>
                        )}
                        <button onClick={() => remove(i)} aria-label="Remove line" className="text-muted hover:text-brand text-lg leading-none shrink-0 px-1">×</button>
                      </div>
                      <div className="flex gap-2 items-end">
                        <label className="w-16">
                          <span className="block text-[10px] text-muted mb-1">Qty</span>
                          <input inputMode="numeric" placeholder="0" value={l.qty} onChange={(e) => update(i, "qty", e.target.value)} className={inputCls} />
                        </label>
                        <label className="flex-1">
                          <span className="block text-[10px] text-muted mb-1">Cost each ($)</span>
                          <input inputMode="decimal" placeholder="0.00" value={l.unit} onChange={(e) => update(i, "unit", e.target.value)} className={inputCls} />
                        </label>
                        <div className="w-16 text-right">
                          <span className="block text-[10px] text-muted mb-1">Line</span>
                          <div className="display text-sm tabular-nums py-1.5">{dollars(lineTotal)}</div>
                        </div>
                      </div>
                      {mismatch && (
                        <p className="text-[#e5533c] text-[11px] mt-2">
                          Slugger has {l.ourQty} pieces on record here, not {num(l.qty)}.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Something the list didn't surface - add it by hand. */}
            <button
              onClick={addCustomLine}
              className="mt-3 w-full border border-dashed border-line clip-slant px-3 py-2 text-xs text-muted hover:border-brand hover:text-brand transition-colors"
            >
              + Add something not on the list
            </button>

            {/* Duty + previous balance */}
            <div className="flex gap-2 mt-4">
              <label className="flex-1">
                <span className="block text-[10px] text-muted mb-1">Duty / Tax ($)</span>
                <input inputMode="decimal" placeholder="0.00" value={duty} onChange={(e) => setDuty(e.target.value)} className={inputCls} />
              </label>
              <label className="flex-1">
                <span className="block text-[10px] text-muted mb-1">Prev. balance ($)</span>
                <input inputMode="decimal" placeholder="0.00" value={prevBalance} onChange={(e) => setPrevBalance(e.target.value)} className={inputCls} />
              </label>
            </div>
            <p className="mt-1.5 text-[11px] text-muted">Previous balance = anything we still owe you from before, added onto this invoice.</p>
            {dutyN > 0 && (
              <p className={`mt-1.5 text-[11px] ${dutyOutOfBand ? "text-[#e5533c]" : "text-muted"}`}>
                Duty is {dutyPct.toFixed(1)}% of goods.{dutyOutOfBand ? " Outside 15-19% - will be flagged." : ""}
              </p>
            )}

            {/* Name + your own invoice # + notes */}
            <div className="mt-3 space-y-2">
              <div className="flex gap-2">
                <input value={designerName} onChange={(e) => setDesignerName(e.target.value)} className={inputCls} placeholder="Your name (optional)" />
                <input value={vendorRef} onChange={(e) => setVendorRef(e.target.value)} className={inputCls} placeholder="Your invoice # (optional)" />
              </div>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${inputCls} resize-y`} placeholder="Notes (optional)" />

              {/* Attach the vendor's own invoice file (PDF or photo) */}
              <div>
                {attachments.length > 0 && (
                  <ul className="mb-2 space-y-1">
                    {attachments.map((a, i) => (
                      <li key={a.url} className="flex items-center justify-between gap-2 bg-ink border border-line clip-slant px-3 py-1.5 text-xs">
                        <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-brand truncate hover:underline">📎 {a.name}</a>
                        <button onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))} className="text-muted hover:text-brand shrink-0" aria-label="Remove attachment">×</button>
                      </li>
                    ))}
                  </ul>
                )}
                <label className="flex items-center justify-center gap-2 border border-dashed border-line clip-slant px-3 py-2 text-xs text-muted hover:border-brand hover:text-brand transition-colors cursor-pointer">
                  {uploading ? "Uploading…" : "📎 Attach your own invoice (PDF or photo)"}
                  <input type="file" accept="application/pdf,image/*" onChange={onFile} disabled={uploading} className="hidden" />
                </label>
              </div>
            </div>

            {/* Totals */}
            <div className="mt-4 pt-3 border-t border-line space-y-0.5">
              <Row label="Goods" value={dollars(subtotal)} />
              {dutyN > 0 && <Row label={`Duty (${dutyPct.toFixed(1)}%)`} value={dollars(dutyN)} />}
              {prevN > 0 && <Row label="Previous balance" value={dollars(prevN)} />}
              <div className="flex items-baseline justify-between pt-1">
                <span className="display">Total you&apos;re billing</span>
                <span className="display text-2xl text-brand tabular-nums">{dollars(total)}</span>
              </div>
              <p className="text-[11px] text-muted pt-0.5">What Slugger owes you for this invoice.</p>
            </div>

            {error && <p className="text-[#e5533c] text-sm mt-3">{error}</p>}

            <button
              onClick={submit}
              disabled={submitting || lines.length === 0}
              className="mt-4 w-full bg-brand text-on-brand display text-base py-3 clip-slant hover:bg-brand-dark transition-colors disabled:opacity-50"
            >
              {submitting ? "Saving…" : editingId ? "Save changes" : "Submit invoice"}
            </button>
          </div>
        </aside>
      </div>

      {/* Mobile sticky total bar - always shows the running total + submit */}
      {lines.length > 0 && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-line bg-ink/95 backdrop-blur px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] text-muted">{lines.length} line{lines.length === 1 ? "" : "s"} · you&apos;re billing</div>
            <div className="display text-xl text-brand tabular-nums leading-none">{dollars(total)}</div>
          </div>
          <button
            onClick={submit}
            disabled={submitting}
            className="bg-brand text-on-brand display px-6 py-3 clip-slant hover:bg-brand-dark transition-colors disabled:opacity-50"
          >
            {submitting ? "Saving…" : editingId ? "Save" : "Submit"}
          </button>
        </div>
      )}
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-0.5 text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}
