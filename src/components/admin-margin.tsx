"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

/** Per-order margin: goods revenue minus the designer/factory cost. Uses the
 *  RECORDED actual cost when set, otherwise our cost-list estimate (which
 *  excludes duty + inbound shipping, so it reads a bit rosy). Staff can record
 *  the real amount they paid so margin is true, not a guess. */
export function AdminMargin({
  teamOrderId,
  goodsCents,
  recordedCostCents,
  estimatedCostCents,
}: {
  teamOrderId: string;
  goodsCents: number;
  recordedCostCents: number | null;
  estimatedCostCents: number | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [val, setVal] = useState(recordedCostCents != null ? (recordedCostCents / 100).toFixed(2) : "");
  const [error, setError] = useState("");

  const isRecorded = recordedCostCents != null;
  const costCents = isRecorded ? recordedCostCents : estimatedCostCents ?? 0;
  const haveCost = isRecorded || estimatedCostCents != null;
  const marginCents = goodsCents - costCents;
  const marginPct = goodsCents > 0 ? Math.round((marginCents / goodsCents) * 100) : 0;
  const marginTone = marginPct >= 45 ? "text-green-400" : marginPct >= 30 ? "text-amber-300" : "text-red-400";

  async function save(clear = false) {
    setBusy(true);
    setError("");
    try {
      let cents: number | null = null;
      if (!clear) {
        cents = Math.round(parseFloat(val || "0") * 100);
        if (Number.isNaN(cents) || cents < 0) throw new Error("Enter a dollar amount");
      }
      const res = await fetch("/api/admin/team-order/designer-cost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamOrderId, cents }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Could not save");
      if (clear) setVal("");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border border-line bg-steel p-4">
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <div className="text-xs display text-muted uppercase tracking-wide">Goods revenue</div>
          <div className="display text-lg text-foreground tabular-nums">{money(goodsCents)}</div>
        </div>
        <div>
          <div className="text-xs display text-muted uppercase tracking-wide">Designer cost</div>
          <div className={`display text-lg tabular-nums ${isRecorded ? "text-foreground" : "text-muted"}`}>
            {haveCost ? `${isRecorded ? "" : "~"}${money(costCents)}` : "-"}
          </div>
          <div className="text-[10px] text-muted/70">{isRecorded ? "recorded" : "estimated (no duty/ship)"}</div>
        </div>
        <div>
          <div className="text-xs display text-muted uppercase tracking-wide">Gross margin</div>
          <div className={`display text-lg tabular-nums ${haveCost ? marginTone : "text-muted"}`}>
            {haveCost ? `${money(marginCents)}` : "-"}
          </div>
          <div className={`text-[10px] ${haveCost ? marginTone : "text-muted/70"}`}>{haveCost ? `${marginPct}%` : "record cost"}</div>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-line/60 flex flex-wrap items-center gap-2">
        <label className="text-xs display text-muted">Actual designer cost paid</label>
        <span className="text-muted">$</span>
        <input
          value={val}
          onChange={(e) => setVal(e.target.value.replace(/[^0-9.]/g, ""))}
          placeholder={estimatedCostCents != null ? (estimatedCostCents / 100).toFixed(2) : "0.00"}
          inputMode="decimal"
          className="w-24 bg-ink border border-line px-2 py-1 text-sm text-foreground focus:border-brand focus:outline-none"
        />
        <button type="button" onClick={() => save(false)} disabled={busy} className="text-xs display bg-brand text-on-brand px-3 py-1.5 hover:bg-brand-dark disabled:opacity-50">
          {busy ? "…" : "Save"}
        </button>
        {isRecorded && (
          <button type="button" onClick={() => save(true)} disabled={busy} className="text-xs display text-muted border border-line px-3 py-1.5 hover:text-foreground disabled:opacity-50">
            Clear
          </button>
        )}
        {error && <span className="text-xs text-brand">{error}</span>}
      </div>
      <p className="mt-2 text-[11px] text-muted/70">Margin is goods only (tax + shipping excluded). Duty + inbound shipping aren&apos;t in the estimate, so record what you actually paid the designer for a true number.</p>
    </div>
  );
}
