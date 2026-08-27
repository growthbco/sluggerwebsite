"use client";

import { useState } from "react";

/** Schedule a FREE USPS pickup at the shop for an order's USPS labels. Shows
 *  only when the order has USPS labels on file. Next business day is the
 *  default; USPS collects with the regular mail. */
export function AdminPickupButton({ kind, id }: { kind: "team_order" | "order"; id: string }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(nextBusinessDay());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  function nextBusinessDay(): string {
    const d = new Date();
    do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0); // skip Sunday
    return d.toISOString().slice(0, 10);
  }

  async function schedule() {
    setBusy(true);
    setError("");
    setMsg("");
    try {
      const res = await fetch("/api/admin/pickup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, id, date }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not schedule");
      if (data.alreadyScheduled) {
        setMsg("A USPS pickup is already booked - just leave these by the door and they'll be collected too.");
      } else {
        setMsg(`USPS pickup scheduled for ${new Date(date + "T12:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}. Confirmation: ${data.confirmation}`);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (msg) return <span className="text-xs display text-green-400 whitespace-nowrap">{msg}</span>;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs display text-foreground border border-brand/50 px-2.5 py-1 hover:bg-brand/10 whitespace-nowrap"
      >
        Schedule free USPS pickup
      </button>
      {open && (
        <span className="inline-flex items-center gap-1.5">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-background border border-line px-2 py-1 text-xs text-foreground"
          />
          <button type="button" onClick={schedule} disabled={busy} className="text-xs display bg-brand text-on-brand px-2.5 py-1 disabled:opacity-50">
            {busy ? "…" : "Confirm"}
          </button>
        </span>
      )}
      {error && <span className="text-xs text-red-400">{error}</span>}
    </>
  );
}
