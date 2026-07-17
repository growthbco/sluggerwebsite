"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Marks a team order as Ocala league-family: standard jerseys price at $25. */
export function AdminLocalToggle({ teamOrderId, local }: { teamOrderId: string; local: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/team-order/local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamOrderId, local: !local }),
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
      title="Ocala league teams get standard jerseys at $25 instead of $28"
      className={`text-xs display px-2 py-0.5 border disabled:opacity-50 whitespace-nowrap ${
        local ? "border-brand/60 text-brand bg-brand/10" : "border-line text-muted hover:border-brand/40"
      }`}
    >
      {busy ? "..." : local ? "OCALA $25 ✓" : "+ set Ocala $25"}
    </button>
  );
}
