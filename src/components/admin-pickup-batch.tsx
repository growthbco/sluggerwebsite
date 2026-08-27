"use client";

import { useState } from "react";

/** Book ONE free USPS pickup covering every ready package at once - pick a
 *  date, confirm, done. USPS collects with the regular mail; the carrier grabs
 *  whatever's by the door, so there's no need to schedule each order on its
 *  own. */
export function AdminPickupBatch({ count }: { count: number }) {
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
        body: JSON.stringify({ mode: "batch", date }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not schedule");
      const when = new Date(date + "T12:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
      const pkgs = `${data.count} package${data.count === 1 ? "" : "s"}`;
      if (data.alreadyScheduled) {
        setMsg(`A USPS pickup is already on the books, so you're all set. Leave these ${pkgs} by the front door and the carrier takes them with the rest. Nothing else to do.`);
      } else {
        setMsg(`USPS pickup booked for ${when} - ${pkgs}. Confirmation ${data.confirmation}. Leave them by the front door.`);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (msg) {
    return (
      <div className="border border-green-500/40 bg-green-500/10 px-4 py-4 text-sm text-green-300 display">
        {msg}
      </div>
    );
  }

  return (
    <div className="border border-brand/40 bg-brand/5 px-4 py-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="display text-lg text-foreground">
            {count} package{count === 1 ? "" : "s"} ready to hand off
          </p>
          <p className="text-xs text-muted mt-1">
            One pickup covers them all. The mail carrier grabs everything by the door - no need to list each package or weigh them.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <label className="block">
            <span className="block text-xs text-muted mb-1">Pickup date</span>
            <input
              type="date"
              value={date}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDate(e.target.value)}
              className="bg-background border border-line px-3 py-2 text-sm text-foreground"
            />
          </label>
          <button
            type="button"
            onClick={schedule}
            disabled={busy || count === 0}
            className="display bg-brand text-on-brand px-4 py-2 text-sm disabled:opacity-50 whitespace-nowrap"
          >
            {busy ? "Booking…" : "Schedule pickup"}
          </button>
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </div>
  );
}
