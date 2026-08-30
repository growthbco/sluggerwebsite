"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  designRequestId: string;
  whiteLabel: boolean;
  estimatedPieces: string | null;
  estimatedFeeCents: number | null;
  locked: boolean;
};

function money(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

/** Records white-label approval before a team order exists. The server carries
 * the flag into any linked order and alerts the design/production thread. */
export function AdminDesignWhiteLabel({ designRequestId, whiteLabel, estimatedPieces, estimatedFeeCents, locked }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/design-request/white-label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designRequestId, whiteLabel: !whiteLabel }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update white-label status");
      router.refresh();
    } catch (error) {
      window.alert((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`mt-4 border p-4 ${whiteLabel ? "border-amber-400/50 bg-amber-400/10" : "border-line bg-steel/50"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <p className={`display text-sm uppercase tracking-[0.12em] ${whiteLabel ? "text-amber-300" : "text-muted"}`}>
            {whiteLabel ? "⚠ White-label confirmed" : "White-label upgrade"}
          </p>
          <p className="mt-1 text-sm text-foreground">
            {whiteLabel
              ? "Production must remove every Slugger mark, including the SA back logo, branded neck label, and branded size/barcode tag."
              : "Standard Slugger branding is currently included on the finished gear."}
          </p>
          <p className="mt-1 text-xs text-muted">
            {estimatedFeeCents !== null && estimatedPieces
              ? `Estimated upgrade: ${money(estimatedFeeCents)} for ${estimatedPieces} pieces. The final invoice recalculates from the actual roster.`
              : "The final fee is $2.50 per actual roster piece, with a $50 order minimum."}
          </p>
          {locked && <p className="mt-2 text-xs text-amber-300">Pricing is locked because an invoice or payment already exists. Update and reissue the invoice from the linked team order.</p>}
        </div>
        {!locked && (
          <button
            type="button"
            onClick={toggle}
            disabled={busy}
            className={`shrink-0 border px-4 py-2 text-sm display disabled:opacity-50 ${
              whiteLabel ? "border-amber-400/60 text-amber-200 hover:bg-amber-400/10" : "border-brand/50 text-brand hover:bg-brand/10"
            }`}
          >
            {busy ? "Saving…" : whiteLabel ? "Remove white-label" : "Mark white-label"}
          </button>
        )}
      </div>
    </section>
  );
}
