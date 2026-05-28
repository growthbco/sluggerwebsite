"use client";

import { useState } from "react";
import { ITEM_TYPES } from "@/lib/order-items";

export function SelfEntryForm({ token, items }: { token: string; items: string[] }) {
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [sizes, setSizes] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  const selected = ITEM_TYPES.filter((t) => (items.length ? items : ["jersey"]).includes(t.key));
  const inputCls =
    "w-full bg-steel border border-line px-3 py-2.5 text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none";

  function setSize(key: string, value: string) {
    setSizes((s) => ({ ...s, [key]: value }));
  }

  const hasSize = Object.values(sizes).some(Boolean);

  async function submit() {
    setStatus("sending");
    setMessage("");
    try {
      const res = await fetch(`/api/team-order/${token}/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerName: name, playerNumber: number, sizes, notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save");
      setStatus("done");
    } catch (e) {
      setStatus("error");
      setMessage((e as Error).message);
    }
  }

  if (status === "done") {
    return (
      <div className="bg-steel border border-line p-8 text-center">
        <div className="mx-auto h-12 w-12 grid place-items-center clip-slant bg-brand text-on-brand display text-xl">✓</div>
        <h2 className="display text-2xl text-foreground mt-4">You&apos;re on the roster, {name || "player"}!</h2>
        <p className="mt-3 text-muted">Your details were sent to your coach.</p>
        <button
          onClick={() => { setName(""); setNumber(""); setSizes({}); setNotes(""); setStatus("idle"); }}
          className="mt-6 clip-slant bg-steel border border-line text-foreground display text-sm px-5 py-2.5 hover:border-brand/50"
        >
          Add another player
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="display text-sm text-foreground">Your Name * <span className="text-muted normal-case">(prints in CAPS)</span></label>
        <input className={`mt-2 ${inputCls}`} value={name} onChange={(e) => setName(e.target.value)} placeholder="Last name" />
      </div>
      <div>
        <label className="display text-sm text-foreground">Number</label>
        <input className={`mt-2 ${inputCls} max-w-32`} value={number} onChange={(e) => setNumber(e.target.value)} placeholder="#" maxLength={4} />
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {selected.map((t) => (
          <div key={t.key}>
            <label className="display text-sm text-foreground">{t.label} Size *</label>
            <select className={`mt-2 ${inputCls}`} value={sizes[t.key] ?? ""} onChange={(e) => setSize(t.key, e.target.value)}>
              <option value="">Select</option>
              {t.sizes.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        ))}
      </div>

      <div>
        <label className="display text-sm text-foreground">Notes (optional)</label>
        <input className={`mt-2 ${inputCls}`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. long sleeve" />
      </div>

      {status === "error" && <p className="text-sm text-brand">{message}</p>}

      <button
        onClick={submit}
        disabled={status === "sending" || !name || !hasSize}
        className="w-full clip-slant bg-brand hover:bg-brand-dark text-on-brand display text-lg py-3.5 transition-colors disabled:opacity-60"
      >
        {status === "sending" ? "Adding…" : "Add Me to the Roster"}
      </button>
    </div>
  );
}
