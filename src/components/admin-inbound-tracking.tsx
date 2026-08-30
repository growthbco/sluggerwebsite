"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { INBOUND_CARRIERS } from "@/lib/tracking";

type Destination = "slugger" | "customer";
type SavedResult = {
  destination: Destination;
  trackingNumber: string;
  carrier: string;
  customerNotified?: boolean;
  warning?: string;
};

/** Record a production shipment from the admin/designer workspace. The
 * destination is deliberately required because it controls whether tracking
 * stays internal or marks the order shipped and contacts the customer. */
export function AdminInboundTracking({
  orderKey,
  initialCarrier,
  initialNumber,
  canShipDirect,
}: {
  orderKey: string;
  initialCarrier: string | null;
  initialNumber: string | null;
  canShipDirect: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [destination, setDestination] = useState<Destination | "">(initialNumber ? "slugger" : "");
  const [carrier, setCarrier] = useState(initialCarrier ?? "DHL");
  const [num, setNum] = useState(initialNumber ?? "");
  const [directConfirmed, setDirectConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<SavedResult | null>(null);

  async function save() {
    if (!destination) {
      setError("Choose where this package is going.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/team-order/${orderKey}/inbound-tracking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackingNumber: num,
          carrier,
          destination,
          directConfirmed,
          notify: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save tracking");
      setSaved({
        destination,
        trackingNumber: data.trackingNumber,
        carrier: data.carrier,
        customerNotified: data.customerNotified,
        warning: data.warning,
      });
      setOpen(false);
      if (destination === "slugger") router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="space-y-1.5">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs display text-muted border border-line px-2 py-1 hover:border-brand/50 hover:text-foreground whitespace-nowrap"
        >
          {saved || initialNumber ? "Update production tracking" : "Add production tracking"}
        </button>
        {saved && (
          <p className={`text-xs ${saved.warning ? "text-amber-300" : "text-emerald-300"}`}>
            {saved.destination === "customer"
              ? saved.customerNotified === false
                ? "Tracking saved · customer email needs attention"
                : "Direct shipment saved · customer alerted"
              : "Shipment to Slugger saved"}
            {saved.warning ? ` — ${saved.warning}` : ""}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="min-w-[18rem] max-w-xl space-y-3 rounded-lg border border-line bg-background/60 p-3">
      <fieldset>
        <legend className="text-[11px] display uppercase tracking-wider text-foreground">Where is this package going?</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className={`cursor-pointer rounded border p-2.5 ${destination === "slugger" ? "border-brand bg-brand/10" : "border-line"}`}>
            <span className="flex items-start gap-2">
              <input
                type="radio"
                name={`tracking-destination-${orderKey}`}
                checked={destination === "slugger"}
                onChange={() => {
                  setDestination("slugger");
                  setDirectConfirmed(false);
                  setError("");
                }}
                className="mt-0.5 accent-[color:var(--brand-gold)]"
              />
              <span>
                <span className="display block text-xs text-foreground">To Slugger</span>
                <span className="mt-0.5 block text-[11px] leading-4 text-muted">Internal tracking. The customer is not contacted.</span>
              </span>
            </span>
          </label>
          <label className={`rounded border p-2.5 ${canShipDirect ? "cursor-pointer" : "cursor-not-allowed opacity-60"} ${destination === "customer" ? "border-brand bg-brand/10" : "border-line"}`}>
            <span className="flex items-start gap-2">
              <input
                type="radio"
                name={`tracking-destination-${orderKey}`}
                checked={destination === "customer"}
                disabled={!canShipDirect}
                onChange={() => {
                  setDestination("customer");
                  setError("");
                }}
                className="mt-0.5 accent-[color:var(--brand-gold)]"
              />
              <span>
                <span className="display block text-xs text-foreground">Direct to customer</span>
                <span className="mt-0.5 block text-[11px] leading-4 text-muted">
                  {canShipDirect ? "Marks shipped and sends the customer email/text." : "Final payment is not recorded yet."}
                </span>
              </span>
            </span>
          </label>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-1.5">
        <select value={carrier} onChange={(e) => setCarrier(e.target.value)} className="bg-background border border-line text-xs text-foreground px-1.5 py-1.5" aria-label="Carrier">
          {INBOUND_CARRIERS.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input
          value={num}
          onChange={(e) => setNum(e.target.value)}
          placeholder="Tracking number"
          className="min-w-44 flex-1 bg-background border border-line text-xs text-foreground px-2 py-1.5 font-mono"
        />
      </div>

      {destination === "customer" && (
        <label className="flex cursor-pointer items-start gap-2 rounded border border-amber-400/50 bg-amber-400/10 p-2.5 text-xs text-foreground">
          <input
            type="checkbox"
            checked={directConfirmed}
            onChange={(e) => setDirectConfirmed(e.target.checked)}
            className="mt-0.5 accent-[color:var(--brand-gold)]"
          />
          <span>
            <strong>Confirm this is going directly to the customer.</strong>
            <span className="mt-0.5 block text-[11px] leading-4 text-muted">Saving marks the order shipped and immediately triggers Slugger&apos;s customer notification.</span>
          </span>
        </label>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={busy || !destination || !num.trim() || (destination === "customer" && !directConfirmed)}
          className="text-xs display bg-brand text-on-brand px-3 py-1.5 disabled:opacity-50"
        >
          {busy ? "Saving..." : destination === "customer" ? "Save + alert customer" : "Save tracking"}
        </button>
        <button type="button" onClick={() => setOpen(false)} disabled={busy} className="text-xs text-muted hover:text-foreground">Cancel</button>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    </div>
  );
}
