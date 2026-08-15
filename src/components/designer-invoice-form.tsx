"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import type { BillableOrder } from "@/lib/designer-invoices";

type Line = {
  team: string;
  garment: string;
  qty: string;
  unit: string;
  teamOrderId?: string;
  ourQty?: number;
};

const inputCls =
  "w-full bg-ink border border-line px-3 py-2.5 text-foreground placeholder:text-muted/50 focus:border-brand focus:outline-none clip-slant";

const dollars = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function DesignerInvoiceForm({
  token,
  billable,
}: {
  token: string;
  billable: BillableOrder[];
}) {
  const [designerName, setDesignerName] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [duty, setDuty] = useState("");
  const [prevBalance, setPrevBalance] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ reference: string } | null>(null);

  const num = (s: string) => Math.max(0, Number(s) || 0);

  const subtotal = useMemo(() => lines.reduce((s, l) => s + num(l.qty) * num(l.unit), 0), [lines]);
  const dutyN = num(duty);
  const prevN = num(prevBalance);
  const total = subtotal + dutyN + prevN;
  const dutyPct = subtotal > 0 ? (dutyN / subtotal) * 100 : 0;
  const dutyOutOfBand = subtotal > 0 && dutyN > 0 && (dutyPct < 15 || dutyPct > 19);

  function addFromOrder(o: BillableOrder) {
    setLines((prev) => [
      ...prev,
      {
        team: o.teamName.trim(),
        garment: o.garments.map((g) => `${g.qty} ${g.garment}`).join(", ") || "Order",
        qty: String(o.pieces),
        unit: "",
        teamOrderId: o.teamOrderId,
        ourQty: o.pieces,
      },
    ]);
  }
  const addBlank = () => setLines((p) => [...p, { team: "", garment: "", qty: "", unit: "" }]);
  const update = (i: number, field: keyof Line, val: string) =>
    setLines((p) => p.map((l, idx) => (idx === i ? { ...l, [field]: val } : l)));
  const remove = (i: number) => setLines((p) => p.filter((_, idx) => idx !== i));

  async function submit() {
    setError(null);
    const clean = lines.filter((l) => l.team || l.garment || num(l.qty) || num(l.unit));
    if (!clean.length) {
      setError("Add at least one line before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/designer/invoice/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Could not submit the invoice.");
      setDone({ reference: data.reference });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  const BrandBar = (
    <div className="border-b border-line">
      <div className="mx-auto max-w-2xl px-4 py-4 flex items-center justify-between">
        <Image src="/slugger-logo.png" alt="Slugger Athletics" width={140} height={44} className="h-9 w-auto" priority />
        <span className="display text-xs tracking-wider text-muted">Vendor Billing</span>
      </div>
    </div>
  );

  if (done) {
    return (
      <main className="min-h-dvh bg-ink text-foreground">
        {BrandBar}
        <div className="mx-auto max-w-2xl px-4 py-20 text-center">
          <div className="mx-auto h-16 w-16 grid place-items-center clip-slant bg-brand text-on-brand display text-3xl">
            ✓
          </div>
          <h1 className="display text-4xl mt-6">Invoice Submitted</h1>
          <p className="mt-4 text-muted leading-relaxed">
            Reference <span className="text-brand font-semibold">{done.reference}</span>. Slugger has been
            notified and will take care of payment. You can close this page.
          </p>
          <button
            onClick={() => {
              setDone(null);
              setLines([]);
              setDuty("");
              setPrevBalance("");
              setNotes("");
            }}
            className="mt-8 border border-line clip-slant px-6 py-3 text-sm text-foreground hover:border-brand transition-colors"
          >
            Submit another
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-ink text-foreground">
      {BrandBar}
      <div className="mx-auto max-w-2xl px-4 py-10">
        <header className="mb-8">
          <span className="display text-brand text-sm">Print Vendor</span>
          <h1 className="display text-4xl sm:text-5xl mt-1">Submit an Invoice</h1>
          <p className="mt-4 text-muted leading-relaxed">
            Add each team you are billing for, the quantity, and your cost per piece. Enter duty
            separately. Slugger gets pinged the moment you submit.
          </p>
        </header>

        {/* Quick-add from produced orders */}
        {billable.length > 0 && (
          <section className="bg-steel border border-line clip-slant p-5 mb-5">
            <div className="display text-sm text-foreground">Add an order</div>
            <p className="text-xs text-muted mt-1 mb-3">
              Tap a team to add it. Quantities are what Slugger has on record.
            </p>
            <div className="flex flex-wrap gap-2">
              {billable.map((o) =>
                o.alreadyBilledOn ? (
                  <span
                    key={o.teamOrderId}
                    title={`Already invoiced on ${o.alreadyBilledOn}`}
                    className="bg-ink border border-line clip-slant px-3 py-2 text-sm text-muted/50 line-through cursor-not-allowed"
                  >
                    {o.teamName || o.reference}
                    <span className="no-underline"> · already invoiced</span>
                  </span>
                ) : (
                  <button
                    key={o.teamOrderId}
                    onClick={() => addFromOrder(o)}
                    className="bg-ink border border-line clip-slant px-3 py-2 text-sm hover:border-brand transition-colors"
                  >
                    {o.teamName || o.reference}
                    <span className="text-muted"> · {o.pieces} pc</span>
                  </button>
                ),
              )}
            </div>
          </section>
        )}

        {/* Lines */}
        <section className="bg-steel border border-line clip-slant p-5 mb-5">
          <div className="display text-sm text-foreground mb-3">Invoice lines</div>
          {lines.length === 0 && (
            <p className="text-sm text-muted mb-3">No lines yet. Tap an order above, or add one manually.</p>
          )}
          <div className="space-y-3">
            {lines.map((l, i) => {
              const lineTotal = num(l.qty) * num(l.unit);
              const mismatch = typeof l.ourQty === "number" && l.ourQty !== num(l.qty);
              return (
                <div
                  key={i}
                  className={`bg-ink border clip-slant p-4 ${mismatch ? "border-[#e5533c]" : "border-line"}`}
                >
                  <div className="flex gap-2 mb-2">
                    <input
                      placeholder="Team"
                      value={l.team}
                      onChange={(e) => update(i, "team", e.target.value)}
                      className={`${inputCls} flex-1`}
                    />
                    <button
                      onClick={() => remove(i)}
                      aria-label="Remove line"
                      className="border border-line clip-slant px-3 text-muted hover:border-brand hover:text-foreground text-lg leading-none"
                    >
                      ×
                    </button>
                  </div>
                  <input
                    placeholder="What was made (e.g. Halloween jerseys)"
                    value={l.garment}
                    onChange={(e) => update(i, "garment", e.target.value)}
                    className={`${inputCls} mb-2`}
                  />
                  <div className="flex gap-2 items-end">
                    <label className="flex-1">
                      <span className="block text-xs text-muted mb-1">Qty</span>
                      <input
                        inputMode="numeric"
                        placeholder="0"
                        value={l.qty}
                        onChange={(e) => update(i, "qty", e.target.value)}
                        className={inputCls}
                      />
                    </label>
                    <label className="flex-1">
                      <span className="block text-xs text-muted mb-1">Cost each ($)</span>
                      <input
                        inputMode="decimal"
                        placeholder="0.00"
                        value={l.unit}
                        onChange={(e) => update(i, "unit", e.target.value)}
                        className={inputCls}
                      />
                    </label>
                    <div className="w-24 text-right">
                      <span className="block text-xs text-muted mb-1">Line</span>
                      <div className="display text-lg tabular-nums py-1.5">{dollars(lineTotal)}</div>
                    </div>
                  </div>
                  {mismatch && (
                    <p className="text-[#e5533c] text-xs mt-2">
                      Heads up: Slugger has {l.ourQty} pieces on record for this order, not {num(l.qty)}.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          <button
            onClick={addBlank}
            className="mt-3 w-full border border-dashed border-line clip-slant py-2.5 text-sm text-foreground hover:border-brand transition-colors"
          >
            + Add a line manually
          </button>
        </section>

        {/* Duty + balance */}
        <section className="bg-steel border border-line clip-slant p-5 mb-5">
          <div className="flex gap-3">
            <label className="flex-1">
              <span className="block text-xs text-muted mb-1">Duty / Tex ($)</span>
              <input
                inputMode="decimal"
                placeholder="0.00"
                value={duty}
                onChange={(e) => setDuty(e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="flex-1">
              <span className="block text-xs text-muted mb-1">Previous balance ($)</span>
              <input
                inputMode="decimal"
                placeholder="0.00"
                value={prevBalance}
                onChange={(e) => setPrevBalance(e.target.value)}
                className={inputCls}
              />
            </label>
          </div>
          {dutyN > 0 && (
            <p className={`mt-3 text-xs ${dutyOutOfBand ? "text-[#e5533c]" : "text-muted"}`}>
              Duty is {dutyPct.toFixed(1)}% of goods.
              {dutyOutOfBand
                ? " That's outside the usual 15-19% - it will be flagged for review."
                : " Looks normal."}
            </p>
          )}
        </section>

        {/* Name + notes */}
        <section className="bg-steel border border-line clip-slant p-5 mb-5">
          <label className="block mb-3">
            <span className="block text-xs text-muted mb-1">Your name (optional)</span>
            <input
              value={designerName}
              onChange={(e) => setDesignerName(e.target.value)}
              className={inputCls}
              placeholder="Who's submitting"
            />
          </label>
          <label className="block">
            <span className="block text-xs text-muted mb-1">Notes (optional)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={`${inputCls} resize-y`}
              placeholder="Anything Slugger should know"
            />
          </label>
        </section>

        {/* Totals */}
        <section className="bg-steel-2 border border-line clip-slant p-5 mb-5">
          <Row label="Goods" value={dollars(subtotal)} />
          <Row label={`Duty${dutyN > 0 ? ` (${dutyPct.toFixed(1)}%)` : ""}`} value={dollars(dutyN)} />
          {prevN > 0 && <Row label="Previous balance" value={dollars(prevN)} />}
          <div className="h-px bg-line my-3" />
          <div className="flex items-baseline justify-between">
            <span className="display text-lg">Total to pay</span>
            <span className="display text-3xl text-brand tabular-nums">{dollars(total)}</span>
          </div>
        </section>

        {error && <p className="text-[#e5533c] mb-4">{error}</p>}

        <button
          onClick={submit}
          disabled={submitting}
          className="w-full bg-brand text-on-brand display text-lg py-4 clip-slant hover:bg-brand-dark transition-colors disabled:opacity-60"
        >
          {submitting ? "Submitting..." : "Submit Invoice"}
        </button>
      </div>
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
