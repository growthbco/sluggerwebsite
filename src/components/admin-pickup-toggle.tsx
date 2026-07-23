"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Marks a team order as local pickup - no shipping charged or shown. */
export function AdminPickupToggle({ teamOrderId, pickup }: { teamOrderId: string; pickup: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/team-order/pickup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamOrderId, pickup: !pickup }),
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
      title="Local order - customer picks up in Ocala, no shipping charged"
      className={`text-xs display px-2 py-0.5 border disabled:opacity-50 whitespace-nowrap ${
        pickup ? "border-brand/60 text-brand bg-brand/10" : "border-line text-muted hover:border-brand/40"
      }`}
    >
      {busy ? "..." : pickup ? "🏬 PICKUP ✓" : "+ pickup"}
    </button>
  );
}
