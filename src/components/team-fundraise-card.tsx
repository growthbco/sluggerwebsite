"use client";

import { useState } from "react";

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

/** Coach-facing team-fundraising control on the manage page: set a % markup on
 *  the team store and see how much has been raised. */
export function TeamFundraiseCard({
  token,
  initialPercent,
  raisedCents,
  storeUrl,
}: {
  token: string;
  initialPercent: number;
  raisedCents: number;
  storeUrl: string | null;
}) {
  const [percent, setPercent] = useState(String(initialPercent || ""));
  const [saved, setSaved] = useState(initialPercent);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function save() {
    const p = Number(percent);
    if (!Number.isFinite(p) || p < 0 || p > 100) { setErr("Enter 0-100."); return; }
    setBusy(true); setErr(""); setMsg("");
    try {
      const res = await fetch(`/api/team-order/${token}/fundraise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ percent: p }),
      });
      const d = await res.json();
      if (!res.ok) { setErr(d.error || "Couldn't save"); return; }
      setSaved(d.percent);
      setMsg(d.percent > 0 ? `Fundraiser on: +${d.percent}% added to every item.` : "Fundraiser turned off.");
    } catch { setErr("Connection problem - try again."); }
    finally { setBusy(false); }
  }

  return (
    <section className="border border-line bg-steel p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="display text-lg text-foreground">Team fundraising</h2>
        <span className="display text-brand">{money(raisedCents)} raised</span>
      </div>
      <p className="text-sm text-muted mt-1">
        Add a percentage on top of every store item. Buyers pay a little more and your team keeps the
        difference - no upfront cost. {saved > 0 ? `Currently +${saved}%.` : "Currently off."}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <input
            value={percent}
            onChange={(e) => setPercent(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
            inputMode="numeric"
            placeholder="0"
            className="w-20 bg-ink border border-line px-3 py-2.5 text-base sm:text-sm text-foreground text-right focus:border-brand focus:outline-none"
          />
          <span className="text-foreground">%</span>
        </div>
        <button type="button" onClick={save} disabled={busy}
          className="rounded bg-brand hover:bg-brand-dark text-on-brand display px-5 py-2.5 disabled:opacity-50">
          {busy ? "Saving…" : "Save"}
        </button>
        {storeUrl && (
          <a href={storeUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-brand hover:underline ml-1">View store →</a>
        )}
      </div>
      {msg && <p className="text-sm text-brand mt-2">{msg}</p>}
      {err && <p className="text-sm text-red-400 mt-2">{err}</p>}
    </section>
  );
}
