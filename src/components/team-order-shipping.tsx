"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CustomerDeliveryChoice } from "@/components/customer-delivery-choice";

type Addr = { line1: string; line2: string; city: string; state: string; postalCode: string };

/** Customer-selected fulfillment method and per-order shipping address. A
 * delivery-method change refreshes any unpaid invoice so checkout agrees with
 * the choice shown here. */
export function TeamOrderShipping({
  token,
  initial,
  localPickup: initialPickup,
  rushShipping = false,
  locked = false,
  deliveryLocked = false,
}: {
  token: string;
  initial: Addr | null;
  localPickup: boolean;
  rushShipping?: boolean;
  locked?: boolean;
  deliveryLocked?: boolean;
}) {
  const router = useRouter();
  const [a, setA] = useState<Addr>({
    line1: initial?.line1 ?? "",
    line2: initial?.line2 ?? "",
    city: initial?.city ?? "",
    state: initial?.state ?? "",
    postalCode: initial?.postalCode ?? "",
  });
  const [savedPickup, setSavedPickup] = useState(initialPickup);
  const [pickup, setPickup] = useState(initialPickup);
  const [editing, setEditing] = useState(!initialPickup && !initial?.line1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const set = (key: keyof Addr) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setA((previous) => ({ ...previous, [key]: event.target.value }));

  const oneLine = [a.line1, a.line2, [a.city, a.state].filter(Boolean).join(", "), a.postalCode]
    .filter(Boolean)
    .join(" · ");

  async function persist(localPickup: boolean, address?: Addr) {
    if (busy) return;
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const response = await fetch(`/api/team-order/${token}/delivery`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ localPickup, ...(address ? { address } : {}) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not update delivery");
      setSavedPickup(localPickup);
      setPickup(localPickup);
      setEditing(false);
      setMsg(
        data.invoiceReissued
          ? localPickup
            ? "Local pickup saved. We emailed a replacement payment link with no shipping charge."
            : "Direct shipping saved. We emailed a replacement payment link with the correct delivery details."
          : localPickup
            ? "Free local pickup saved for this order."
            : "Shipping address saved for this order.",
      );
      router.refresh();
    } catch (error) {
      setPickup(savedPickup);
      setEditing(!savedPickup && !a.line1);
      setErr((error as Error).message || "Connection problem - try again.");
    } finally {
      setBusy(false);
    }
  }

  function choose(nextPickup: boolean) {
    if (nextPickup === pickup || busy || locked || deliveryLocked) return;
    if (nextPickup) {
      void persist(true);
      return;
    }
    setPickup(false);
    setEditing(true);
    setErr("");
    setMsg("");
  }

  const inputCls = "w-full bg-ink border border-line px-3 py-2.5 text-base sm:text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none";

  return (
    <section className="border border-line bg-steel p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="display text-foreground">Delivery for this order</h3>
        {(locked || deliveryLocked) && (
          <span className="text-xs text-muted">{locked ? "Fulfillment started - locked" : "Delivery method locked after payment"}</span>
        )}
      </div>

      <div className="mt-3">
        <CustomerDeliveryChoice
          localPickup={pickup}
          onChange={choose}
          disabled={locked || deliveryLocked || busy}
          rushShipping={rushShipping}
          name="saved-order-delivery-method"
        />
      </div>

      {pickup ? (
        <div className="mt-4 border border-brand/40 bg-brand/[0.06] p-3">
          <p className="display text-sm text-foreground">Pickup in Ocala · $0 shipping</p>
          <p className="mt-1 text-xs text-muted">We will contact you with pickup details as soon as the full order is ready.</p>
        </div>
      ) : !editing ? (
        <div className="mt-4 flex items-start justify-between gap-3 border-t border-line pt-4">
          <div>
            <p className="display text-sm text-foreground">Shipping address</p>
            <p className="mt-1 text-sm text-muted">{oneLine || "No address on file yet."}</p>
          </div>
          {!locked && (
            <button type="button" onClick={() => setEditing(true)} className="inline-flex min-h-11 items-center rounded border border-brand/50 px-3 py-1 text-xs display text-brand hover:bg-brand/10">Edit</button>
          )}
        </div>
      ) : (
        <div className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
          <p className="sm:col-span-2 display text-sm text-foreground">Where should we ship it?</p>
          <input className={`sm:col-span-2 ${inputCls}`} value={a.line1} onChange={set("line1")} placeholder="Street address" autoComplete="street-address" />
          <input className={`sm:col-span-2 ${inputCls}`} value={a.line2} onChange={set("line2")} placeholder="Apt / unit (optional)" />
          <input className={inputCls} value={a.city} onChange={set("city")} placeholder="City" autoComplete="address-level2" />
          <div className="grid grid-cols-2 gap-3">
            <input className={inputCls} value={a.state} onChange={set("state")} placeholder="State" autoComplete="address-level1" maxLength={20} />
            <input className={inputCls} value={a.postalCode} onChange={set("postalCode")} placeholder="ZIP" autoComplete="postal-code" inputMode="numeric" maxLength={10} />
          </div>
          <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => void persist(false, a)} disabled={busy} className="rounded bg-brand px-5 py-2 display text-on-brand hover:bg-brand-dark disabled:opacity-50">{busy ? "Updating…" : "Save shipping"}</button>
            {savedPickup && (
              <button
                type="button"
                onClick={() => { setPickup(true); setEditing(false); setErr(""); }}
                disabled={busy}
                className="rounded border border-line px-4 py-2 text-sm display text-foreground hover:border-brand/50 disabled:opacity-50"
              >
                Keep local pickup
              </button>
            )}
          </div>
        </div>
      )}

      {err && <p className="mt-3 text-sm text-red-400" role="alert">{err}</p>}
      {msg && <p className="mt-3 text-sm text-brand" role="status">{msg}</p>}
      {!pickup && <p className="mt-2 text-xs text-muted">Shipping is calculated from the order weight and destination. You can update this address until fulfillment starts.</p>}
    </section>
  );
}
