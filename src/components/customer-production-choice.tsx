"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { moneyFromCents, RUSH_PRICE_COPY } from "@/lib/customer-policy";
import { rushFeeCentsForPieces } from "@/lib/rush-pricing";

export function CustomerProductionChoice({ rush, pieces, onChange, disabled = false }: {
  rush: boolean; pieces: number; onChange: (rush: boolean) => void; disabled?: boolean;
}) {
  const fee = rushFeeCentsForPieces(Math.max(1, pieces));
  return (
    <fieldset disabled={disabled}>
      <legend className="display text-xl text-foreground">Choose production speed</legend>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {[false, true].map((option) => (
          <label key={String(option)} className={`flex cursor-pointer items-start gap-3 border p-4 ${rush === option ? "border-brand bg-brand/10" : "border-line bg-ink/30"} ${disabled ? "cursor-wait opacity-60" : ""}`}>
            <input type="radio" name="production-speed" checked={rush === option} onChange={() => onChange(option)} className="mt-1 h-4 w-4 shrink-0 accent-brand" />
            <span>
              <span className="display block text-lg text-foreground">{option ? `2-week Rush + shipping included · +${moneyFromCents(fee)}` : "3-week Standard · No rush fee"}</span>
              <span className="mt-1 block text-sm text-muted">{option ? "Expedited production and delivery shipping included. No additional shipping charge. Full payment required before production." : "Shipping calculated separately by weight, or free Ocala pickup. 50% deposit required before production."}</span>
            </span>
          </label>
        ))}
      </div>
      <p className="mt-3 text-sm text-muted">Rush: {RUSH_PRICE_COPY}. The fee updates with your order size, not the number of players.</p>
      <p className="mt-2 text-sm text-muted">Production starts after final artwork approval, final roster submission, and the required payment. Shipping time is additional. Selecting Rush does not guarantee your in-hand date; Slugger must confirm availability.</p>
    </fieldset>
  );
}

export function SavedProductionChoice({ token, rush, pieces, updatedAt, locked }: {
  token: string; rush: boolean; pieces: number; updatedAt: string; locked: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(nextRush: boolean) {
    if (busy || nextRush === rush) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/team-order/${token}/service`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service: nextRush ? "rush" : "standard", updatedAt }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save production speed.");
      // Reload all invoice links, totals, timing and confirmation state together.
      window.location.reload();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not confirm the change. Refresh to check the order.");
      setBusy(false);
    }
  }
  return (
    <section id="production-speed" className="scroll-mt-6 rounded-xl border border-brand/40 bg-steel p-5">
      {locked ? (
        <><h2 className="display text-xl text-foreground">Production speed</h2><p className="mt-2 text-sm text-muted">For a submitted, invoiced, paid order or a staff-arranged timeline, contact Slugger to review a change. Your current pricing and production schedule will stay unchanged.</p><a href="sms:+13524147270" className="mt-3 inline-flex min-h-11 items-center text-brand underline">Text us about rush</a></>
      ) : (
        <>
          <CustomerProductionChoice rush={rush} pieces={pieces} onChange={save} disabled={busy} />
          <p className="mt-3 text-sm text-muted">Choose your speed before submitting. Saved roster entries stay in place; finish adding any unsaved entry before changing speed.</p>
          {busy && <p role="status" className="mt-3 text-sm text-brand">Saving production speed and updating your total…</p>}
          {error && <div role="alert" className="mt-3 text-sm text-amber-300">{error} <button type="button" onClick={() => router.refresh()} className="underline">Refresh order</button></div>}
        </>
      )}
    </section>
  );
}
