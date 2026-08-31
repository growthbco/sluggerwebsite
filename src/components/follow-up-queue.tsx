"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ContactFollowUp, FollowUpCategory } from "@/lib/contact-follow-ups";

type Outcome = "no_answer" | "voicemail" | "spoke_follow_up" | "sent_link" | "needs_gary" | "completed" | "not_interested" | "do_not_call";

const TABS: Array<{ key: FollowUpCategory; label: string }> = [
  { key: "due", label: "Call now" },
  { key: "scheduled", label: "Scheduled" },
  { key: "needs_gary", label: "Needs Gary" },
  { key: "closed", label: "Closed" },
];
const OUTCOMES: Array<{ value: Outcome; label: string }> = [
  { value: "no_answer", label: "No answer" },
  { value: "voicemail", label: "Left voicemail" },
  { value: "spoke_follow_up", label: "Spoke — call again" },
  { value: "sent_link", label: "Sent link" },
  { value: "needs_gary", label: "Needs Gary" },
  { value: "completed", label: "Done / converted" },
  { value: "not_interested", label: "Not interested" },
  { value: "do_not_call", label: "Do not call" },
];
const NEEDS_NEXT = new Set<Outcome>(["no_answer", "voicemail", "spoke_follow_up", "sent_link"]);

const prettyPhone = (phone: string) => {
  const digits = phone.replace(/\D/g, "").slice(-10);
  return digits.length === 10 ? `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}` : phone;
};
const fmt = (value: string) =>
  new Date(value).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
