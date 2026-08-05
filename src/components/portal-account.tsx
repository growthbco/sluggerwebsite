"use client";

import { useState } from "react";
import { SmsConsentNote } from "@/components/sms-consent";

type Profile = { name: string | null; phone: string | null; referralCode: string; referralCreditCents: number; hasPassword: boolean };

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

export function PortalAccount({ token, profile, referralUrl }: { token: string; profile: Profile; referralUrl: string }) {
  return (
    <div className="space-y-8">
      <ContactCard token={token} name={profile.name} phone={profile.phone} />
      <ReferralCard referralUrl={referralUrl} creditCents={profile.referralCreditCents} />
      <PasswordCard token={token} hasPassword={profile.hasPassword} />
    </div>
  );
}

function ContactCard({ token, name, phone }: { token: string; name: string | null; phone: string | null }) {
  const [n, setN] = useState(name ?? "");
  const [p, setP] = useState(phone ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function save() {
    if (busy) return;
    setBusy(true); setErr(""); setMsg("");
    try {
      const r = await fetch("/api/portal/contact", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name: n.trim(), phone: p.trim() }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Couldn't save"); return; }
      setMsg("Saved. Your info is updated on every order.");
    } catch { setErr("Connection problem - try again."); }
    finally { setBusy(false); }
  }

  return (
    <section className="border border-line bg-steel p-5">
      <h2 className="display text-lg text-foreground">Your details</h2>
      <p className="text-sm text-muted mt-1">Update once and it applies to all your orders.</p>
      <div className="mt-4 grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs display text-muted">Name</label>
          <input value={n} onChange={(e) => setN(e.target.value)} placeholder="Full name"
            className="mt-1 w-full bg-ink border border-line px-3 py-2.5 text-base sm:text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none" />
        </div>
        <div>
          <label className="text-xs display text-muted">Phone</label>
          <input value={p} onChange={(e) => setP(e.target.value)} placeholder="(352) 555-0000" inputMode="tel"
            className="mt-1 w-full bg-ink border border-line px-3 py-2.5 text-base sm:text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none" />
          <SmsConsentNote />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button type="button" onClick={save} disabled={busy}
          className="rounded bg-brand hover:bg-brand-dark text-on-brand display px-5 py-2 disabled:opacity-50">{busy ? "Saving…" : "Save changes"}</button>
        {msg && <span className="text-sm text-brand">{msg}</span>}
        {err && <span className="text-sm text-red-400">{err}</span>}
      </div>
    </section>
  );
}

function ReferralCard({ referralUrl, creditCents }: { referralUrl: string; creditCents: number }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(referralUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  }
  return (
    <section className="border border-line bg-steel p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="display text-lg text-foreground">Refer a team, get credit</h2>
        {creditCents > 0 && (
          <span className="display text-brand">{money(creditCents)} credit earned</span>
        )}
      </div>
      <p className="text-sm text-muted mt-1">
        Share your link. When a new team places their first order, you both get a credit toward your next Slugger order.
      </p>
      <div className="mt-4 flex flex-col sm:flex-row gap-2">
        <input readOnly value={referralUrl} onFocus={(e) => e.currentTarget.select()}
          className="flex-1 bg-ink border border-line px-3 py-2.5 text-sm text-foreground focus:border-brand focus:outline-none" />
        <button type="button" onClick={copy}
          className="rounded bg-brand hover:bg-brand-dark text-on-brand display px-5 py-2.5 whitespace-nowrap">{copied ? "Copied ✓" : "Copy link"}</button>
      </div>
      {creditCents > 0 && (
        <p className="text-xs text-muted mt-3">We&apos;ll apply your credit to your next order - just mention it or we&apos;ll take care of it at checkout.</p>
      )}
    </section>
  );
}

function PasswordCard({ token, hasPassword }: { token: string; hasPassword: boolean }) {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function save() {
    if (busy) return;
    if (pw.length < 8) { setErr("Use at least 8 characters."); return; }
    setBusy(true); setErr(""); setMsg("");
    try {
      const r = await fetch("/api/portal/password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: pw }),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Couldn't save"); return; }
      setMsg("Password saved. Next time you can log in with it - no email link needed.");
      setPw(""); setOpen(false);
    } catch { setErr("Connection problem - try again."); }
    finally { setBusy(false); }
  }

  return (
    <section className="border border-line bg-steel p-5">
      <h2 className="display text-lg text-foreground">Password {hasPassword ? "" : <span className="text-sm text-muted">(optional)</span>}</h2>
      <p className="text-sm text-muted mt-1">
        {hasPassword
          ? "You have a password set for instant access. You can update it below."
          : "Set a password to skip the email link next time. Totally optional - the email link always works."}
      </p>
      {msg && <p className="text-sm text-brand mt-2">{msg}</p>}
      {!open ? (
        <button type="button" onClick={() => { setOpen(true); setMsg(""); }}
          className="mt-3 rounded border border-brand/50 text-brand display px-5 py-2 hover:bg-brand/10">
          {hasPassword ? "Change password" : "Set a password"}
        </button>
      ) : (
        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password (8+ characters)"
            className="flex-1 bg-ink border border-line px-3 py-2.5 text-base sm:text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none" />
          <button type="button" onClick={save} disabled={busy}
            className="rounded bg-brand hover:bg-brand-dark text-on-brand display px-5 py-2.5 disabled:opacity-50 whitespace-nowrap">{busy ? "Saving…" : "Save password"}</button>
        </div>
      )}
      {err && <p className="text-sm text-red-400 mt-2">{err}</p>}
    </section>
  );
}
