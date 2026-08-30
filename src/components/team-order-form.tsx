"use client";

import { useEffect, useState } from "react";
import { SmsConsentNote } from "@/components/sms-consent";
import { ITEM_TYPES, JERSEY_MATERIALS, missingCheerSizeLabels, sizeFieldsForItems } from "@/lib/order-items";
import { RosterImport, type ImportedRow } from "@/components/roster-import";
import { loadRememberedContact, saveRememberedContact } from "@/lib/remembered-contact";
import { DeliveryTimingAcknowledgment } from "@/components/delivery-timing-acknowledgment";
import { computeTeamOrderQuote } from "@/lib/team-order-pricing";
import { buildCustomerOrderSpec } from "@/lib/order-spec";
import { OrderSpecificationCard } from "@/components/order-specification-card";

const JERSEY_STYLES = ["Standard Crew Neck", "V-Neck", "Full Button", "Two Button", "Quarter-Zip"];

type Row = { name: string; number: string; sizes: Record<string, string>; notes: string; design: string };

const emptyRow = (design = ""): Row => ({ name: "", number: "", sizes: {}, notes: "", design });

type Prefill = {
  designToken: string;
  teamName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  approvedDesignUrl: string | null;
  items?: string[];
  sport?: string | null;
  designJerseyStyle?: string | null;
  rush?: boolean;
  neededBy?: string | null;
  /** Approved colorways to choose from. >1 means the roster shows a per-row
   *  design picker (which artwork each player gets). */
  designs?: { label: string; image: string; sku?: string | null }[];
};

/** Best-effort match of the design's jersey cut onto this form's style list. */
function styleFromDesign(designStyle?: string | null): string | undefined {
  const s = (designStyle ?? "").toLowerCase();
  if (!s) return undefined;
  if (s.includes("two")) return "Two Button";
  if (s.includes("full")) return "Full Button";
  if (s.includes("v-neck") || s.includes("v neck")) return "V-Neck";
  if (s.includes("crew") || s.includes("round")) return "Standard Crew Neck";
  return JERSEY_STYLES.find((j) => j.toLowerCase() === s);
}

