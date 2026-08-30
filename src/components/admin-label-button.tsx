"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Rate = { rateId: string; provider: string; service: string; costCents: number; estimatedDays: number | null; insuranceCostCents: number };
type Protection = { selected: boolean; paidCents: number; valueCents: number; coveredCents: number; remainingCents: number };

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

/** Local YYYY-MM-DD for the ship-date input default. */
function isoToday(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

/** Estimated arrival = the chosen ship date + N business days (carriers quote
 *  business days), so the ETA reflects when it actually goes out - not today. */
function arrivalLabel(days: number | null, shipDateIso: string): string {
  if (days == null) return "delivery estimate varies";
  const d = new Date(`${shipDateIso}T12:00:00`);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added += 1;
  }
  const date = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  return `Arrives ~${date} (${days} ${days === 1 ? "day" : "days"})`;
}

/** Buy a real USPS/UPS label via Shippo, fully in-modal (no browser prompts):
 *  enter weight → pick a rate → confirm. Tracking + customer email fire on buy. */
export function AdminLabelButton({
  kind,
  id,
  who,
  suggestedLb,
  additional = false,
  label,
}: {
  kind: "team_order" | "order";
  id: string;
  who: string;
  suggestedLb?: number;
  /** Buy a SECOND parcel on an already-labeled order and email the customer
   *  this tracking immediately (vs the primary label, which waits for
   *  "Mark shipped"). */
  additional?: boolean;
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"weight" | "rates">("weight");
  const [weightLb, setWeightLb] = useState(String(suggestedLb ?? 2));
  const [shipDate, setShipDate] = useState(isoToday());
  const [rates, setRates] = useState<Rate[]>([]);
  const [confirming, setConfirming] = useState<Rate | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [protection, setProtection] = useState<Protection | null>(null);
  const [insuredValue, setInsuredValue] = useState("");

  async function openModal() {
    setOpen(true);
    setError("");
    try {
      const res = await fetch("/api/admin/label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "details", kind, id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load order details");
      setProtection(data.protection);
      setInsuredValue(data.protection.selected ? (data.protection.remainingCents / 100).toFixed(2) : "");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function reset() {
    setOpen(false);
    setStep("weight");
    setRates([]);
    setConfirming(null);
    setError("");
    setProtection(null);
    setInsuredValue("");
  }

  async function getRates() {
    const lb = parseFloat(weightLb);
    if (!lb || lb <= 0) {
      setError("Enter a weight in pounds, like 2.5");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "quote",
          kind,
          id,
          weightOz: Math.round(lb * 16),
          insuredValueCents: Math.max(0, Math.round((parseFloat(insuredValue) || 0) * 100)),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not get rates");
      setRates(data.rates);
      setProtection(data.protection);
      setInsuredValue(data.insuredValueCents > 0 ? (data.insuredValueCents / 100).toFixed(2) : "0.00");
      setStep("rates");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function buy(rate: Rate) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "buy",
          kind,
          id,
          rateId: rate.rateId,
          additional,
          insuredValueCents: Math.max(0, Math.round((parseFloat(insuredValue) || 0) * 100)),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Purchase failed");
      window.open(data.labelUrl, "_blank");
      reset();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="text-xs display text-foreground border border-brand/50 px-2.5 py-1 hover:bg-brand/10 whitespace-nowrap"
      >
        {label ?? "Buy label"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => !busy && reset()}>
          <div
            className="w-full max-w-md bg-ink border border-line max-h-[88vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-line sticky top-0 bg-ink">
              <p className="display text-foreground">🏷 {additional ? "Buy another label" : "Buy label"} - {who}</p>
              <button type="button" onClick={reset} disabled={busy} className="text-muted hover:text-foreground text-xl leading-none">✕</button>
            </div>

            <div className="p-4 space-y-4">
              {/* Step 1: weight */}
              {step === "weight" && (
                <>
                  {protection?.selected ? (
                    <div className="border border-green-500/40 bg-green-500/5 p-3">
                      <p className="display text-sm text-green-400">PACKAGE PROTECTION PURCHASED</p>
                      <p className="mt-1 text-xs text-muted">
                        Customer paid {money(protection.paidCents)} to protect {money(protection.valueCents)} of merchandise.
                        {protection.coveredCents > 0 ? ` ${money(protection.coveredCents)} is already assigned to an earlier label.` : ""}
                      </p>
                      {protection.remainingCents > 0 ? (
                        <label className="mt-3 block">
                          <span className="text-xs text-foreground">Merchandise value inside this box</span>
                          <div className="mt-1 flex items-center border border-line bg-steel focus-within:border-brand">
                            <span className="pl-3 text-muted">$</span>
                            <input
                              value={insuredValue}
                              onChange={(e) => setInsuredValue(e.target.value.replace(/[^0-9.]/g, ""))}
                              inputMode="decimal"
                              className="w-full bg-transparent px-2 py-2 text-foreground focus:outline-none"
                            />
                          </div>
                          <span className="mt-1 block text-[11px] text-muted">
                            Up to {money(protection.remainingCents)} remains. For two boxes, enter only this box&apos;s contents and leave the rest for the next label.
                          </span>
                        </label>
                      ) : (
                        <p className="mt-2 text-xs text-green-400">All purchased coverage is already assigned.</p>
                      )}
                    </div>
                  ) : protection ? (
                    <p className="border border-line px-3 py-2 text-xs text-muted">Customer did not add optional package protection.</p>
                  ) : null}
                  <label className="block">
                    <span className="text-sm text-foreground">Package weight (pounds)</span>
                    <input
                      value={weightLb}
                      onChange={(e) => setWeightLb(e.target.value.replace(/[^0-9.]/g, ""))}
                      inputMode="decimal"
                      autoFocus
                      className="mt-1 w-full bg-steel border border-line px-3 py-3 text-lg text-foreground focus:border-brand focus:outline-none"
                      placeholder="e.g. 2.5"
                    />
                    <span className="mt-1 block text-xs text-muted">Weigh the actual box. We quote live USPS & UPS rates to the address on file.</span>
                  </label>
                  <button
                    type="button"
                    onClick={getRates}
                    disabled={busy}
                    className="w-full clip-slant bg-brand text-on-brand display px-6 py-3 hover:bg-brand-dark disabled:opacity-50"
                  >
                    {busy ? "Getting rates…" : "Get rates"}
                  </button>
                </>
              )}

              {/* Step 2: rates + inline confirm */}
              {step === "rates" && !confirming && (
                <>
                  <p className="text-xs text-muted">
                    Weighing {weightLb} lb. Pick a service - the label buys at cost; the customer already paid shipping on their invoice.
                  </p>
                  <label className="flex items-center justify-between gap-3 border border-line px-3 py-2">
                    <span className="text-sm text-foreground">Shipping out on</span>
                    <input
                      type="date"
                      value={shipDate}
                      min={isoToday()}
                      onChange={(e) => setShipDate(e.target.value || isoToday())}
                      className="bg-steel border border-line px-2 py-1 text-sm text-foreground"
                    />
                  </label>
                  <p className="text-[11px] text-muted -mt-1">Arrival dates below are estimated from this ship date.</p>
                  {rates.map((r) => (
                    <button
                      key={r.rateId}
                      type="button"
                      onClick={() => setConfirming(r)}
                      className="w-full flex items-center justify-between gap-3 border border-line hover:border-brand/60 hover:bg-brand/5 px-4 py-3 text-left"
                    >
                      <span>
                        <span className="display text-sm text-foreground">{r.provider} {r.service}</span>
                        <span className="block text-xs text-muted mt-0.5">{arrivalLabel(r.estimatedDays, shipDate)}</span>
                        {r.insuranceCostCents > 0 && <span className="block text-[11px] text-green-400 mt-0.5">Includes {money(r.insuranceCostCents)} XCover protection</span>}
                      </span>
                      <span className="display text-base text-foreground shrink-0">{money(r.costCents)}</span>
                    </button>
                  ))}
                  <button type="button" onClick={() => setStep("weight")} className="w-full text-xs display text-muted border border-line py-2 hover:border-brand/50">
                    ← Change weight
                  </button>
                </>
              )}

              {/* Step 3: confirm the purchase */}
              {confirming && (
                <>
                  <div className="border border-brand/40 bg-brand/5 p-4">
                    <p className="display text-foreground">{confirming.provider} {confirming.service}</p>
                    <p className="text-xs text-muted mt-0.5">{arrivalLabel(confirming.estimatedDays, shipDate)}</p>
                    <p className="display text-2xl text-foreground mt-2">{money(confirming.costCents)}</p>
                    {confirming.insuranceCostCents > 0 && (
                      <p className="text-xs text-green-400 mt-1">XCover attached for {money(Math.round((parseFloat(insuredValue) || 0) * 100))} of merchandise.</p>
                    )}
                    <p className="text-xs text-muted mt-1">{additional ? "Charges your Shippo account and emails the customer this tracking right away as a second package." : "Charges your Shippo account and saves the label + tracking. The customer isn\u2019t emailed until you hit \u201cMark shipped.\u201d"}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => buy(confirming)}
                    disabled={busy}
                    className="w-full clip-slant bg-brand text-on-brand display px-6 py-3 hover:bg-brand-dark disabled:opacity-50"
                  >
                    {busy ? "Buying label…" : `Buy this label - ${money(confirming.costCents)}`}
                  </button>
                  <button type="button" onClick={() => setConfirming(null)} disabled={busy} className="w-full text-xs display text-muted border border-line py-2 hover:border-brand/50">
                    ← Back to rates
                  </button>
                </>
              )}

              {error && <p className="text-sm text-brand">{error}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
