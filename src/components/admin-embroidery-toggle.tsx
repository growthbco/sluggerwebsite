"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Waive the one-time $20 embroidery setup fee (repeat hat order of a design
 *  that already paid it on the first order). */
export function AdminEmbroideryToggle({ teamOrderId, waived }: { teamOrderId: string; waived: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/team-order/embroidery-fee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamOrderId, waived: !waived }),
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
      title="The $20 embroidery digitizing fee is one-time per hat design - waive it on reorders"
      className={`text-xs display px-2 py-0.5 border disabled:opacity-50 whitespace-nowrap ${
        waived ? "border-brand/60 text-brand bg-brand/10" : "border-line text-muted hover:border-brand/40"
      }`}
    >
      {busy ? "..." : waived ? "Embroidery fee waived ✓" : "Waive $20 embroidery fee"}
    </button>
  );
}
