"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** "Mark all as billed" for the produced-but-not-yet-invoiced list, for when the
 *  designer was paid directly (fully paid up) instead of through the tool. */
export function AdminSettleDesigner({ count }: { count: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function settle() {
    if (!confirm(`Mark all ${count} produced order${count === 1 ? "" : "s"} as already billed & settled with the designer? Use this when you've paid the designer directly, outside the invoice tool. Future produced orders will still show up here.`)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/designer-invoice/settle", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not settle");
      router.refresh();
    } catch (e) {
      alert((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={settle}
      disabled={busy}
      className="text-xs display border border-amber-500/50 text-amber-300 px-3 py-1.5 hover:bg-amber-500/10 disabled:opacity-50 whitespace-nowrap"
    >
      {busy ? "Marking…" : "Mark all as billed"}
    </button>
  );
}
