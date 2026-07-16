"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Admin action: paste a tracking number (no label purchase) — used when a
 *  label was bought elsewhere or two orders ship in one box. The customer gets
 *  the "on the way" email with a tracking link and the order flips to shipped.
 *  Fully in-modal so it works cleanly on phones (Android + iOS). */
export function AdminShipButton({
  kind,
  id,
  who,
  existingTracking,
  label,
}: {
  kind: "team_order" | "order";
  id: string;
  who: string;
  /** Tracking already on file (e.g. from a bought label) - pre-fills the box. */
  existingTracking?: string | null;
  /** Override the trigger button text. */
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tracking, setTracking] = useState(existingTracking ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setOpen(false);
    setTracking(existingTracking ?? "");
    setError("");
  }

  async function ship() {
    if (!tracking.trim()) {
      setError("Paste a tracking number first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/ship", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, id, trackingNumber: tracking.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
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
        onClick={() => setOpen(true)}
        className="text-xs display text-foreground border border-brand/50 px-2.5 py-1 hover:bg-brand/10 disabled:opacity-50"
      >
        {label ?? "🚚 Mark shipped"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => !busy && reset()}>
          <div className="w-full max-w-md bg-ink border border-line" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-line">
              <p className="display text-foreground">🚚 Mark shipped — {who}</p>
              <button type="button" onClick={reset} disabled={busy} className="text-muted hover:text-foreground text-xl leading-none">✕</button>
            </div>
            <div className="p-4 space-y-4">
              <label className="block">
                <span className="text-sm text-foreground">Tracking number</span>
                <input
                  value={tracking}
                  onChange={(e) => setTracking(e.target.value)}
                  autoFocus
                  className="mt-1 w-full bg-steel border border-line px-3 py-3 text-lg text-foreground focus:border-brand focus:outline-none"
                  placeholder="e.g. 9400 1000 0000 0000 0000 00"
                />
                <span className="mt-1 block text-xs text-muted">No label is purchased. The customer gets a tracking link and the order flips to shipped.</span>
              </label>
              <button
                type="button"
                onClick={ship}
                disabled={busy}
                className="w-full clip-slant bg-brand text-on-brand display px-6 py-3 hover:bg-brand-dark disabled:opacity-50"
              >
                {busy ? "Marking shipped…" : "Mark shipped"}
              </button>
              {error && <p className="text-sm text-brand">{error}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
