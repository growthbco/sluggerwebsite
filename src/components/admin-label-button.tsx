"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Rate = { rateId: string; provider: string; service: string; costCents: number; estimatedDays: number | null };

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

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

  if (rates) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        {rates.map((r) => (
          <button
            key={r.rateId}
            type="button"
            onClick={() => buy(r)}
            disabled={busy}
            className="text-xs display text-foreground border border-brand/50 px-2 py-1 hover:bg-brand/10 disabled:opacity-50"
            title={r.estimatedDays ? `~${r.estimatedDays} days` : undefined}
          >
            {r.provider} {money(r.costCents)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setRates(null)}
          className="text-xs text-muted hover:text-foreground px-1"
          aria-label="Cancel"
        >
          ✕
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={quote}
      disabled={busy}
      className="text-xs display text-foreground border border-brand/50 px-2.5 py-1 hover:bg-brand/10 disabled:opacity-50"
    >
      {busy ? "..." : "🏷 Buy label"}
    </button>
  );
}
