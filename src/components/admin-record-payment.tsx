"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const METHODS = ["Zelle", "CashApp", "Cash", "Check", "Venmo", "Other"];

/** Record an offline payment (Zelle, CashApp, cash...) on a team order.
 *  Moves the order through the same states a Stripe payment would. */
export function AdminRecordPayment({
  teamOrderId,
  teamName,
  depositPaid,
  suggestedDepositCents,
}: {
  teamOrderId: string;
  teamName: string;
  depositPaid: boolean;
  suggestedDepositCents: number | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState(depositPaid ? "balance" : "deposit");
  const [method, setMethod] = useState("Zelle");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    const dollars = parseFloat(amount);
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/team-order/record-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamOrderId,
          stage,
          method,
          amountCents: isNaN(dollars) ? undefined : Math.round(dollars * 100),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not record the payment");
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs display text-muted border border-line px-2 py-1 hover:border-brand/50 hover:text-foreground whitespace-nowrap"
        title={`Record a Zelle / CashApp / cash payment for ${teamName}`}
      >
        Record payment
      </button>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 bg-steel border border-brand/50 px-2 py-1.5">
      <select value={stage} onChange={(e) => setStage(e.target.value)} className="bg-background border border-line text-xs text-foreground px-1.5 py-1">
        {!depositPaid && <option value="deposit">50% deposit</option>}
        {!depositPaid && <option value="full">Paid in full</option>}
        {depositPaid && <option value="balance">Final balance</option>}
      </select>
      <select value={method} onChange={(e) => setMethod(e.target.value)} className="bg-background border border-line text-xs text-foreground px-1.5 py-1">
        {METHODS.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder={
          stage === "deposit" && suggestedDepositCents
            ? `$${(suggestedDepositCents / 100).toFixed(2)}`
            : "$ amount"
        }
        className="w-20 bg-background border border-line text-xs text-foreground px-1.5 py-1"
        inputMode="decimal"
      />
      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="text-xs display bg-brand text-on-brand px-2 py-1 disabled:opacity-50"
      >
        {busy ? "Saving..." : "Save"}
      </button>
      <button type="button" onClick={() => setOpen(false)} disabled={busy} className="text-xs text-muted hover:text-foreground">
        ✕
      </button>
      {error && <span className="text-xs text-red-400 w-full">{error}</span>}
    </span>
  );
}
