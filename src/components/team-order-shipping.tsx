"use client";

import { useState } from "react";

type Addr = { line1: string; line2: string; city: string; state: string; postalCode: string };

/** Per-order shipping address, editable by the customer from the order page.
 *  Prefilled from whatever is on the order (which the portal seeds from their
 *  saved address). Locked once the order has shipped. */
export function TeamOrderShipping({ token, initial, locked }: { token: string; initial: Addr | null; locked?: boolean }) {
  const [a, setA] = useState<Addr>({
    line1: initial?.line1 ?? "",
    line2: initial?.line2 ?? "",
    city: initial?.city ?? "",
    state: initial?.state ?? "",
    postalCode: initial?.postalCode ?? "",
  });
  const [editing, setEditing] = useState(!initial?.line1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const set = (k: keyof Addr) => (e: React.ChangeEvent<HTMLInputElement>) => setA((p) => ({ ...p, [k]: e.target.value }));

  const oneLine = [a.line1, a.line2, [a.city, a.state].filter(Boolean).join(", "), a.postalCode].filter(Boolean).join(" · ");

  async function save() {
    if (busy) return;
    setBusy(true); setErr(""); setMsg("");
    try {
      const r = await fetch(`/api/team-order/${token}/address`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: a }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Couldn't save"); return; }
      setMsg("Shipping address saved for this order.");
      setEditing(false);
    } catch { setErr("Connection problem - try again."); }
    finally { setBusy(false); }
  }

  const inputCls = "w-full bg-ink border border-line px-3 py-2.5 text-base sm:text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none";

  return (
    <section className="border border-line bg-steel p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="display text-foreground">Shipping address for this order</h3>
        {locked ? (
          <span className="text-xs text-muted">Shipped - locked</span>
        ) : !editing ? (
          <button type="button" onClick={() => setEditing(true)} className="text-xs display text-brand border border-brand/50 px-2.5 py-1 rounded hover:bg-brand/10">Edit</button>
        ) : null}
      </div>

      {!editing ? (
        <p className="text-sm text-muted mt-1">{oneLine || "No address on file yet."}</p>
      ) : (
        <div className="mt-3 grid sm:grid-cols-2 gap-3">
          <input className={`sm:col-span-2 ${inputCls}`} value={a.line1} onChange={set("line1")} placeholder="Street address" />
          <input className={`sm:col-span-2 ${inputCls}`} value={a.line2} onChange={set("line2")} placeholder="Apt / unit (optional)" />
          <input className={inputCls} value={a.city} onChange={set("city")} placeholder="City" />
          <div className="grid grid-cols-2 gap-3">
            <input className={inputCls} value={a.state} onChange={set("state")} placeholder="State" maxLength={20} />
            <input className={inputCls} value={a.postalCode} onChange={set("postalCode")} placeholder="ZIP" inputMode="numeric" maxLength={10} />
          </div>
          <div className="sm:col-span-2 flex items-center gap-3">
            <button type="button" onClick={save} disabled={busy} className="rounded bg-brand hover:bg-brand-dark text-on-brand display px-5 py-2 disabled:opacity-50">{busy ? "Saving…" : "Save address"}</button>
            {err && <span className="text-sm text-red-400">{err}</span>}
          </div>
        </div>
      )}
      {msg && !editing && <p className="text-sm text-brand mt-2">{msg}</p>}
      <p className="text-xs text-muted mt-2">Shipping is calculated from your ZIP when we send the final invoice, so it is safe to update while your order is being made.</p>
    </section>
  );
}
