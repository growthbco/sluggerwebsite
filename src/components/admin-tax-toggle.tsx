"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Marks a team order tax-exempt (company/org): invoices skip the 7% tax. */
export function AdminTaxToggle({ teamOrderId, exempt }: { teamOrderId: string; exempt: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/team-order/tax-exempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamOrderId, exempt: !exempt }),
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
      title="Tax-exempt companies/orgs pay no sales tax"
      className={`text-xs display px-2 py-0.5 border disabled:opacity-50 ${
        exempt ? "border-brand/60 text-brand bg-brand/10" : "border-line text-muted hover:border-brand/40"
      }`}
    >
      {busy ? "..." : exempt ? "TAX-EXEMPT ✓" : "tax-exempt?"}
    </button>
  );
}
