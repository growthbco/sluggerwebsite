"use client";

import { useState } from "react";

type Line = { name: string; description: string; quantity: string; price: string };

const emptyLine = (): Line => ({ name: "", description: "", quantity: "1", price: "" });
const money = (c: number) => `$${(c / 100).toFixed(2)}`;

/** Free-form invoice builder: items, prices, notes/terms, one send button.
 *  AI buttons draft descriptions and terms into the fields for editing. */
export function AdminCustomInvoiceForm() {
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [notes, setNotes] = useState("");
  const [taxExempt, setTaxExempt] = useState(false);
  const [busy, setBusy] = useState<"" | "sending" | `ai-${number}` | "ai-terms">("");
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ reference: string; totalCents: number; payUrl: string; emailed: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  const inputCls =
    "w-full bg-steel border border-line px-3 py-2.5 text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none";

  function update(i: number, key: keyof Line, value: string) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, [key]: value } : l)));
  }

  const parsedLines = lines
    .map((l) => ({
      name: l.name.trim(),
      description: l.description.trim() || undefined,
      quantity: Math.max(1, Math.round(Number(l.quantity) || 1)),
      unitPriceCents: Math.round((parseFloat(l.price) || 0) * 100),
    }))
    .filter((l) => l.name && l.unitPriceCents > 0);
  const subtotal = parsedLines.reduce((s, l) => s + l.unitPriceCents * l.quantity, 0);
  const tax = taxExempt ? 0 : Math.round(subtotal * 0.07);
  const total = subtotal + tax;

  async function aiDraft(kind: "description" | "terms", lineIndex?: number) {
    setBusy(kind === "terms" ? "ai-terms" : `ai-${lineIndex!}`);
    setError("");
    try {
      const res = await fetch("/api/admin/custom-invoice/ai-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          customerName: customerName.trim() || undefined,
          itemName: lineIndex != null ? lines[lineIndex].name.trim() : undefined,
          hint: kind === "terms" ? notes.trim() || undefined : lines[lineIndex!].description.trim() || undefined,
          lines: parsedLines.map((l) => ({ name: l.name, quantity: l.quantity })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI draft failed");
      if (kind === "terms") setNotes(data.text);
      else update(lineIndex!, "description", data.text);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function send() {
    setBusy("sending");
    setError("");
    try {
      const res = await fetch("/api/admin/custom-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerName, customerEmail, lines: parsedLines, notes: notes.trim() || undefined, taxExempt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create the invoice");
      setDone(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  if (done) {
    return (
      <div className="bg-steel border border-line p-8 text-center">
        <div className="mx-auto h-12 w-12 grid place-items-center clip-slant bg-brand text-on-brand display text-xl">✓</div>
        <h2 className="display text-2xl text-foreground mt-4">Invoice {done.reference} sent</h2>
        <p className="mt-2 text-muted">
          {money(done.totalCents)} · {done.emailed ? `emailed to ${customerEmail}` : "email failed - share the link below directly"}
        </p>
        <div className="mt-5 flex gap-2 max-w-lg mx-auto">
          <input readOnly value={done.payUrl} className="flex-1 bg-ink border border-line px-3 py-2 text-xs text-foreground/80" />
          <button
            type="button"
            onClick={async () => { await navigator.clipboard.writeText(done.payUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="clip-slant bg-brand text-on-brand display text-sm px-4 py-2 hover:bg-brand-dark"
          >
            {copied ? "Copied ✓" : "Copy pay link"}
          </button>
        </div>
        <button
          type="button"
          onClick={() => { setDone(null); setLines([emptyLine()]); setNotes(""); setCustomerName(""); setCustomerEmail(""); }}
          className="mt-6 text-sm text-muted border border-line px-4 py-2 hover:border-brand/50 hover:text-foreground"
        >
          Create another invoice
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="display text-sm text-foreground">Customer name *</label>
          <input className={`mt-2 ${inputCls}`} value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="e.g. Derek Hicks" />
        </div>
        <div>
          <label className="display text-sm text-foreground">Customer email *</label>
          <input className={`mt-2 ${inputCls}`} type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="name@example.com" />
        </div>
      </div>

      <div>
        <label className="display text-sm text-foreground">Items *</label>
        <div className="mt-3 space-y-4">
          {lines.map((l, i) => (
            <div key={i} className="bg-steel border border-line p-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_5.5rem_7rem_auto] items-end">
                <div>
                  <label className="text-xs text-muted">Item name</label>
                  <input className={`mt-1 ${inputCls}`} value={l.name} onChange={(e) => update(i, "name", e.target.value)} placeholder="e.g. Custom 3D Hype Chain" />
                </div>
                <div>
                  <label className="text-xs text-muted">Qty</label>
                  <input className={`mt-1 ${inputCls}`} inputMode="numeric" value={l.quantity} onChange={(e) => update(i, "quantity", e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted">Price each ($)</label>
                  <input className={`mt-1 ${inputCls}`} inputMode="decimal" value={l.price} onChange={(e) => update(i, "price", e.target.value)} placeholder="40.00" />
                </div>
                {lines.length > 1 && (
                  <button type="button" onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))} className="text-muted hover:text-red-400 text-sm pb-2.5" aria-label="Remove item">
                    ✕
                  </button>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs text-muted">Description (optional - shown under the item)</label>
                  <button
                    type="button"
                    onClick={() => aiDraft("description", i)}
                    disabled={busy !== "" || !l.name.trim()}
                    className="text-xs display text-brand border border-brand/50 px-2 py-0.5 hover:bg-brand/10 disabled:opacity-50"
                    title="AI writes a short description for this item - edit before sending"
                  >
                    {busy === `ai-${i}` ? "Drafting..." : "✨ AI write it"}
                  </button>
                </div>
                <textarea
                  className={`mt-1 ${inputCls} min-h-20 resize-y`}
                  rows={3}
                  value={l.description}
                  onChange={(e) => update(i, "description", e.target.value)}
                  placeholder="What the customer is getting"
                />
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setLines((ls) => [...ls, emptyLine()])} className="mt-3 text-sm display text-muted border border-line px-3 py-1.5 hover:border-brand/50 hover:text-foreground">
          + Add item
        </button>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="display text-sm text-foreground">Notes / terms &amp; conditions (optional)</label>
          <button
            type="button"
            onClick={() => aiDraft("terms")}
            disabled={busy !== ""}
            className="text-xs display text-brand border border-brand/50 px-2 py-0.5 hover:bg-brand/10 disabled:opacity-50"
            title="AI drafts a standard terms block - edit before sending. Type a hint first to steer it."
          >
            {busy === "ai-terms" ? "Drafting..." : "✨ AI draft terms"}
          </button>
        </div>
        <textarea className={`mt-2 ${inputCls} min-h-28 resize-y`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Shown at the bottom of the invoice. Type a rough idea and hit AI draft, or write your own." />
      </div>

      <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
        <input type="checkbox" checked={taxExempt} onChange={(e) => setTaxExempt(e.target.checked)} className="accent-[#b8a36c]" />
        Tax exempt (skip the 7% FL sales tax)
      </label>

      <div className="bg-steel border border-line p-4 text-sm">
        <div className="flex justify-between"><span className="text-muted">Subtotal</span><span className="text-foreground">{money(subtotal)}</span></div>
        <div className="flex justify-between mt-1"><span className="text-muted">FL sales tax (7%)</span><span className="text-foreground">{taxExempt ? "Exempt" : money(tax)}</span></div>
        <div className="flex justify-between mt-2 pt-2 border-t border-line display text-foreground"><span>Total</span><span>{money(total)}</span></div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="button"
        onClick={send}
        disabled={busy !== "" || parsedLines.length === 0 || !customerName.trim() || !customerEmail.trim()}
        className="w-full clip-slant bg-brand hover:bg-brand-dark text-on-brand display text-lg py-3.5 transition-colors disabled:opacity-60"
      >
        {busy === "sending" ? "Creating & sending..." : `Send invoice (${money(total)})`}
      </button>
    </div>
  );
}
