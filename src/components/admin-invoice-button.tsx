"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Admin action: price the roster and email the coach a payment link. */
export function AdminInvoiceButton({
  teamOrderId,
  teamName,
  estimateCents,
  resend,
}: {
  teamOrderId: string;
  teamName: string;
  estimateCents: number;
  resend?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send() {
    const total = `$${(estimateCents / 100).toFixed(2)}`;
    if (!window.confirm(`Email ${teamName}'s coach an invoice for ${total} with a Stripe payment link?`)) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/team-order/invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamOrderId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send invoice");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span>
      <button
        type="button"
        onClick={send}
        disabled={busy}
        className="text-xs display text-foreground border border-brand/50 px-2.5 py-1 hover:bg-brand/10 disabled:opacity-50"
      >
        {busy ? "Sending..." : resend ? "Re-invoice" : "Send invoice"}
      </button>
      {error && <span className="ml-2 text-xs text-brand">{error}</span>}
    </span>
  );
}
