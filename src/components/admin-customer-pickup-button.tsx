"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminCustomerPickupButton({ teamOrderId, teamName }: { teamOrderId: string; teamName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function confirmPickup() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/team-order/customer-pickup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamOrderId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not record the pickup.");
      setOpen(false);
      router.refresh();
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="clip-slant bg-brand text-on-brand display text-sm px-5 py-2.5 hover:bg-brand-dark whitespace-nowrap">
        Mark customer picked up
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => !busy && setOpen(false)}>
          <div className="w-full max-w-md border border-line bg-ink" onClick={(event) => event.stopPropagation()}>
            <div className="border-b border-line px-5 py-4">
              <h2 className="display text-xl text-foreground">Confirm customer pickup</h2>
              <p className="mt-1 text-sm text-muted">{teamName}</p>
            </div>
            <div className="space-y-4 p-5">
              <p className="text-sm text-foreground">
                Only confirm after the complete order has been handed to the customer. This records the pickup time, closes the order, notifies the customer, and starts their seven-day reporting window.
              </p>
              {error && <p className="text-sm text-brand">{error}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} disabled={busy} className="min-h-11 border border-line px-4 text-sm text-muted hover:text-foreground disabled:opacity-50">Cancel</button>
                <button type="button" onClick={confirmPickup} disabled={busy} className="min-h-11 bg-brand px-5 display text-sm text-on-brand hover:bg-brand-dark disabled:opacity-50">
                  {busy ? "Recording…" : "Yes, order was picked up"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
