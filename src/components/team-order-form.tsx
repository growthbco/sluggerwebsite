"use client";

import { useState } from "react";
import { ITEM_TYPES, JERSEY_MATERIALS } from "@/lib/order-items";

const JERSEY_STYLES = ["Standard Crew Neck", "V-Neck", "Full Button", "Two Button"];

type Row = { name: string; number: string; sizes: Record<string, string>; notes: string };

const emptyRow = (): Row => ({ name: "", number: "", sizes: {}, notes: "" });

type Prefill = {
  designToken: string;
  teamName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  approvedDesignUrl: string | null;
};

export function TeamOrderForm({ prefill }: { prefill?: Prefill }) {
  const [mode, setMode] = useState<"manual" | "link">("manual");
  const [teamName, setTeamName] = useState(prefill?.teamName ?? "");
  const [contactName, setContactName] = useState(prefill?.contactName ?? "");
  const [contactEmail, setContactEmail] = useState(prefill?.contactEmail ?? "");
  const [contactPhone, setContactPhone] = useState(prefill?.contactPhone ?? "");
  const [jerseyStyle, setJerseyStyle] = useState(JERSEY_STYLES[0]);
  const [material, setMaterial] = useState(JERSEY_MATERIALS[0].key);
  const [items, setItems] = useState<string[]>(["jersey"]);
  const [rows, setRows] = useState<Row[]>([emptyRow(), emptyRow(), emptyRow()]);
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [links, setLinks] = useState<{ shareUrl: string; manageUrl: string } | null>(null);
  const [copied, setCopied] = useState("");

  const inputCls =
    "w-full bg-steel border border-line px-3 py-2.5 text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none";

  function toggleItem(key: string) {
    setItems((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }
  function update(i: number, key: keyof Row, value: string) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [key]: value } : row)));
  }
  function updateSize(i: number, itemKey: string, value: string) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, sizes: { ...row.sizes, [itemKey]: value } } : row)));
  }
  const addRow = () => setRows((r) => [...r, emptyRow()]);
  const removeRow = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i));

  const filledRows = rows.filter((r) => r.name || r.number || Object.keys(r.sizes).length);
  // Selected item types in canonical order, jersey first.
  const selected = ITEM_TYPES.filter((t) => items.includes(t.key));

  async function submit() {
    setStatus("sending"); setMessage("");
    try {
      const res = await fetch("/api/team-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamName, contactName, contactEmail, contactPhone, jerseyStyle, jerseyMaterial: material, items, roster: rows, designToken: prefill?.designToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setStatus("done");
      setMessage(`Order ${data.reference} submitted! We'll be in touch with your total and proof.`);
    } catch (e) { setStatus("error"); setMessage((e as Error).message); }
  }

  async function createLink() {
    setStatus("sending"); setMessage("");
    try {
      const res = await fetch("/api/team-order/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamName, contactName, contactEmail, contactPhone, jerseyStyle, jerseyMaterial: material, items, designToken: prefill?.designToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create link");
      setLinks({ shareUrl: data.shareUrl, manageUrl: data.manageUrl });
      setStatus("idle");
    } catch (e) { setStatus("error"); setMessage((e as Error).message); }
  }

  async function copyLink(url: string, which: string) {
    await navigator.clipboard.writeText(url);
    setCopied(which);
    setTimeout(() => setCopied(""), 2000);
  }

  if (status === "done") {
    return (
      <div className="bg-steel border border-line p-8 text-center">
        <div className="mx-auto h-12 w-12 grid place-items-center clip-slant bg-brand text-on-brand display text-xl">✓</div>
        <h2 className="display text-2xl text-foreground mt-4">Roster Submitted</h2>
        <p className="mt-3 text-muted">{message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Mode selector */}
      <div className="grid sm:grid-cols-2 gap-3">
        <button onClick={() => { setMode("manual"); setLinks(null); }} className={`text-left p-4 border transition-colors ${mode === "manual" ? "border-brand bg-steel" : "border-line hover:border-brand/50"}`}>
          <span className="display text-foreground">I&apos;ll enter the roster</span>
          <p className="text-sm text-muted mt-1">Type in each player&apos;s name, number, and sizes now.</p>
        </button>
        <button onClick={() => setMode("link")} className={`text-left p-4 border transition-colors ${mode === "link" ? "border-brand bg-steel" : "border-line hover:border-brand/50"}`}>
          <span className="display text-foreground">Let players enter their own</span>
          <p className="text-sm text-muted mt-1">Share a link - each player fills in their own details.</p>
        </button>
      </div>

      {/* Team + contact */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="display text-sm text-foreground">Team Name *</label>
          <input className={`mt-2 ${inputCls}`} value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="e.g. Sandstorm" />
        </div>
        <div>
          <label className="display text-sm text-foreground">Jersey Style *</label>
          <select className={`mt-2 ${inputCls}`} value={jerseyStyle} onChange={(e) => setJerseyStyle(e.target.value)}>
            {JERSEY_STYLES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="display text-sm text-foreground">Your Name *</label>
          <input className={`mt-2 ${inputCls}`} value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Coach / contact" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="display text-sm text-foreground">Email{mode === "link" ? " *" : ""}</label>
            <input className={`mt-2 ${inputCls}`} value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="email@team.com" />
          </div>
          <div>
            <label className="display text-sm text-foreground">Phone</label>
            <input className={`mt-2 ${inputCls}`} value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="(000) 000-0000" />
          </div>
        </div>
      </div>

      {/* Jersey material */}
      <div>
        <label className="display text-sm text-foreground">Jersey Material</label>
        <div className="mt-3 grid sm:grid-cols-2 gap-3">
          {JERSEY_MATERIALS.map((m) => {
            const on = material === m.key;
            return (
              <button
                key={m.key}
                onClick={() => setMaterial(m.key)}
                className={`text-left p-4 border transition-colors ${on ? "border-brand bg-steel" : "border-line hover:border-brand/50"}`}
              >
                <span className="display text-foreground">{on ? "✓ " : ""}{m.label}</span>
                <p className="text-sm text-muted mt-1">{m.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Item types */}
      <div>
        <label className="display text-sm text-foreground">What is the team ordering?</label>
        <p className="text-sm text-muted mt-1">Jersey is included by default - add any extras. Each player chooses their own items below (leave a size blank if they&apos;re not getting that item).</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {ITEM_TYPES.map((t) => {
            const on = items.includes(t.key);
            return (
              <button
                key={t.key}
                onClick={() => toggleItem(t.key)}
                className={`clip-slant display text-sm px-4 py-2 transition-colors ${on ? "bg-brand text-on-brand" : "bg-steel border border-line text-foreground/80 hover:border-brand/50"}`}
              >
                {on ? "✓ " : "+ "}{t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Manual roster mode */}
      {mode === "manual" && (
        <>
          <div>
            <div className="flex items-center justify-between">
              <h2 className="display text-xl text-foreground">Roster</h2>
              <span className="text-sm text-muted">{filledRows.length} players</span>
            </div>
            <p className="text-sm text-muted mt-1">Name, number, and a size for each item. Names print in CAPS.</p>

            <div className="mt-4 space-y-3">
              {rows.map((row, i) => (
                <div key={i} className="border border-line p-3 space-y-3">
                  <div className="flex gap-2 items-start">
                    <input className={inputCls} value={row.name} onChange={(e) => update(i, "name", e.target.value)} placeholder="Player name" />
                    <input className={`${inputCls} max-w-24`} value={row.number} onChange={(e) => update(i, "number", e.target.value)} placeholder="#" maxLength={4} />
                    <button onClick={() => removeRow(i)} className="text-muted hover:text-brand px-2 py-2.5" aria-label="Remove player">✕</button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {selected.map((t) => (
                      <select key={t.key} className={inputCls} value={row.sizes[t.key] ?? ""} onChange={(e) => updateSize(i, t.key, e.target.value)}>
                        <option value="">{t.label} size</option>
                        {t.sizes.map((s) => <option key={s}>{s}</option>)}
                      </select>
                    ))}
                  </div>
                  <input className={inputCls} value={row.notes} onChange={(e) => update(i, "notes", e.target.value)} placeholder="Notes (optional)" />
                </div>
              ))}
            </div>

            <button onClick={addRow} className="mt-3 clip-slant bg-steel border border-line text-foreground display text-sm px-5 py-2.5 hover:border-brand/50">
              + Add Player
            </button>
          </div>

          {status === "error" && <p className="text-sm text-brand">{message}</p>}

          <button onClick={submit} disabled={status === "sending"} className="clip-slant bg-brand hover:bg-brand-dark text-on-brand display text-lg px-8 py-4 transition-colors disabled:opacity-60">
            {status === "sending" ? "Submitting…" : "Submit Team Order"}
          </button>
          <p className="text-xs text-muted">No payment now - we&apos;ll email your total and a design proof to approve before production.</p>
        </>
      )}

      {/* Player self-entry link mode */}
      {mode === "link" && (
        <div>
          {!links ? (
            <>
              {status === "error" && <p className="text-sm text-brand mb-3">{message}</p>}
              <button onClick={createLink} disabled={status === "sending" || !teamName || !contactName || !contactEmail} className="clip-slant bg-brand hover:bg-brand-dark text-on-brand display text-lg px-8 py-4 transition-colors disabled:opacity-60">
                {status === "sending" ? "Creating…" : "Create Roster Link"}
              </button>
              <p className="text-xs text-muted mt-3">Fill in team name, your name, and email above, choose the items, then create a link to share with players.</p>
            </>
          ) : (
            <div className="space-y-5">
              <div className="bg-steel border border-line p-5">
                <h3 className="display text-lg text-foreground">Share with your players</h3>
                <p className="text-sm text-muted mt-1">Each player opens this and enters their own name, number, and sizes.</p>
                <div className="mt-3 flex gap-2">
                  <input readOnly value={links.shareUrl} className="flex-1 bg-ink border border-line px-3 py-2.5 text-sm text-foreground/80" />
                  <button onClick={() => copyLink(links.shareUrl, "share")} className="clip-slant bg-brand text-on-brand display text-sm px-5 py-2.5 hover:bg-brand-dark">{copied === "share" ? "Copied ✓" : "Copy"}</button>
                </div>
              </div>
              <div className="bg-steel border border-line p-5">
                <h3 className="display text-lg text-foreground">Your manage link (keep private)</h3>
                <p className="text-sm text-muted mt-1">Bookmark this - review the roster as it fills and submit when ready.</p>
                <div className="mt-3 flex gap-2">
                  <input readOnly value={links.manageUrl} className="flex-1 bg-ink border border-line px-3 py-2.5 text-sm text-foreground/80" />
                  <a href={links.manageUrl} className="clip-slant bg-brand text-on-brand display text-sm px-5 py-2.5 hover:bg-brand-dark grid place-items-center">Open</a>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
