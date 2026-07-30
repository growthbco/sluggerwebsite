"use client";

import { useState } from "react";

export function PortalRequestForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    if (!email.trim() || busy) return;
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/portal/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Something went wrong"); return; }
      setSent(true);
    } catch {
      setErr("Connection problem - try again.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="bg-steel border border-line p-6 text-center">
        <div className="mx-auto h-12 w-12 grid place-items-center rounded-full bg-brand text-on-brand display text-xl">✓</div>
        <h2 className="display text-xl text-foreground mt-4">Check your email</h2>
        <p className="mt-2 text-muted">
          If <strong className="text-foreground">{email}</strong> has any orders with us, we just sent a secure link to view them. It works for the next 45 minutes.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-steel border border-line p-6">
      <label className="display text-sm text-foreground">Your email</label>
      <p className="text-sm text-muted mt-1">The email you used to order. We&apos;ll send you a secure link - no password needed.</p>
      <div className="mt-3 flex flex-col sm:flex-row gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder="you@email.com"
          className="flex-1 bg-ink border border-line px-3 py-2.5 text-base sm:text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
        />
        <button
          type="button"
          onClick={submit}
          disabled={busy || !email.trim()}
          className="rounded bg-brand hover:bg-brand-dark text-on-brand display px-6 py-2.5 disabled:opacity-50"
        >
          {busy ? "Sending…" : "Email me my orders"}
        </button>
      </div>
      {err && <p className="mt-2 text-sm text-red-400">{err}</p>}
    </div>
  );
}
