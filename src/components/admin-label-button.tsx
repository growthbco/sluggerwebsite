"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Rate = { rateId: string; provider: string; service: string; costCents: number; estimatedDays: number | null };

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

/** Estimated arrival = today + N business days (carriers quote business days). */
function arrivalLabel(days: number | null): string {
  if (days == null) return "delivery estimate varies";
  const d = new Date();
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added += 1;
  }
  const date = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  return `Arrives ~${date} (${days} ${days === 1 ? "day" : "days"})`;
}

/** Buy a real USPS/UPS label via Shippo: enter the package weight, pick the
 *  rate, confirm. Tracking saves + customer email fires automatically. */
export function AdminLabelButton({
  kind,
  id,
  who,
  suggestedLb,
}: {
  kind: "team_order" | "order";
  id: string;
  who: string;
  suggestedLb?: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [rates, setRates] = useState<Rate[] | null>(null);

  async function quote() {
    const answer = window.prompt(`Package weight for ${who}, in pounds:`, String(suggestedLb ?? 2));
    if (!answer) return;
    const lb = parseFloat(answer);
    if (!lb || lb <= 0) return window.alert("Enter a weight in pounds, like 2.5");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "quote", kind, id, weightOz: Math.round(lb * 16) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not get rates");
      setRates(data.rates);
    } catch (e) {
      window.alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function buy(rate: Rate) {
    if (!window.confirm(`Buy ${rate.provider} ${rate.service} label for ${money(rate.costCents)}? This charges your Shippo account.`)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "buy", kind, id, rateId: rate.rateId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Purchase failed");
      window.open(data.labelUrl, "_blank");
      setRates(null);
      router.refresh();
    } catch (e) {
      window.alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={quote}
        disabled={busy}
        className="text-xs display text-foreground border border-brand/50 px-2.5 py-1 hover:bg-brand/10 disabled:opacity-50"
      >
        {busy && !rates ? "..." : "🏷 Buy label"}
      </button>

      {/* Rates in a centered overlay so the table row never stretches or clips. */}
      {rates && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
          onClick={() => !busy && setRates(null)}
        >
          <div
            className="w-full max-w-md bg-ink border border-line max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-line sticky top-0 bg-ink">
              <p className="display text-foreground">Buy label — {who}</p>
              <button type="button" onClick={() => setRates(null)} disabled={busy} className="text-muted hover:text-foreground text-lg leading-none">✕</button>
            </div>
            <p className="px-4 pt-3 text-xs text-muted">Pick a service. The label buys at cost; the customer was already charged shipping on their invoice.</p>
            <div className="p-4 space-y-2">
              {rates.map((r) => (
                <button
                  key={r.rateId}
                  type="button"
                  onClick={() => buy(r)}
                  disabled={busy}
                  className="w-full flex items-center justify-between gap-3 border border-line hover:border-brand/60 hover:bg-brand/5 px-4 py-3 text-left disabled:opacity-50"
                >
                  <span>
                    <span className="display text-sm text-foreground">{r.provider} {r.service}</span>
                    <span className="block text-xs text-muted mt-0.5">{arrivalLabel(r.estimatedDays)}</span>
                  </span>
                  <span className="display text-base text-foreground shrink-0">{money(r.costCents)}</span>
                </button>
              ))}
            </div>
            <div className="px-4 pb-4">
              <button
                type="button"
                onClick={() => setRates(null)}
                disabled={busy}
                className="w-full text-xs display text-muted border border-line py-2 hover:border-brand/50"
              >
                {busy ? "Buying label…" : "Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
