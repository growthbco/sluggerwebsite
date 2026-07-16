"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

/** Admin action: send the 50% deposit invoice or the final balance invoice.
 *  In-modal review of the amount (and, on the final invoice, ship vs. free
 *  local pickup) before anything is emailed. No browser dialogs, so it works
 *  cleanly on phones. */
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
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ship, setShip] = useState<"auto" | "pickup">("auto");

  const label = stage === "deposit" ? "50% deposit" : "final invoice";
  const withTax = Math.round(dueCents * 1.07);

  function reset() {
    setOpen(false);
    setError("");
  }

  async function send() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/team-order/invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamOrderId, stage, ship: stage === "balance" ? ship : "pickup" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send invoice");
      reset();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs display text-foreground border border-brand/50 px-2.5 py-1 hover:bg-brand/10 disabled:opacity-50"
      >
        {`${resend ? "Re-send" : "Send"} ${label}`}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => !busy && reset()}>
          <div className="w-full max-w-md bg-ink border border-line max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-line sticky top-0 bg-ink">
              <p className="display text-foreground">{resend ? "Re-send" : "Send"} {label} — {teamName}</p>
              <button type="button" onClick={reset} disabled={busy} className="text-muted hover:text-foreground text-xl leading-none">✕</button>
            </div>

            <div className="p-4 space-y-4">
              {warnPrintFile && (
                <div className="border border-brand/50 bg-brand/10 p-3 text-xs text-foreground">
                  ⚠️ Heads up: the print file for {teamName} hasn&apos;t passed AI verification yet. The normal order is print-file QA first, then the invoice.
                </div>
              )}

              <div className="border border-line p-3 text-sm text-foreground">
                <div className="flex justify-between"><span className="text-muted">{label === "50% deposit" ? "Deposit" : "Balance"}</span><span>{money(dueCents)}</span></div>
                <div className="flex justify-between"><span className="text-muted">FL sales tax (7%)</span><span>{money(withTax - dueCents)}</span></div>
                {stage === "balance" && ship === "auto" && (
                  <div className="flex justify-between"><span className="text-muted">Shipping</span><span className="text-muted">auto (live carrier rate)</span></div>
                )}
                <div className="flex justify-between mt-1 pt-1 border-t border-line display"><span>Emailed to coach</span><span>{money(withTax)}{stage === "balance" && ship === "auto" ? " + ship" : ""}</span></div>
              </div>

              {stage === "balance" && (
                <div className="space-y-2">
                  <span className="text-sm text-foreground">Delivery</span>
                  <button
                    type="button"
                    onClick={() => setShip("auto")}
                    className={`w-full text-left border px-3 py-2.5 ${ship === "auto" ? "border-brand bg-brand/10" : "border-line hover:border-brand/50"}`}
                  >
                    <span className="display text-sm text-foreground">📦 Ship it</span>
                    <span className="block text-xs text-muted mt-0.5">Auto-calculated shipping from the roster weight, charged to the customer.</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShip("pickup")}
                    className={`w-full text-left border px-3 py-2.5 ${ship === "pickup" ? "border-brand bg-brand/10" : "border-line hover:border-brand/50"}`}
                  >
                    <span className="display text-sm text-foreground">🏬 Free local pickup</span>
                    <span className="block text-xs text-muted mt-0.5">No shipping charge.</span>
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={send}
                disabled={busy}
                className="w-full clip-slant bg-brand text-on-brand display px-6 py-3 hover:bg-brand-dark disabled:opacity-50"
              >
                {busy ? "Sending…" : `Email ${label} to coach`}
              </button>
              {error && <p className="text-sm text-brand">{error}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
