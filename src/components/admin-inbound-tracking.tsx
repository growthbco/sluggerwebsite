"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { INBOUND_CARRIERS } from "@/lib/tracking";

/** Enter or update the factory -> Slugger inbound tracking straight from the
 *  admin row menu (same endpoint the designer uses, minus the notify email). */
export function AdminInboundTracking({
  manageToken,
  initialCarrier,
  initialNumber,
}: {
  manageToken: string;
  initialCarrier: string | null;
  initialNumber: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [carrier, setCarrier] = useState(initialCarrier ?? "DHL");
  const [num, setNum] = useState(initialNumber ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/team-order/${manageToken}/inbound-tracking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackingNumber: num, carrier, notify: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save tracking");
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Factory to Slugger shipment - internal only, never shown to the customer"
        className="text-xs display text-muted border border-line px-2 py-1 hover:border-brand/50 hover:text-foreground whitespace-nowrap"
      >
        {initialNumber ? "Update inbound tracking" : "Add inbound tracking"}
      </button>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <select value={carrier} onChange={(e) => setCarrier(e.target.value)} className="bg-background border border-line text-xs text-foreground px-1.5 py-1">
        {INBOUND_CARRIERS.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <input
        value={num}
        onChange={(e) => setNum(e.target.value)}
        placeholder="Tracking number"
        className="w-40 bg-background border border-line text-xs text-foreground px-1.5 py-1 font-mono"
      />
      <button type="button" onClick={save} disabled={busy || !num.trim()} className="text-xs display bg-brand text-on-brand px-2 py-1 disabled:opacity-50">
        {busy ? "Saving..." : "Save"}
      </button>
      <button type="button" onClick={() => setOpen(false)} disabled={busy} className="text-xs text-muted hover:text-foreground">✕</button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </span>
  );
}