const age = (value: string, asOf: string) => {
  const days = Math.max(0, Math.floor((new Date(asOf).getTime() - new Date(value).getTime()) / 86_400_000));
  if (days === 0) return "today";
  if (days === 1) return "1 day";
  return `${days} days`;
};
function defaultNextCall() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function FollowUpQueue({ contacts, asOf, canText }: { contacts: ContactFollowUp[]; asOf: string; canText: boolean }) {
  const router = useRouter();
  const counts = useMemo(
    () => Object.fromEntries(TABS.map((tab) => [tab.key, contacts.filter((contact) => contact.category === tab.key).length])) as Record<FollowUpCategory, number>,
    [contacts],
  );
  const [tab, setTab] = useState<FollowUpCategory>(() => (counts.due ? "due" : counts.needs_gary ? "needs_gary" : counts.scheduled ? "scheduled" : "closed"));
  const [query, setQuery] = useState("");
  const [openPhone, setOpenPhone] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome>("no_answer");
  const [note, setNote] = useState("");
  const [nextAt, setNextAt] = useState(defaultNextCall);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const visible = contacts.filter((contact) => {
    if (contact.category !== tab) return false;
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return `${contact.name} ${contact.phone} ${contact.teams.join(" ")} ${contact.reasons.map((reason) => `${reason.label} ${reason.reference}`).join(" ")}`.toLowerCase().includes(needle);
  });

  function openNotes(phone: string) {
    setOpenPhone((current) => current === phone ? null : phone);
    setOutcome("no_answer");
    setNote("");
    setNextAt(defaultNextCall());
    setError("");
  }

  async function save(contact: ContactFollowUp) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/follow-ups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: contact.phone,
          name: contact.name,
          outcome,
          note,
          nextFollowUpAt: NEEDS_NEXT.has(outcome) ? new Date(nextAt).toISOString() : null,
          references: contact.reasons.map((reason) => reason.reference),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save follow-up");
      setOpenPhone(null);
      setNote("");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save follow-up");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted">Customer follow-up</p>
          <h1 className="display mt-1 text-3xl text-foreground sm:text-4xl">Call Queue</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            People waiting to finish a deposit, review a proof, or turn an approved design into an order. Log every outcome so the next call is clear.
          </p>
        </div>
        <div className="rounded-lg border border-brand/30 bg-brand/10 px-4 py-3 text-right">
          <p className="display text-2xl text-brand">{counts.due}</p>
          <p className="text-xs text-muted">ready to call</p>
        </div>
      </header>

      <div className="mt-7 flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`display min-h-[40px] rounded-full border px-4 text-xs transition-colors ${tab === item.key ? "border-brand bg-brand text-on-brand" : "border-line text-muted hover:border-brand/50 hover:text-foreground"}`}
            >
              {item.label} · {counts[item.key]}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, team, phone…"
          className="min-h-[42px] w-full rounded-md border border-line bg-steel px-3 text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none sm:w-72"
        />
      </div>

      <section className="mt-5 space-y-3">
        {visible.length === 0 && (
          <div className="rounded-xl border border-line bg-steel px-5 py-12 text-center">
            <p className="display text-lg text-foreground">Nothing in this list</p>
            <p className="mt-1 text-sm text-muted">New stalled leads will appear automatically.</p>
          </div>
        )}
        {visible.map((contact) => {
          const open = openPhone === contact.phone;
          return (
            <article key={contact.phone} className="overflow-hidden rounded-xl border border-line bg-steel">
              <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="display truncate text-lg text-foreground">{contact.name}</h2>
                    {contact.doNotCall && <span className="rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-red-300">Do not call</span>}
                    {contact.category === "needs_gary" && <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-200">Needs Gary</span>}
                  </div>
                  <p className="mt-0.5 text-sm text-muted">{prettyPhone(contact.phone)}{contact.teams.length ? ` · ${contact.teams.join(", ")}` : ""}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {contact.reasons.map((reason) => (
                      <span key={`${reason.kind}:${reason.reference}`} className="rounded-md border border-line bg-background/35 px-2.5 py-1.5 text-xs text-foreground/85">
                        <span className="text-brand">{reason.label}</span> · {reason.reference} · {age(reason.sourceAt, asOf)}
                      </span>
                    ))}
                  </div>
                  {contact.nextFollowUpAt && contact.category === "scheduled" && (
                    <p className="mt-3 text-xs text-brand">Next call: {fmt(contact.nextFollowUpAt)} ET</p>
                  )}
                  {contact.notes[0] && (
                    <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted">
                      Latest note: {contact.notes[0].body.replaceAll("\n", " ")} · {contact.notes[0].staff ?? "Staff"}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  {!contact.doNotCall && contact.category !== "closed" && (
                    <button
                      type="button"
                      onClick={() => window.dispatchEvent(new CustomEvent("slugger-dial", { detail: { phone: contact.phone } }))}
                      className="display min-h-[42px] rounded-md bg-brand px-4 text-sm text-on-brand hover:bg-brand-dark"
                    >
                      Call
                    </button>
                  )}
                  {canText && !contact.doNotCall && (
                    <Link
                      href={`/admin/texts?to=${encodeURIComponent(contact.phone)}&name=${encodeURIComponent(contact.name)}`}
                      className="display inline-flex min-h-[42px] items-center rounded-md border border-line px-4 text-sm text-foreground hover:border-brand/50"
                    >
                      Text
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => openNotes(contact.phone)}
                    className="display min-h-[42px] rounded-md border border-line px-4 text-sm text-foreground hover:border-brand/50"
                  >
                    {open ? "Close notes" : `Notes${contact.notes.length ? ` · ${contact.notes.length}` : ""}`}
                  </button>
                </div>
              </div>

              {open && (
                <div className="grid gap-5 border-t border-line bg-background/25 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
                  <div>
                    <h3 className="display text-sm text-foreground">Contact notes</h3>
                    <div className="mt-3 space-y-2">
                      {contact.notes.length === 0 && <p className="text-sm text-muted">No notes yet.</p>}
                      {contact.notes.map((item) => (
                        <div key={item.id} className="rounded-md border border-line bg-steel px-3 py-2.5">
                          <p className="whitespace-pre-wrap text-sm leading-5 text-foreground/90">{item.body}</p>
                          <p className="mt-1 text-[10px] text-muted">{item.staff ?? "Staff"} · {fmt(item.createdAt)} ET</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  {contact.category !== "closed" && !contact.doNotCall && (
                    <div>
                      <h3 className="display text-sm text-foreground">Log this call</h3>
                      <label className="mt-3 block text-xs text-muted">
                        Outcome
                        <select value={outcome} onChange={(event) => setOutcome(event.target.value as Outcome)} className="mt-1 min-h-[42px] w-full rounded-md border border-line bg-steel px-3 text-sm text-foreground focus:border-brand focus:outline-none">
                          {OUTCOMES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                        </select>
                      </label>
                      <label className="mt-3 block text-xs text-muted">
                        Notes
                        <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} maxLength={1200} placeholder="What did they say? What should the next person know?" className="mt-1 w-full rounded-md border border-line bg-steel px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none" />
                      </label>
                      {NEEDS_NEXT.has(outcome) && (
                        <label className="mt-3 block text-xs text-muted">
                          Next call
                          <input type="datetime-local" value={nextAt} onChange={(event) => setNextAt(event.target.value)} className="mt-1 min-h-[42px] w-full rounded-md border border-line bg-steel px-3 text-sm text-foreground focus:border-brand focus:outline-none" />
                        </label>
                      )}
                      {outcome === "do_not_call" && <p className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs leading-5 text-red-200">This permanently removes the number from the call queue until staff reopens it.</p>}
                      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
                      <button type="button" disabled={busy || (NEEDS_NEXT.has(outcome) && !nextAt)} onClick={() => void save(contact)} className="display mt-4 min-h-[44px] w-full rounded-md bg-brand px-4 text-sm text-on-brand hover:bg-brand-dark disabled:opacity-50">
                        {busy ? "Saving…" : "Save outcome"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </section>
    </main>
  );
}
