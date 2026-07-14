"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Admin action: send the 50% deposit invoice or the final balance invoice.
 *  Confirms the exact amount before anything is emailed. */
export function AdminInvoiceButton({
  teamOrderId,
  teamName,
  dueCents,
  stage,
  resend,
}: {
  teamOrderId: string;
  teamName: string;
  dueCents: number;
  stage: "deposit" | "balance";
  resend?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const label = stage === "deposit" ? "50% deposit" : "final invoice";

  async function send() {
    const total = `$${(dueCents / 100).toFixed(2)}`;
    if (!window.confirm(`Email ${teamName}'s coach the ${label} for ${total} with a Stripe payment link?`)) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/team-order/invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamOrderId, stage }),
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
        {busy ? "Sending..." : `${resend ? "Re-send" : "Send"} ${label}`}
      </button>
      {error && <span className="ml-2 text-xs text-brand">{error}</span>}
    </span>
  );
}
