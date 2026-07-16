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
  warnPrintFile,
}: {
  teamOrderId: string;
  teamName: string;
  dueCents: number;
  stage: "deposit" | "balance";
  resend?: boolean;
  /** True when this order's print file hasn't passed QA yet. */
  warnPrintFile?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const label = stage === "deposit" ? "50% deposit" : "final invoice";

  async function send() {
    const withTax = Math.round(dueCents * 1.07);
    let shipWeightOz = 0;
    // Final invoice: add shipping the customer pays (weight is known now).
    if (stage === "balance") {
      const answer = window.prompt(
        `Shipping for ${teamName}: enter package weight in POUNDS to add live-rate shipping (customer pays it).\n\nLeave blank for free local pickup - no shipping charge.`,
        "2",
      );
      if (answer === null) return; // cancelled
      const lb = parseFloat(answer);
      if (answer.trim() && (!lb || lb <= 0)) {
        window.alert("Enter a weight in pounds like 2.5, or leave blank for pickup.");
        return;
      }
      shipWeightOz = lb > 0 ? Math.round(lb * 16) : 0;
    }
    const shipNote = shipWeightOz > 0 ? " + live shipping" : stage === "balance" ? " (free pickup)" : "";
    const total = `$${(dueCents / 100).toFixed(2)} + 7% tax = $${(withTax / 100).toFixed(2)}${shipNote}`;
    const warning = warnPrintFile
      ? `⚠️ HEADS UP: the print file for ${teamName} has NOT passed AI verification yet. Normal order is print file QA first, then the invoice.\n\n`
      : "";
    if (!window.confirm(`${warning}Email ${teamName}'s coach the ${label} for ${total} with a Stripe payment link?`)) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/team-order/invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamOrderId, stage, shipWeightOz }),
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
