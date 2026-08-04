"use client";

import { useEffect, useState } from "react";
import { INBOUND_CARRIERS, inboundTrackingUrlFor } from "@/lib/tracking";

type Saved = { trackingNumber: string; carrier: string };
type Candidate = { id: string; reference: string; teamName: string; status: string };

/** Designer-only: log the factory -> Slugger shipment tracking. Rendered on
 *  /design/manage (staff link from Discord). The customer never sees this -
 *  their tracking email comes later, when we ship out from Florida. */
export function InboundTracking({
  token,
  initial,
}: {
  token: string;
  initial: Saved | null;
}) {
  const [saved, setSaved] = useState<Saved | null>(initial);
  const [editing, setEditing] = useState(!initial);
  const [carrier, setCarrier] = useState(initial?.carrier ?? "DHL");
  const [num, setNum] = useState(initial?.trackingNumber ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Other open orders that might be riding in the SAME box - checklist so one
  // tracking number can cover every order it contains.
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [also, setAlso] = useState<Set<string>>(new Set());
  const [savedCount, setSavedCount] = useState(0);

  useEffect(() => {
    if (!editing) return;
    fetch(`/api/team-order/${token}/inbound-tracking`)
      .then((r) => (r.ok ? r.json() : { candidates: [] }))
      .then((d) => setCandidates(d.candidates ?? []))
      .catch(() => {});
  }, [editing, token]);

  function toggleAlso(id: string) {
    setAlso((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/team-order/${token}/inbound-tracking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackingNumber: num, carrier, alsoOrderIds: [...also] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save tracking.");
      setSaved({ trackingNumber: data.trackingNumber, carrier: data.carrier });
      setSavedCount(data.applied ?? 1);
      setAlso(new Set());
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save tracking.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bg-steel border border-line p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="display text-lg text-foreground">📦 Shipment to Slugger</h2>
        <span className="text-[10px] display text-muted border border-line px-1.5 py-0.5">
          INTERNAL - CUSTOMER DOES NOT SEE THIS
        </span>
      </div>
      <p className="mt-2 text-sm text-muted">
        Once the order ships from production, drop the tracking number here so the
        shop knows it is on the way to Florida.
      </p>

      {saved && !editing ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <a
            href={inboundTrackingUrlFor(saved.trackingNumber, saved.carrier)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm display text-sky-400 underline decoration-dotted underline-offset-2 hover:text-sky-300"
          >
            {saved.carrier} {saved.trackingNumber}
          </a>
          <span className="text-xs display text-green-400">✓ SHOP NOTIFIED</span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs display text-muted border border-line px-2 py-1 hover:border-brand/50 hover:text-foreground"
          >
            Update
          </button>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <select
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
            className="bg-background border border-line text-sm text-foreground px-2 py-2"
            aria-label="Carrier"
          >
            {INBOUND_CARRIERS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input
            value={num}
            onChange={(e) => setNum(e.target.value)}
            placeholder="Tracking number"
            className="flex-1 min-w-[14rem] bg-background border border-line text-sm text-foreground px-3 py-2 font-mono"
          />
          <button
            type="button"
            onClick={save}
            disabled={busy || !num.trim()}
            className="display text-sm bg-brand text-on-brand px-4 py-2 disabled:opacity-50"
          >
            {busy ? "Saving..." : also.size > 0 ? `Save for ${also.size + 1} orders + notify` : "Save + notify shop"}
          </button>
        </div>
      )}

      {editing && candidates.length > 0 && (
        <div className="mt-4 border border-line bg-background/40 p-3">
          <p className="text-sm text-foreground display">📦 More orders in this same box?</p>
          <p className="text-xs text-muted mt-0.5">Check every order this tracking number covers - it gets applied to all of them and each thread is notified.</p>
          <ul className="mt-2 space-y-1.5">
            {candidates.map((c) => (
              <li key={c.id}>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={also.has(c.id)}
                    onChange={() => toggleAlso(c.id)}
                    className="accent-[color:var(--brand-gold)]"
                  />
                  <span className="text-foreground">{c.teamName}</span>
                  <span className="font-mono text-xs text-muted">{c.reference}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
      {savedCount > 1 && !editing && (
        <p className="mt-2 text-xs text-green-400">Applied to {savedCount} orders in this box.</p>
      )}
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </section>
  );
}
