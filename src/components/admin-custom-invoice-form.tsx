"use client";

import { useEffect, useRef, useState } from "react";

import { STANDARD_INVOICE_TERMS } from "@/lib/invoice-terms";

type Line = { name: string; description: string; quantity: string; price: string };
type CustomerHit = { name: string; email: string; phone: string | null; creditCents: number; zip: string | null; cityState: string | null };
type LibraryItem = { id: string; name: string; description: string | null; unitPriceCents: number; weightOz: number };

const emptyLine = (): Line => ({ name: "", description: "", quantity: "1", price: "" });
const money = (c: number) => `$${(c / 100).toFixed(2)}`;

/** Free-form invoice builder: items, prices, notes/terms, one send button.
 *  AI buttons draft descriptions and terms into the fields for editing. */
export function AdminCustomInvoiceForm() {
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  // Existing-customer type-ahead: typing a name or email searches everyone
  // who has ever ordered; picking one fills both fields.
  const [hits, setHits] = useState<CustomerHit[]>([]);
  const [hitsOpen, setHitsOpen] = useState(false);
  const [picked, setPicked] = useState<CustomerHit | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Item library: everything ever invoiced, so items are picked, not retyped.
  // The library learns automatically - sending an invoice saves its items.
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [itemDropdown, setItemDropdown] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/admin/invoice-items")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => setLibrary(d.items ?? []))
      .catch(() => {});
  }, []);
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [notes, setNotes] = useState(STANDARD_INVOICE_TERMS);
  const [taxExempt, setTaxExempt] = useState(false);
  // Shipping: quoted live from ZIP + estimated weight; off = pickup/no charge.
  const [shipOn, setShipOn] = useState(false);
  const [shipZip, setShipZip] = useState("");
  const [weightOverride, setWeightOverride] = useState("");
  const [shipCents, setShipCents] = useState<number | null>(null);
  const [shipCarrier, setShipCarrier] = useState<string | null>(null);
  const [shipError, setShipError] = useState<string | null>(null);
  const quoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [busy, setBusy] = useState<"" | "sending" | `ai-${number}` | "ai-terms">("");
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ reference: string; totalCents: number; payUrl: string; emailed: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  const inputCls =
    "w-full bg-steel border border-line px-3 py-2.5 text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none";

  function update(i: number, key: keyof Line, value: string) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, [key]: value } : l)));
  }

  function searchCustomers(q: string) {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (q.trim().length < 2) { setHits([]); setHitsOpen(false); return; }
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/customers/search?q=${encodeURIComponent(q.trim())}`);
        const data = await res.json();
        const results: CustomerHit[] = res.ok ? data.results ?? [] : [];
        setHits(results);
        setHitsOpen(results.length > 0);
      } catch { /* type-ahead only - typing manually still works */ }
    }, 250);
  }

  function pickCustomer(h: CustomerHit) {
    setCustomerName(h.name || customerName);
    setCustomerEmail(h.email);
    setPicked(h);
    setHitsOpen(false);
    // Address on file -> shipping turns on with their ZIP prefilled (uncheck
    // for pickup). No address -> leave shipping off.
    if (h.zip) {
      setShipZip(h.zip);
      setShipOn(true);
    }
  }

  function libraryMatches(i: number): LibraryItem[] {
    const q = lines[i]?.name.trim().toLowerCase() ?? "";
    const pool = q.length === 0 ? library : library.filter((it) => it.name.toLowerCase().includes(q) || (it.description ?? "").toLowerCase().includes(q));
    return pool.slice(0, 8);
  }

  function pickItem(i: number, it: LibraryItem) {
    setLines((ls) =>
      ls.map((l, idx) =>
        idx === i ? { ...l, name: it.name, description: it.description ?? "", price: (it.unitPriceCents / 100).toFixed(2) } : l,
      ),
    );
    setItemDropdown(null);
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
  // Mirrors the server: banked referral credit auto-applies, capped so at
  // least $1 is charged, and shrinks the tax base too.
  const credit = picked && picked.creditCents > 0 ? Math.max(0, Math.min(picked.creditCents, subtotal - 100)) : 0;
  const tax = taxExempt ? 0 : Math.round((subtotal - credit) * 0.07);
  // Package weight: per-item weights from the library (16 oz for unknowns),
  // overridable by hand.
  const estWeightOz =
    lines.reduce((s, l) => {
      const name = l.name.trim().toLowerCase();
      if (!name) return s;
      const qty = Math.max(1, Math.round(Number(l.quantity) || 1));
      const it = library.find((x) => x.name.toLowerCase() === name);
      return s + (it?.weightOz ?? 16) * qty;
    }, 0) || 16;
  const weightOz = Math.max(1, Math.round(Number(weightOverride) || estWeightOz));
  const zipValid = /^\d{5}$/.test(shipZip.trim());
  const ship = shipOn && shipCents != null ? shipCents : 0;
  const total = subtotal - credit + tax + ship;

  // Live shipping quote whenever shipping is on and the inputs settle.
  useEffect(() => {
    if (!shipOn || !zipValid) { setShipCents(null); setShipCarrier(null); setShipError(null); return; }
    if (quoteTimer.current) clearTimeout(quoteTimer.current);
    quoteTimer.current = setTimeout(async () => {
      try {
        setShipError(null);
        const res = await fetch("/api/admin/ship-quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ zip: shipZip.trim(), weightOz }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Quote failed");
        setShipCents(data.chargedCents);
        setShipCarrier(data.carrier ?? null);
      } catch (e) {
        setShipCents(null);
        setShipError(e instanceof Error ? e.message : "Quote failed");
      }
    }, 400);
  }, [shipOn, shipZip, weightOz, zipValid]);

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
        body: JSON.stringify({
          customerName,
          customerEmail,
          lines: parsedLines,
          notes: notes.trim() || undefined,
          taxExempt,
          ship: shipOn && zipValid ? { zip: shipZip.trim(), weightOz } : null,
        }),
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
          onClick={() => { setDone(null); setLines([emptyLine()]); setNotes(STANDARD_INVOICE_TERMS); setCustomerName(""); setCustomerEmail(""); setPicked(null); setHits([]); setShipOn(false); setShipZip(""); setWeightOverride(""); setShipCents(null); }}
          className="mt-6 text-sm text-muted border border-line px-4 py-2 hover:border-brand/50 hover:text-foreground"
        >
          Create another invoice
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="relative">
            <label className="display text-sm text-foreground">Customer name *</label>
            <input
              className={`mt-2 ${inputCls}`}
              value={customerName}
              onChange={(e) => { setCustomerName(e.target.value); setPicked(null); searchCustomers(e.target.value); }}
              onBlur={() => setTimeout(() => setHitsOpen(false), 150)}
              placeholder="Start typing to find an existing customer"
              autoComplete="off"
            />
            {hitsOpen && (
              <ul className="absolute z-20 left-0 right-0 mt-1 bg-ink border border-line shadow-lg max-h-64 overflow-y-auto">
                {hits.map((h) => (
                  <li key={h.email}>
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); pickCustomer(h); }}
                      className="w-full text-left px-3 py-2 hover:bg-steel"
                    >
                      <span className="text-sm text-foreground">{h.name || h.email}</span>
                      <span className="block text-xs text-muted">
                        {h.email}
                        {h.creditCents > 0 ? ` · ${money(h.creditCents)} referral credit` : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <label className="display text-sm text-foreground">Customer email *</label>
            <input
              className={`mt-2 ${inputCls}`}
              type="email"
              value={customerEmail}
              onChange={(e) => { setCustomerEmail(e.target.value); setPicked(null); }}
              placeholder="name@example.com"
            />
          </div>
        </div>
        {picked && (
          <p className="mt-2 text-xs text-green-400">
            ✓ Existing customer on file
            {picked.phone ? ` · ${picked.phone}` : ""}
            {picked.creditCents > 0 ? ` · has ${money(picked.creditCents)} referral credit (auto-applied to this invoice)` : ""}
          </p>
        )}
      </div>

      <div>
        <label className="display text-sm text-foreground">Items *</label>
        <div className="mt-3 space-y-4">
          {lines.map((l, i) => (
            <div key={i} className="bg-steel border border-line p-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_5.5rem_7rem_auto] items-end">
                <div className="relative">
                  <label className="text-xs text-muted">Item name</label>
                  <input
                    className={`mt-1 ${inputCls}`}
                    value={l.name}
                    onChange={(e) => { update(i, "name", e.target.value); setItemDropdown(i); }}
                    onFocus={() => { if (library.length > 0) setItemDropdown(i); }}
                    onBlur={() => setTimeout(() => setItemDropdown((d) => (d === i ? null : d)), 150)}
                    placeholder={library.length > 0 ? "Pick a saved item or type a new one" : "e.g. Custom 3D Hype Chain"}
                    autoComplete="off"
                  />
                  {itemDropdown === i && libraryMatches(i).length > 0 && (
                    <ul className="absolute z-20 left-0 right-0 mt-1 bg-ink border border-line shadow-lg max-h-64 overflow-y-auto">
                      {libraryMatches(i).map((it) => (
                        <li key={it.id}>
                          <button
                            type="button"
                            onMouseDown={(e) => { e.preventDefault(); pickItem(i, it); }}
                            className="w-full text-left px-3 py-2 hover:bg-steel"
                          >
                            <span className="text-sm text-foreground">{it.name}</span>
                            <span className="text-sm text-muted"> · {money(it.unitPriceCents)}</span>
                            {it.description && <span className="block text-xs text-muted truncate">{it.description}</span>}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
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
          <label className="display text-sm text-foreground">Terms &amp; conditions <span className="text-xs text-muted">(standard terms pre-filled - edit as needed)</span></label>
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

      <div className="bg-steel border border-line p-4">
        <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
          <input type="checkbox" checked={shipOn} onChange={(e) => setShipOn(e.target.checked)} className="accent-[#b8a36c]" />
          <span className="display">Charge shipping</span>
          <span className="text-xs text-muted">(off = local pickup / no shipping)</span>
        </label>
        {shipOn && (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div>
              <label className="text-xs text-muted">Ship-to ZIP</label>
              <input
                className={`mt-1 ${inputCls} w-28 font-mono`}
                inputMode="numeric"
                value={shipZip}
                onChange={(e) => setShipZip(e.target.value)}
                placeholder="34471"
              />
            </div>
            <div>
              <label className="text-xs text-muted">Weight (oz)</label>
              <input
                className={`mt-1 ${inputCls} w-24`}
                inputMode="numeric"
                value={weightOverride}
                onChange={(e) => setWeightOverride(e.target.value)}
                placeholder={String(estWeightOz)}
              />
            </div>
            <div className="pb-2.5 text-sm">
              {!zipValid ? (
                <span className="text-muted">Enter the 5-digit ZIP to quote</span>
              ) : shipError ? (
                <span className="text-red-400">{shipError}</span>
              ) : shipCents == null ? (
                <span className="text-muted">Quoting...</span>
              ) : (
                <span className="text-foreground">
                  {money(shipCents)}{shipCarrier ? <span className="text-muted"> · {shipCarrier}</span> : null}
                </span>
              )}
            </div>
          </div>
        )}
        {shipOn && picked?.zip && shipZip === picked.zip && (
          <p className="mt-2 text-xs text-muted">ZIP from the address on file{picked.cityState ? ` (${picked.cityState})` : ""}. Weight is estimated from the items - override it if the box will weigh more.</p>
        )}
      </div>

      <div className="bg-steel border border-line p-4 text-sm">
        <div className="flex justify-between"><span className="text-muted">Subtotal</span><span className="text-foreground">{money(subtotal)}</span></div>
        {credit > 0 && (
          <div className="flex justify-between mt-1"><span className="text-green-400">Referral credit (auto-applied)</span><span className="text-green-400">-{money(credit)}</span></div>
        )}
        <div className="flex justify-between mt-1"><span className="text-muted">FL sales tax (7%)</span><span className="text-foreground">{taxExempt ? "Exempt" : money(tax)}</span></div>
        {shipOn && (
          <div className="flex justify-between mt-1"><span className="text-muted">Shipping</span><span className="text-foreground">{shipCents != null ? money(shipCents) : "..."}</span></div>
        )}
        <div className="flex justify-between mt-2 pt-2 border-t border-line display text-foreground"><span>Total</span><span>{money(total)}</span></div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="button"
        onClick={send}
        disabled={busy !== "" || parsedLines.length === 0 || !customerName.trim() || !customerEmail.trim() || (shipOn && (!zipValid || shipCents == null))}
        className="w-full clip-slant bg-brand hover:bg-brand-dark text-on-brand display text-lg py-3.5 transition-colors disabled:opacity-60"
      >
        {busy === "sending" ? "Creating & sending..." : `Send invoice (${money(total)})`}
      </button>
    </div>
  );
}
