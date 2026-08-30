"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Toggle the paid per-piece white-label upgrade on a team order. */
export function AdminWhiteLabel({ teamOrderId, whiteLabel }: { teamOrderId: string; whiteLabel: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/team-order/white-label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamOrderId, whiteLabel: !whiteLabel }),
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
      title="Paid upgrade: remove every Slugger mark from the finished gear ($2.50/piece, $50 minimum)"
      className={`text-xs display px-2 py-0.5 border disabled:opacity-50 whitespace-nowrap ${
        whiteLabel ? "border-brand/60 text-brand bg-brand/10" : "border-line text-muted hover:border-brand/40"
      }`}
    >
      {busy ? "..." : whiteLabel ? "WHITE-LABEL ✓" : "white-label?"}
    </button>
  );
}
