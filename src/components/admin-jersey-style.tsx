"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { JERSEY_STYLES } from "@/lib/team-order-pricing";

/** Admin: change a team order's jersey style (drives the price). Locked once an
 *  invoice has been sent. */
export function AdminJerseyStyle({ teamOrderId, current }: { teamOrderId: string; current: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function change(style: string) {
    if (style === current) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/team-order/jersey-style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamOrderId, jerseyStyle: style }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      router.refresh();
    } catch (e) {
      window.alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <label className="flex items-center gap-1.5 text-xs text-muted whitespace-nowrap" title="Change the jersey style - the price follows the style">
      <span>Style:</span>
      <select
        value={current ?? JERSEY_STYLES[0]}
        onChange={(e) => change(e.target.value)}
        disabled={busy}
        className="bg-ink border border-line px-2 py-0.5 text-xs text-foreground focus:border-brand focus:outline-none disabled:opacity-50"
      >
        {JERSEY_STYLES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
    </label>
  );
}
