"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Toggle the piece-count-based two-week rush order fee.
 *  Auto-set when the order comes from a rush design request. */
export function AdminRushToggle({ teamOrderId, rush }: { teamOrderId: string; rush: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/team-order/rush-fee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamOrderId, rush: !rush }),
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
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      title="Two-week rush target: $100 for 1–49 pieces or $150 for 50+ pieces; must be confirmed before production"
      className={`text-xs display px-2 py-0.5 border disabled:opacity-50 whitespace-nowrap ${
        rush ? "border-red-500/70 text-red-400 bg-red-500/10" : "border-line text-muted hover:border-brand/40"
      }`}
    >
      {busy ? "..." : rush ? "2-week rush ON" : "Add 2-week rush ($100)"}
    </button>
  );
}
