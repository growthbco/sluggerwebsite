"use client";

import { useState } from "react";
import { formatSize, isOneSizeField, missingCheerSizeLabels, sizeFieldsForItems } from "@/lib/order-items";

export function SelfEntryForm({ token, items, sport, designs = [], requiresNames = true }: { token: string; items: string[]; sport?: string | null; designs?: { label: string; image: string; sku?: string | null }[]; requiresNames?: boolean }) {
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [sizes, setSizes] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [picked, setPicked] = useState<string[]>(designs.length === 1 ? [designs[0].label] : []);
  const [zoom, setZoom] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  const sizeFields = sizeFieldsForItems(items, sport);
  const inputCls =
    "w-full bg-steel border border-line px-3 py-2.5 text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none";

  function setSize(key: string, value: string) {
    setSizes((s) => ({ ...s, [key]: value }));
  }
  function toggleDesign(label: string) {
    setPicked((p) => (p.includes(label) ? p.filter((x) => x !== label) : [...p, label]));
  }

  const hasSize = Object.values(sizes).some(Boolean);
  const missingCheerSizes = missingCheerSizeLabels(items, sizes);
  const needsDesign = designs.length > 1;
  const canSubmit = hasSize && missingCheerSizes.length === 0 && (!needsDesign || picked.length > 0);

  async function submit() {
    setStatus("sending");
    setMessage("");
    try {
      const res = await fetch(`/api/team-order/${token}/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerName: name, playerNumber: number, sizes, notes, designs: picked }),
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
          onClick={() => { setName(""); setNumber(""); setSizes({}); setNotes(""); setPicked(designs.length === 1 ? [designs[0].label] : []); setStatus("idle"); }}
          className="mt-6 clip-slant bg-steel border border-line text-foreground display text-sm px-5 py-2.5 hover:border-brand/50"
        >
          Add another player
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {designs.length > 1 && (
        <div>
          <label className="display text-sm text-foreground">Pick your design <span className="text-brand">*</span> <span className="text-muted normal-case">(tap more than one to get a set of each)</span></label>
          <div className="mt-2 flex flex-wrap gap-2">
            {designs.map((d) => {
              const on = picked.includes(d.label);
              return (
                <div key={d.label} className={`relative w-28 border-2 rounded overflow-hidden ${on ? "border-brand" : "border-line opacity-80"}`}>
                  {on && <span className="absolute top-1 right-1 z-10 h-5 w-5 grid place-items-center rounded-full bg-brand text-on-brand text-xs">✓</span>}
                  <span role="button" tabIndex={0} onClick={() => setZoom(d.image)} className="absolute top-1 left-1 z-10 h-5 w-5 grid place-items-center rounded-full bg-ink/80 text-foreground text-[11px] cursor-pointer" title="Enlarge">🔍</span>
                  <button type="button" onClick={() => toggleDesign(d.label)} className="block w-full text-left" aria-pressed={on}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={d.image} alt={d.label} className="h-20 w-full object-contain bg-white" />
                    <span className={`block px-1.5 py-1 text-[11px] leading-tight ${on ? "text-brand" : "text-muted"}`}>{d.label}{d.sku ? <span className="block font-mono text-[10px] opacity-70">{d.sku}</span> : null}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {requiresNames && (
        <div>
          <label className="display text-sm text-foreground">Your Name <span className="text-muted normal-case">(optional - prints in CAPS if given)</span></label>
          <input className={`mt-2 ${inputCls}`} value={name} onChange={(e) => setName(e.target.value)} placeholder="Last name, or leave blank for no name" />
        </div>
      )}
      <div>
        <label className="display text-sm text-foreground">Number</label>
        <input className={`mt-2 ${inputCls} max-w-32`} value={number} onChange={(e) => setNumber(e.target.value)} placeholder="#" maxLength={4} />
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {sizeFields.map((field) => isOneSizeField(field) ? (
          <label key={field.key} className="flex min-h-20 cursor-pointer items-center gap-3 border border-line bg-steel px-4 py-3 hover:border-brand/60">
            <input
              type="checkbox"
              checked={sizes[field.key] === "One Size"}
              onChange={(e) => setSize(field.key, e.target.checked ? "One Size" : "")}
              className="h-5 w-5 shrink-0 accent-brand"
            />
            <span>
              <span className="display block text-sm text-foreground">Add {field.label}</span>
              <span className="mt-0.5 block text-xs text-muted">One size fits most</span>
            </span>
          </label>
        ) : (
          <div key={field.key}>
            <label className="display text-sm text-foreground">{field.label} Size *</label>
            <select className={`mt-2 ${inputCls}`} value={sizes[field.key] ?? ""} onChange={(e) => setSize(field.key, e.target.value)}>
              <option value="">Select</option>
              {field.sizes.map((s) => <option key={s} value={s}>{formatSize(s)}</option>)}
            </select>
          </div>
        ))}
      </div>
      {missingCheerSizes.length > 0 && hasSize && (
        <p className="text-xs text-brand">Choose both a cheer top size and skirt size.</p>
      )}

      <div>
        <label className="display text-sm text-foreground">Notes (optional)</label>
        <input className={`mt-2 ${inputCls}`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. long sleeve" />
      </div>

      {status === "error" && <p className="text-sm text-brand">{message}</p>}

      <button
        onClick={submit}
        disabled={status === "sending" || !canSubmit}
        className="w-full clip-slant bg-brand hover:bg-brand-dark text-on-brand display text-lg py-3.5 transition-colors disabled:opacity-60"
      >
        {status === "sending" ? "Adding…" : picked.length > 1 ? `Add Me (${picked.length} designs)` : "Add Me to the Roster"}
      </button>
      {needsDesign && picked.length === 0 && hasSize && (
        <p className="text-xs text-brand text-center">Pick at least one design above to continue.</p>
      )}

      {zoom && (
        <div className="fixed inset-0 z-[90] bg-black/85 grid place-items-center p-4" onClick={() => setZoom(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="Design" className="max-h-[92vh] max-w-[95vw] object-contain" />
        </div>
      )}
    </div>
  );
}