export function TeamOrderForm({ prefill }: { prefill?: Prefill }) {
  // Approved designs this team can pick from. More than one (e.g. Pin Daddy /
  // Pin Mommy) turns on the per-row design picker so each size ties to the
  // right artwork - the exact gap that used to force people into the notes box.
  const designs = prefill?.designs ?? [];
  const hasApprovedDesign = Boolean(prefill && designs.length > 0);
  const needsDesign = designs.length > 1;
  const soleDesign = designs.length === 1 ? designs[0].label : "";
  const [mode, setMode] = useState<"manual" | "link">("manual");
  const [teamName, setTeamName] = useState(prefill?.teamName ?? "");
  const [contactName, setContactName] = useState(prefill?.contactName ?? "");
  const [contactEmail, setContactEmail] = useState(prefill?.contactEmail ?? "");
  const [contactPhone, setContactPhone] = useState(prefill?.contactPhone ?? "");
  // No design style specified -> leave blank rather than silently stamping
  // "Standard Crew Neck" on the order. Blank prices the same as crew neck.
  const initialJerseyStyle = styleFromDesign(prefill?.designJerseyStyle) ?? "";
  const [jerseyStyle, setJerseyStyle] = useState(initialJerseyStyle);
  const [material, setMaterial] = useState(fabricForStyle(initialJerseyStyle));
  const [materialTouched, setMaterialTouched] = useState(false);
  // Orders from an approved design start with the items the design actually
  // covers (a hoodie design pre-selects hoodie, not the jersey default).
  const [items, setItems] = useState<string[]>(prefill?.items?.length ? prefill.items : ["jersey"]);
  const [rows, setRows] = useState<Row[]>(() => [emptyRow(soleDesign), emptyRow(soleDesign), emptyRow(soleDesign)]);
  // Hats are ordered in bulk by size (not per player): { fitted_hat: { "S/M": 5 } }.
  const [hatQty, setHatQty] = useState<Record<string, Record<string, number>>>({});
  const setQty = (key: string, size: string, n: number) =>
    setHatQty((h) => ({ ...h, [key]: { ...(h[key] ?? {}), [size]: n } }));
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [links, setLinks] = useState<{ shareUrl: string; manageUrl: string } | null>(null);
  const [copied, setCopied] = useState("");
  const [manageUrl, setManageUrl] = useState<string | null>(null);
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);
  const [rosterAck, setRosterAck] = useState(false);
  const [deliveryAck, setDeliveryAck] = useState(false);

  // Returning visitor prefill (browser-local). Skipped when the identity is
  // already locked from an approved design.
  useEffect(() => {
    if (prefill) return;
    const saved = loadRememberedContact();
    if (saved) {
      setContactName((v) => v || saved.name);
      setContactEmail((v) => v || saved.email);
      setContactPhone((v) => v || saved.phone);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const addRow = () => setRows((r) => [...r, emptyRow(soleDesign)]);
  const removeRow = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i));

  const filledRows = rows.filter((r) => r.name || r.number || Object.keys(r.sizes).length);
  // Selected item types in canonical order, jersey first. Per-player items get
  // a size column on each roster row; in-house hats are ordered in bulk by size.
  const selected = ITEM_TYPES.filter((t) => items.includes(t.key));
  // One-size items ordered in bulk by size: in-house hats AND outsourced beanies.
  const perPlayerSelected = selected.filter((t) => !t.inHouse && !t.outsourced);
  const bulkSelected = selected.filter((t) => t.inHouse || t.outsourced);
  const perPlayerKeys = perPlayerSelected.map((t) => t.key);
  const perPlayerSizeFields = sizeFieldsForItems(perPlayerKeys);
  const bulkRows = () =>
    bulkSelected.flatMap((t) =>
      t.sizes
        .filter((s) => (hatQty[t.key]?.[s] ?? 0) > 0)
        .map((s) => ({ name: "", number: "", sizes: { [t.key]: s }, notes: "", design: "", quantity: hatQty[t.key][s] })),
    );
  // Jersey style/material only apply when a jersey is actually being ordered
  // - a hoodie-only order must not carry a phantom jersey style.
  const hasJersey = items.includes("jersey");
  const orderSetupComplete = items.length > 0 && (!hasJersey || Boolean(jerseyStyle && material));
  const sizeGuideHref = /volleyball/i.test(prefill?.sport ?? "") ? "/size-guide#girls-volleyball" : "/size-guide#jerseys";
  const submissionRoster = [
    ...rows.map((row) => ({ ...row, quantity: 1 })),
    ...bulkRows(),
  ].filter((row) => row.name || row.number || Object.values(row.sizes).some(Boolean));
  const submissionRosterForPricing = submissionRoster.map((row, index) => ({
    id: `preview-${index}`,
    playerName: row.name,
    playerNumber: row.number,
    sizes: row.sizes,
    quantity: row.quantity,
  }));
  const submissionOrder = {
    teamName,
    items,
    sport: prefill?.sport,
    jerseyStyle: hasJersey ? jerseyStyle : null,
    jerseyMaterial: hasJersey ? material : null,
    rushShipping: prefill?.rush ?? false,
    requestedInHandAt: prefill?.neededBy ? new Date(`${prefill.neededBy}T12:00:00`) : null,
  };
  const submissionQuote = computeTeamOrderQuote(submissionOrder, submissionRosterForPricing);
  const submissionSpec = buildCustomerOrderSpec(
    submissionOrder,
    submissionRosterForPricing,
    { designs, colors: null },
    submissionQuote,
  );

  async function submit() {
    if (!rosterAck || !deliveryAck) return;
    // Multi-design team: every player row with anything on it must say which
    // design it gets, so nothing falls back to a guess in production.
    if (needsDesign && hasJersey) {
      const missing = rows.some((r) => (r.name || r.number || Object.keys(r.sizes).length) && !r.design);
      if (missing) { setStatus("error"); setMessage("This team has more than one design - pick which one each player gets."); return; }
    }
    if (rows.some((r) => (r.name || r.number || Object.values(r.sizes).some(Boolean)) && missingCheerSizeLabels(items, r.sizes).length)) {
      setStatus("error"); setMessage("Choose both a cheer top size and skirt size for every cheerleader."); return;
    }
    setStatus("sending"); setMessage("");
    try {
      const res = await fetch("/api/team-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamName, contactName, contactEmail, contactPhone, sport: prefill?.sport, jerseyStyle: hasJersey && jerseyStyle ? jerseyStyle : undefined, jerseyMaterial: hasJersey ? material : undefined, items, roster: [...rows, ...bulkRows()], designToken: prefill?.designToken, smsConsent: smsOptIn, deliveryTermsAccepted: true, specConfirmed: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setStatus("done");
      saveRememberedContact({ name: contactName, email: contactEmail, phone: contactPhone });
      setMessage(`Order ${data.reference} submitted! We'll be in touch with your total.`);
      if (data.manageUrl) setManageUrl(data.manageUrl);
    } catch (e) { setStatus("error"); setMessage((e as Error).message); }
  }

  async function createLink() {
    setStatus("sending"); setMessage("");
    try {
      const res = await fetch("/api/team-order/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamName, contactName, contactEmail, contactPhone, sport: prefill?.sport, jerseyStyle: hasJersey && jerseyStyle ? jerseyStyle : undefined, jerseyMaterial: hasJersey ? material : undefined, items, designToken: prefill?.designToken, smsConsent: smsOptIn }),
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
        {manageUrl && (
          <div className="mt-6 text-left bg-ink border border-line p-4">
            <p className="display text-sm text-foreground">📌 Save your order link</p>
            <p className="mt-1 text-sm text-muted">
              This is your page for this order - check its status anytime, and if someone joins the
              team later you can add extra jerseys and pay for just those pieces right there.
            </p>
            <div className="mt-3 flex gap-2">
              <input readOnly value={manageUrl} className="flex-1 bg-steel border border-line px-3 py-2 text-xs text-foreground/80" />
              <button
                type="button"
                onClick={() => copyLink(manageUrl, "manage")}
                className="clip-slant bg-brand text-on-brand display text-sm px-4 py-2 hover:bg-brand-dark"
              >
                {copied === "manage" ? "Copied ✓" : "Copy"}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {!hasApprovedDesign && (
        <div className="border border-brand/60 bg-brand/[0.08] p-4" role="alert">
          <p className="display text-foreground">Approved design required before submission</p>
          <p className="mt-1 text-sm text-muted">
            You can create a roster link and let players add their sizes now, but the final order cannot be submitted until your artwork is approved.
          </p>
          <a href="/design" className="mt-3 inline-flex clip-slant bg-brand px-4 py-2 text-sm display text-on-brand hover:bg-brand-dark">
            Start free design
          </a>
        </div>
      )}

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

      {/* Team + contact - locked when arriving from an approved design so the
          team-order stays tied to the design (same name = same job). */}
      {prefill ? (
        <div className="bg-steel border border-brand/40 p-4 space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="display text-foreground">{prefill.teamName}</span>
            <span className="text-[10px] uppercase tracking-wider text-brand">From approved design</span>
          </div>
          <p className="text-xs text-muted">
            {prefill.contactName} · {prefill.contactEmail}{prefill.contactPhone ? ` · ${prefill.contactPhone}` : ""}
          </p>
          <p className="text-[11px] text-muted/80">
            Team name &amp; contact are locked to keep this order tied to your approved design.
            Need to change them? Email <a href="mailto:apparel@sluggerathletics.com" className="underline">apparel@sluggerathletics.com</a>.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="team-order-team-name" className="display text-sm text-foreground">Team Name *</label>
            <input id="team-order-team-name" name="teamName" autoComplete="organization" required className={`mt-2 ${inputCls}`} value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="e.g. Sandstorm" />
          </div>
          <div>
            <label htmlFor="team-order-contact-name" className="display text-sm text-foreground">Your Name *</label>
            <input id="team-order-contact-name" name="contactName" autoComplete="name" required className={`mt-2 ${inputCls}`} value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Coach / contact" />
          </div>
          <div>
            <label htmlFor="team-order-email" className="display text-sm text-foreground">Email *</label>
            <input id="team-order-email" name="contactEmail" type="email" autoComplete="email" required className={`mt-2 ${inputCls}`} value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="email@team.com" />
          </div>
          <div>
            <label htmlFor="team-order-phone" className="display text-sm text-foreground">Phone</label>
            <input id="team-order-phone" name="contactPhone" type="tel" autoComplete="tel" className={`mt-2 ${inputCls}`} value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="(000) 000-0000" />
          </div>
          <div className="sm:col-span-2">
            <SmsConsentNote onChange={setSmsOptIn} />
          </div>
        </div>
      )}

      {/* Jersey style - editable in both flows; only relevant with a jersey */}
      {hasJersey && (
      <div>
        <label htmlFor="team-order-jersey-style" className="display text-sm text-foreground">Jersey Style *</label>
        <select
          id="team-order-jersey-style"
          name="jerseyStyle"
          required
          className={`mt-2 ${inputCls}`}
          value={jerseyStyle}
          onChange={(event) => {
            const nextStyle = event.target.value;
            setJerseyStyle(nextStyle);
            if (!materialTouched) setMaterial(fabricForStyle(nextStyle));
          }}
        >
          <option value="">Select a style</option>
          {JERSEY_STYLES.map((s) => (
            <option key={s} value={s}>
              {s} — ${s === "V-Neck" ? 30 : s === "Two Button" ? 32 : s === "Full Button" ? 35 : s === "Quarter-Zip" ? 40 : 28}
            </option>
          ))}
        </select>
      </div>
      )}

      {/* Jersey material */}
      {hasJersey && (
      <div>
        <p className="display text-sm text-foreground">Jersey Material *</p>
        <p className="mt-1 text-sm text-muted">Choose the fabric you expect to receive. You will confirm it again before submission.</p>
        <div className="mt-3 grid sm:grid-cols-2 gap-3">
          {JERSEY_MATERIALS.map((m) => {
            const on = material === m.key;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => { setMaterial(m.key); setMaterialTouched(true); }}
                aria-pressed={on}
                className={`relative min-h-11 text-left p-4 border transition-colors ${on ? "border-brand bg-steel" : "border-line hover:border-brand/50"}`}
              >
                {m.recommended && (
                  <span className="absolute top-3 right-3 display text-[10px] uppercase tracking-wider text-on-brand bg-brand px-1.5 py-0.5">
                    Recommended
                  </span>
                )}
                <span className="display text-foreground">{on ? "✓ " : ""}{m.label}</span>
                <p className="text-sm text-muted mt-1">{m.description}</p>
              </button>
            );
          })}
        </div>
      </div>
      )}

      {/* Item types */}
      <div>
        <p className="display text-sm text-foreground">What is the team ordering?</p>
        <p className="text-sm text-muted mt-1">Jersey is included by default - add any extras. Each player chooses their own items below (leave a size blank if they&apos;re not getting that item).</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {ITEM_TYPES.map((t) => {
            const on = items.includes(t.key);
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => toggleItem(t.key)}
                aria-pressed={on}
                className={`min-h-11 clip-slant display text-sm px-4 py-2 transition-colors ${on ? "bg-brand text-on-brand" : "bg-steel border border-line text-foreground/80 hover:border-brand/50"}`}
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
            <p className="text-sm text-muted mt-1">A size for each item is all we need - name and number are optional (leave them blank for plain gear with no personalization). Names print in CAPS. <a href={sizeGuideHref} target="_blank" className="text-brand underline underline-offset-2">Open the right size guide ↗</a></p>

            {needsDesign && hasJersey && (
              <div className="mt-3 bg-steel border border-brand/40 p-3">
                <p className="display text-sm text-foreground">This team has {designs.length} designs - pick which one each player gets below.</p>
                <div className="mt-2 flex flex-wrap gap-4">
                  {designs.map((d) => (
                    <div key={d.label} className="flex items-center gap-2 text-xs text-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={d.image} alt={d.label} className="h-12 w-12 object-contain bg-white border border-line rounded" />
                      {d.label}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4">
              <RosterImport
                itemKeys={perPlayerKeys}
                sport={prefill?.sport}
                confirmLabel={undefined}
                onConfirm={(imported: ImportedRow[]) => {
                  const asRows: Row[] = imported.map((r) => ({
                    name: r.name,
                    number: r.number,
                    sizes: r.sizes,
                    notes: r.notes ?? "",
                    design: soleDesign,
                  }));
                  // Replace untouched empty rows; keep anything already typed.
                  setRows((prev) => [
                    ...prev.filter((row) => row.name || row.number || Object.keys(row.sizes).length),
                    ...asRows,
                  ]);
                }}
              />
            </div>

            <div className="mt-4 space-y-3">
              {rows.map((row, i) => (
                <div key={i} className="border border-line p-3 space-y-3">
                  <div className="flex gap-2 items-start">
                    <input name={`player-${i}-name`} aria-label={`Player ${i + 1} name`} className={inputCls} value={row.name} onChange={(e) => update(i, "name", e.target.value)} placeholder="Player name" />
                    <input name={`player-${i}-number`} aria-label={`Player ${i + 1} number`} className={`${inputCls} max-w-24`} value={row.number} onChange={(e) => update(i, "number", e.target.value)} placeholder="#" maxLength={4} />
                    <button type="button" onClick={() => removeRow(i)} className="min-h-11 min-w-11 text-muted hover:text-brand px-2 py-2.5" aria-label={`Remove player ${i + 1}`}>✕</button>
                  </div>
                  {needsDesign && hasJersey && (
                    <select
                      className={`${inputCls} ${row.design ? "" : "border-brand/60 text-brand"}`}
                      value={row.design}
                      onChange={(e) => update(i, "design", e.target.value)}
                      aria-label="Which design"
                    >
                      <option value="">Which design?</option>
                      {designs.map((d) => <option key={d.label} value={d.label} className="text-foreground">{d.label}</option>)}
                    </select>
                  )}
                  {perPlayerSizeFields.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {perPlayerSizeFields.map((field) => (
                        <select key={field.key} className={inputCls} value={row.sizes[field.key] ?? ""} onChange={(e) => updateSize(i, field.key, e.target.value)}>
                          <option value="">{field.label} size</option>
                          {field.sizes.map((s) => <option key={s}>{s}</option>)}
                        </select>
                      ))}
                    </div>
                  )}
                  <input name={`player-${i}-notes`} aria-label={`Player ${i + 1} notes`} className={inputCls} value={row.notes} onChange={(e) => update(i, "notes", e.target.value)} placeholder="Notes (optional)" />
                </div>
              ))}
            </div>

            <button onClick={addRow} className="mt-3 clip-slant bg-steel border border-line text-foreground display text-sm px-5 py-2.5 hover:border-brand/50">
              + Add Player
            </button>
          </div>

          {/* Hats: ordered in bulk by size, not per player. */}
          {bulkSelected.length > 0 && (
            <div>
              <h2 className="display text-xl text-foreground">Hats <span className="text-base text-muted">(order by size)</span></h2>
              <p className="text-sm text-muted mt-1">Hats aren&apos;t name-specific - just enter how many you need of each size.</p>
              <div className="mt-3 space-y-3">
                {bulkSelected.map((t) => {
                  const total = t.sizes.reduce((a, s) => a + (hatQty[t.key]?.[s] ?? 0), 0);
                  return (
                    <div key={t.key} className="border border-line p-3">
                      <div className="flex items-baseline justify-between">
                        <p className="display text-sm text-foreground">{t.label}</p>
                        <span className="text-sm text-muted">{total} total</span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {t.sizes.map((s) => (
                          <label key={s} className="flex items-center gap-2">
                            <span className="text-sm text-muted min-w-[3.5rem]">{s}</span>
                            <input
                              type="number"
                              min={0}
                              inputMode="numeric"
                              value={hatQty[t.key]?.[s] ?? ""}
                              onChange={(e) => setQty(t.key, s, Math.max(0, parseInt(e.target.value) || 0))}
                              placeholder="0"
                              className={`${inputCls} max-w-20`}
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {status === "error" && <p className="text-sm text-brand">{message}</p>}

          <button
            onClick={() => { setRosterAck(false); setDeliveryAck(false); setConfirmingSubmit(true); }}
            disabled={status === "sending" || !hasApprovedDesign || !orderSetupComplete}
            className="clip-slant bg-brand hover:bg-brand-dark text-on-brand display text-lg px-8 py-4 transition-colors disabled:opacity-60"
          >
            {status === "sending"
              ? "Submitting…"
              : !hasApprovedDesign
                ? "Approved design required"
                : !orderSetupComplete
                  ? "Choose products, style, and material"
                  : "Review & Submit Team Order"}
          </button>
          <p className="text-xs text-muted">
            {hasApprovedDesign
              ? "No payment now - we'll email your total and 50% deposit invoice."
              : "Need to collect sizes first? Choose “Let players enter their own” above to create a draft roster link."}
          </p>
          <p className="text-xs text-muted">⏱ Working toward a deadline? Order as early as you can and build in a buffer. We push hard to hit every date, but carrier and shipping delays can happen and are outside our control - if your date is firm, tell us before you order and we&apos;ll be straight with you about it.</p>

          {confirmingSubmit && (
            <div
              className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="direct-order-confirm-title"
              onClick={(event) => { if (event.target === event.currentTarget && status !== "sending") setConfirmingSubmit(false); }}
            >
              <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-steel border border-brand/60 p-6 text-left">
                <p className="display text-xs uppercase tracking-[0.16em] text-brand">Final review</p>
                <h2 id="direct-order-confirm-title" className="display text-2xl text-foreground mt-1">Confirm your team order</h2>
                <p className="mt-2 text-sm text-muted">This exact summary is saved with your order when you submit.</p>

                <div className="mt-4">
                  <OrderSpecificationCard spec={submissionSpec} compact />
                </div>

                <label className="mt-4 flex cursor-pointer select-none items-start gap-2.5 border border-line p-3 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={rosterAck}
                    onChange={(event) => setRosterAck(event.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
                  />
                  <span>I confirm the material, approved artwork, products, roster, sizes, service level, date, and subtotal above are correct.</span>
                </label>

                <div className="mt-4">
                  <DeliveryTimingAcknowledgment
                    id="direct-order-delivery-timing-ack"
                    checked={deliveryAck}
                    onChange={setDeliveryAck}
                  />
                </div>

                {status === "error" && <p className="mt-3 text-sm text-brand">{message}</p>}
                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={submit}
                    disabled={!rosterAck || !deliveryAck || status === "sending"}
                    className="clip-slant bg-brand hover:bg-brand-dark text-on-brand display px-6 py-3 disabled:opacity-50"
                  >
                    {status === "sending" ? "Submitting…" : "Accept & submit order"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingSubmit(false)}
                    disabled={status === "sending"}
                    className="clip-slant border border-line text-foreground display px-5 py-3 hover:bg-foreground/5 disabled:opacity-50"
                  >
                    Go back
                  </button>
                </div>
              </div>
            </div>
          )}
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
