"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { itemLabel, sizesFor, sizeBreakdown, formatSize, JERSEY_MATERIALS } from "@/lib/order-items";
import { RosterImport, type ImportedRow } from "@/components/roster-import";

type RosterRow = {
  id: string;
  playerName: string | null;
  playerNumber: string | null;
  size: string | null;
  sizes: Record<string, string> | null;
  notes: string | null;
  design?: string | null;
  quantity?: number | null;
};

type Props = {
  token: string;
  reference: string;
  teamName: string;
  jerseyStyle: string | null;
  jerseyMaterial: string | null;
  items: string[];
  /** Approved colorways/designs. >1 turns on the per-row design picker so each
   *  player ties to the right artwork (Pin Daddy / Pin Mommy, etc.). */
  designs?: { label: string; image: string; sku?: string | null }[];
  shareUrl: string;
  roster: RosterRow[];
  submitted: boolean;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  colors?: string | null;
  placedAt?: string | null; // ISO string of when the order came in
  locked?: boolean; // order shipped/cancelled: roster is read-only
  requiresNames?: boolean; // "names on the back?" survey answer
  minPieces?: number; // order minimum (6 default, cheer 12)
  // True when this order came from an already-approved design (proof is done) -
  // so the post-submit next step is the 50% deposit invoice, not a proof.
  nextIsDeposit?: boolean;
  // Final submission is only available once approved artwork is attached. A
  // draft roster remains editable while artwork is missing or pending.
  designState?: "approved" | "pending" | "missing";
  quote?: { lines: { label: string; quantity: number; unitPriceCents: number; totalCents: number }[]; totalCents: number } | null; // live running total
  // "Add to this order" block (the add-on form), shown right under the submitted
  // banner so coaches actually find it - the #1 thing they ask for.
  addonSlot?: React.ReactNode;
};

function rowSizes(r: RosterRow, items: string[]): string {
  return items
    .map((k) => {
      const v = r.sizes?.[k] ?? (k === "jersey" ? r.size : undefined);
      return v ? `${itemLabel(k)}: ${formatSize(v)}` : null;
    })
    .filter(Boolean)
    .join(" · ");
}

export function TeamOrderManage({ token, reference, teamName, jerseyStyle, jerseyMaterial, items, designs = [], shareUrl, roster, submitted, contactName, contactEmail, contactPhone, colors, placedAt, locked, requiresNames = true, minPieces = 6, quote, nextIsDeposit = false, designState = "approved", addonSlot }: Props) {
  // >1 approved design -> show the "which design?" picker on every add/edit row.
  const needsDesign = designs.length > 1;
  const soleDesign = designs.length === 1 ? designs[0].label : "";
  const nextStepCopy = nextIsDeposit
    ? "We'll email your total and the 50% deposit invoice to start production."
    : "We'll email your total and a design proof to approve.";
  const materialLabel = jerseyMaterial
    ? JERSEY_MATERIALS.find((m) => m.key === jerseyMaterial)?.label ?? jerseyMaterial
    : null;
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">(submitted ? "done" : "idle");
  const [message, setMessage] = useState("");

  // "Names on the back?" survey. Controls whether the name field shows for
  // players and in the coach's add/edit rows. Saved to the order on change.
  const [needsNames, setNeedsNames] = useState(requiresNames);
  const [needsNamesBusy, setNeedsNamesBusy] = useState(false);
  async function saveNeedsNames(value: boolean) {
    setNeedsNames(value); // optimistic
    setNeedsNamesBusy(true);
    try {
      const res = await fetch(`/api/team-order/${token}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requiresNames: value }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setNeedsNames(!value); // revert on failure
    } finally {
      setNeedsNamesBusy(false);
    }
  }

  async function importRows(rows: ImportedRow[]) {
    const res = await fetch(`/api/team-order/${token}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not add players");
    router.refresh();
  }

  // Manual single-player add (besides the share link and the AI import).
  const [manual, setManual] = useState<{ name: string; number: string; sizes: Record<string, string>; design: string }>({
    name: "",
    number: "",
    sizes: {},
    design: soleDesign,
  });
  const [manualBusy, setManualBusy] = useState(false);
  const [manualError, setManualError] = useState("");

  // With names on, a name is required to add. With names off, a number or a
  // size is enough (cheer/number-only rosters have no name to key off).
  const canAddManual = needsNames
    ? Boolean(manual.name.trim())
    : Boolean(manual.number.trim() || Object.values(manual.sizes).some(Boolean));

  async function addManual() {
    if (!canAddManual) return;
    if (needsDesign && !manual.design) { setManualError("Pick a design for this player."); return; }
    setManualBusy(true);
    setManualError("");
    try {
      await importRows([{ name: manual.name, number: manual.number, sizes: manual.sizes, design: manual.design }]);
      setManual({ name: "", number: "", sizes: {}, design: soleDesign });
    } catch (e) {
      setManualError((e as Error).message);
    } finally {
      setManualBusy(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function submit() {
    if (designState !== "approved") {
      setStatus("error");
      setMessage(
        designState === "pending"
          ? "Your design must be approved before you can submit this order. You can keep building the roster while it is finished."
          : "An approved design is required before you can submit this order. Start your free design first.",
      );
      return;
    }
    if (!confirm("Submit this order? Players won't be able to add themselves after this.")) return;
    setStatus("sending");
    try {
      const res = await fetch(`/api/team-order/${token}/submit`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not submit");
      setStatus("done");
    } catch (e) {
      setStatus("error");
      setMessage((e as Error).message);
    }
  }

  const collecting = status !== "done" && !locked;
  // Hard minimum only where the item demands it (cheer = 12); standard 6-piece
  // orders get a soft nudge but can still submit, matching the server.
  const hardMin = minPieces > 6;
  const belowHardMin = hardMin && roster.length < minPieces;
  const needMore = Math.max(0, minPieces - roster.length);

  return (
    <div className="space-y-8">
      <header>
        <span className="display text-brand text-sm">{teamName} · {reference}</span>
        <h1 className="display text-2xl sm:text-3xl text-foreground mt-1">
          {collecting ? "Fill Your Team Roster" : "Team Order"}
        </h1>
        <p className="text-muted mt-1 text-sm">
          {[items.map((k) => itemLabel(k)).join(" · ") || "Jersey", jerseyStyle, materialLabel, colors]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {collecting && (
          <p className="mt-2 text-sm text-muted">
            Add everyone below, then submit. {nextStepCopy}
          </p>
        )}
      </header>

      {collecting ? (
        <>
          {/* Step 1 - one-time setup: names on the back or not. */}
          <Step n={1} title="Do players need a name on the back?">
            <p className="text-sm text-muted mb-3">
              {needsNames
                ? "Each player enters a name (and number) with their size."
                : "No name field - players just enter a number and size. Good for cheer and number-only uniforms."}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => saveNeedsNames(true)}
                disabled={needsNamesBusy}
                className={`clip-slant display text-sm px-5 py-2.5 border transition-colors disabled:opacity-60 ${needsNames ? "bg-brand text-on-brand border-brand" : "bg-ink text-muted border-line hover:border-brand/50"}`}
                aria-pressed={needsNames}
              >
                Yes, names on back
              </button>
              <button
                type="button"
                onClick={() => saveNeedsNames(false)}
                disabled={needsNamesBusy}
                className={`clip-slant display text-sm px-5 py-2.5 border transition-colors disabled:opacity-60 ${!needsNames ? "bg-brand text-on-brand border-brand" : "bg-ink text-muted border-line hover:border-brand/50"}`}
                aria-pressed={!needsNames}
              >
                No names
              </button>
            </div>
          </Step>

          {/* Step 2 - add players. Primary path (share link) up top, do-it-
              yourself options grouped and clearly secondary underneath. */}
          <Step n={2} title="Add your players">
            <div className="bg-steel border border-line p-5">
              <p className="display text-foreground">Fastest: send your players this link</p>
              <p className="text-sm text-muted mt-1">
                Each player opens it and enters their own {needsNames ? "name, number, and size" : "number and size"} - it drops straight onto your roster.
              </p>
              <div className="mt-3 flex gap-2">
                <input readOnly value={shareUrl} className="flex-1 min-w-0 bg-ink border border-line px-3 py-2.5 text-sm text-foreground/80" />
                <button onClick={copy} className="shrink-0 clip-slant bg-brand text-on-brand display text-sm px-5 py-2.5 hover:bg-brand-dark">
                  {copied ? "Copied ✓" : "Copy"}
                </button>
              </div>
            </div>

            <div className="mt-4">
              <div className="flex items-center gap-3 text-xs text-muted">
                <span className="h-px flex-1 bg-line" />
                or add them yourself
                <span className="h-px flex-1 bg-line" />
              </div>

              {/* Paste / photograph a roster you were sent. */}
              <div className="mt-4">
                <RosterImport itemKeys={items} onConfirm={importRows} />
              </div>

              {/* Type one player at a time. */}
              <div className="mt-4 bg-steel border border-line p-3">
                <p className="text-sm text-muted mb-2">Type a player in one at a time:</p>
                <div className="flex flex-wrap gap-2 items-center">
                  {needsNames && (
                    <input
                      value={manual.name}
                      onChange={(e) => setManual((m) => ({ ...m, name: e.target.value }))}
                      placeholder="Player name"
                      maxLength={60}
                      className="flex-1 min-w-32 bg-ink border border-line px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
                    />
                  )}
                  <input
                    value={manual.number}
                    onChange={(e) => setManual((m) => ({ ...m, number: e.target.value }))}
                    placeholder="#"
                    maxLength={4}
                    className="w-14 bg-ink border border-line px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
                  />
                  {needsDesign && (
                    <select
                      value={manual.design}
                      onChange={(e) => setManual((m) => ({ ...m, design: e.target.value }))}
                      className={`bg-ink border px-2 py-2 text-sm focus:border-brand focus:outline-none ${manual.design ? "border-line text-foreground" : "border-brand/60 text-brand"}`}
                      aria-label="Which design"
                    >
                      <option value="">Which design?</option>
                      {designs.map((d) => <option key={d.label} value={d.label} className="text-foreground">{d.label}</option>)}
                    </select>
                  )}
                  {items.map((k) => (
                    <select
                      key={k}
                      value={manual.sizes[k] ?? ""}
                      onChange={(e) => setManual((m) => ({ ...m, sizes: { ...m.sizes, [k]: e.target.value } }))}
                      className="bg-ink border border-line px-2 py-2 text-sm text-foreground focus:border-brand focus:outline-none"
                      aria-label={`${itemLabel(k)} size`}
                    >
                      <option value="">{itemLabel(k)}: -</option>
                      {sizesFor(k).map((s) => (
                        <option key={s} value={s}>{formatSize(s)}</option>
                      ))}
                    </select>
                  ))}
                  <button
                    type="button"
                    onClick={addManual}
                    disabled={manualBusy || !canAddManual}
                    className="clip-slant bg-brand text-on-brand display text-sm px-4 py-2 hover:bg-brand-dark disabled:opacity-50"
                  >
                    {manualBusy ? "Adding..." : "Add player"}
                  </button>
                </div>
                {manualError && <p className="mt-2 text-sm text-brand">{manualError}</p>}
              </div>
            </div>
          </Step>

          {/* Step 3 - review + submit. Roster, size breakdown, running total and
              the submit button all live together so "am I ready?" is answered
              right where the coach acts. */}
          <Step n={3} title="Review and submit">
            <RosterBlock
              token={token}
              roster={roster}
              items={items}
              designs={designs}
              needsDesign={needsDesign}
              locked={locked}
              needsNames={needsNames}
              onChange={() => router.refresh()}
            />

            {quote && quote.totalCents > 0 && (
              <RunningTotal quote={quote} />
            )}

            {designState !== "approved" && (
              <div className="mt-4 border border-brand/60 bg-brand/[0.08] p-4" role="alert">
                <p className="display text-foreground">
                  {designState === "pending" ? "Design approval required" : "This order needs a design"}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {designState === "pending"
                    ? "Keep building the roster now. Final submission unlocks as soon as your artwork is approved."
                    : "You can keep this roster, but you cannot submit the order until approved artwork is attached."}
                </p>
                {designState === "missing" && (
                  <a href="/design" className="mt-3 inline-flex clip-slant bg-brand px-4 py-2 text-sm display text-on-brand hover:bg-brand-dark">
                    Start free design
                  </a>
                )}
              </div>
            )}

            {status === "error" && <p className="text-sm text-brand mt-4">{message}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={submit}
                disabled={status === "sending" || roster.length === 0 || belowHardMin || designState !== "approved"}
                className="clip-slant bg-brand hover:bg-brand-dark text-on-brand display text-lg px-8 py-4 transition-colors disabled:opacity-60"
              >
                {status === "sending"
                  ? "Submitting…"
                  : designState === "missing"
                    ? "Approved design required"
                    : designState === "pending"
                      ? "Waiting for design approval"
                  : roster.length === 0
                    ? "Add players to submit"
                    : belowHardMin
                      ? `Add ${needMore} more to submit`
                      : `Submit Team Order (${roster.length})`}
              </button>
              {belowHardMin && (
                <span className="text-sm text-brand">{minPieces}-piece minimum for this uniform.</span>
              )}
            </div>
            <p className="text-xs text-muted mt-3">Submitting closes the roster and sends it to us. You can still fix a size or name afterward.</p>
          </Step>
        </>
      ) : (
        // Submitted or shipped/cancelled: no setup steps, just the roster (still
        // editable until it ships) and a status note.
        <>
          {status === "done" && (
            <div className="bg-steel border border-line p-6 text-center">
              <div className="mx-auto h-12 w-12 grid place-items-center clip-slant bg-brand text-on-brand display text-xl">✓</div>
              <h3 className="display text-xl text-foreground mt-3">Order Submitted</h3>
              <p className="mt-2 text-muted text-sm">Sent to Slugger Athletics. {nextStepCopy}</p>
            </div>
          )}
          {addonSlot}
          <div>
            <h2 className="display text-xl text-foreground mb-3">Your Roster</h2>
            <RosterBlock
              token={token}
              roster={roster}
              items={items}
              designs={designs}
              needsDesign={needsDesign}
              locked={locked}
              needsNames={needsNames}
              onChange={() => router.refresh()}
            />
          </div>
          {quote && quote.totalCents > 0 && <RunningTotal quote={quote} />}
        </>
      )}
    </div>
  );
}

/** Numbered step wrapper - gives the coach a clear 1-2-3 path instead of a
 *  stack of same-looking boxes. */
function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-2.5 mb-3">
        <span className="grid place-items-center h-7 w-7 clip-slant bg-brand text-on-brand display text-sm shrink-0">{n}</span>
        <h2 className="display text-lg sm:text-xl text-foreground">{title}</h2>
      </div>
      {children}
    </section>
  );
}

/** Running total card + collapsible price breakdown. Estimate only. */
function RunningTotal({ quote }: { quote: NonNullable<Props["quote"]> }) {
  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-baseline gap-2 border border-brand/40 bg-brand/5 px-4 py-3">
        <span className="display text-sm text-muted">Running total</span>
        <span className="display text-2xl text-foreground">${(quote.totalCents / 100).toFixed(2)}</span>
        <span className="text-xs text-muted">estimate - shipping and any tax added at invoice</span>
      </div>
      <details className="mt-2 border border-line bg-steel">
        <summary className="cursor-pointer px-4 py-2 text-sm text-muted list-none flex items-center justify-between">
          <span>Price breakdown</span>
          <span className="text-brand">+</span>
        </summary>
        <div className="px-4 pb-3 space-y-1">
          {quote.lines.map((l, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-muted">{l.label} × {l.quantity}</span>
              <span className="text-foreground">${(l.totalCents / 100).toFixed(2)}</span>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

/** Size-breakdown summary + the editable roster list (or an empty-state hint). */
function RosterBlock({ token, roster, items, designs = [], needsDesign = false, locked, needsNames, onChange }: {
  token: string;
  roster: RosterRow[];
  items: string[];
  designs?: { label: string; image: string; sku?: string | null }[];
  needsDesign?: boolean;
  locked?: boolean;
  needsNames: boolean;
  onChange: () => void;
}) {
  const breakdown = roster.length > 0 ? sizeBreakdown(roster, items) : [];
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">{roster.length} {roster.length === 1 ? "player" : "players"} on the roster</span>
      </div>

      {breakdown.length > 0 && (
        <div className="mt-2 border border-line bg-steel p-4">
          <p className="display text-sm text-foreground">Size breakdown</p>
          <div className="mt-2 space-y-1.5">
            {breakdown.map((b) => (
              <div key={b.key} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="text-muted min-w-[7rem]">{b.label}:</span>
                <span className="text-foreground">{b.parts.map((p) => `${p.n} ${p.size}`).join(" · ")}</span>
                <span className="text-muted">({b.total})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {roster.length === 0 ? (
        <p className="mt-3 text-muted text-sm">No players yet - use the share link or add them yourself above.</p>
      ) : (
        <>
          {!locked && <p className="mt-4 mb-1 text-xs text-muted">Need to fix a size, name, or number? Tap <span className="text-foreground">Edit</span> on any player - changes save right away, even after you&apos;ve submitted.</p>}
          <div className="mt-1 border border-line divide-y divide-[color:var(--line)]">
            {roster.map((r, i) => (
              <RosterRowItem key={r.id} token={token} row={r} index={i} items={items} designs={designs} needsDesign={needsDesign} locked={locked} needsNames={needsNames} onChange={onChange} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** One roster row: read-only by default, tap Edit to correct name/number/size/
 *  notes or remove the player. Works after submission (blocked only once the
 *  order has shipped). */
function RosterRowItem({ token, row, index, items, designs = [], needsDesign = false, locked, needsNames = true, onChange }: {
  token: string;
  row: RosterRow;
  index: number;
  items: string[];
  designs?: { label: string; image: string; sku?: string | null }[];
  needsDesign?: boolean;
  locked?: boolean;
  needsNames?: boolean;
  onChange: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState(row.playerName ?? "");
  const [number, setNumber] = useState(row.playerNumber ?? "");
  const [notes, setNotes] = useState(row.notes ?? "");
  const [design, setDesign] = useState(row.design ?? "");
  const [sizes, setSizes] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const k of items) init[k] = row.sizes?.[k] ?? (k === "jersey" ? row.size ?? "" : "");
    return init;
  });

  async function save() {
    setBusy(true);
    setError("");
    try {
      if (needsDesign && !design) { setError("Pick a design for this player."); setBusy(false); return; }
      const res = await fetch(`/api/team-order/${token}/roster`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowId: row.id, playerName: name, playerNumber: number, notes, sizes, ...(needsDesign ? { design } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save");
      setEditing(false);
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Remove ${row.playerName || "this player"} from the order?`)) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/team-order/${token}/roster`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowId: row.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not remove");
      onChange();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <div className="px-4 py-3 bg-ink/40">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-muted text-sm">{index + 1}</span>
          {needsNames && (
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Player name" maxLength={60} className="flex-1 min-w-32 bg-ink border border-line px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none" />
          )}
          <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="#" maxLength={4} className="w-14 bg-ink border border-line px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none" />
          {needsDesign && (
            <select value={design} onChange={(e) => setDesign(e.target.value)} className={`bg-ink border px-2 py-2 text-sm focus:border-brand focus:outline-none ${design ? "border-line text-foreground" : "border-brand/60 text-brand"}`} aria-label="Which design">
              <option value="">Which design?</option>
              {designs.map((d) => <option key={d.label} value={d.label} className="text-foreground">{d.label}</option>)}
            </select>
          )}
          {items.map((k) => (
            <select key={k} value={sizes[k] ?? ""} onChange={(e) => setSizes((s) => ({ ...s, [k]: e.target.value }))} className="bg-ink border border-line px-2 py-2 text-sm text-foreground focus:border-brand focus:outline-none" aria-label={`${itemLabel(k)} size`}>
              <option value="">{itemLabel(k)}: -</option>
              {sizesFor(k).map((s) => (<option key={s} value={s}>{formatSize(s)}</option>))}
            </select>
          ))}
        </div>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes / color (optional)" maxLength={200} className="mt-2 w-full bg-ink border border-line px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none" />
        {error && <p className="mt-2 text-sm text-brand">{error}</p>}
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={save} disabled={busy} className="clip-slant bg-brand text-on-brand display text-sm px-4 py-1.5 hover:bg-brand-dark disabled:opacity-50">{busy ? "Saving…" : "Save"}</button>
          <button type="button" onClick={() => { setEditing(false); setError(""); }} disabled={busy} className="display text-sm px-4 py-1.5 border border-line text-muted hover:text-foreground">Cancel</button>
          <button type="button" onClick={remove} disabled={busy} className="ml-auto display text-sm px-3 py-1.5 border border-red-500/40 text-red-400/80 hover:bg-red-500/10 disabled:opacity-50">Remove</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 text-sm">
      <span className="text-muted w-4 shrink-0">{index + 1}</span>
      {needsNames && <span className="text-foreground font-medium uppercase flex-1 min-w-0 truncate">{row.playerName || "-"}</span>}
      <span className="text-muted w-8 shrink-0">#{row.playerNumber || "-"}</span>
      <span className="text-muted flex-[2] min-w-0 truncate">{rowSizes(row, items) || "-"}{row.quantity && row.quantity > 1 ? ` ×${row.quantity}` : ""}</span>
      <span className="text-muted flex-1 min-w-0 truncate hidden sm:block">{[row.design, row.notes].filter(Boolean).join(" · ")}</span>
      {!locked && (
        <button type="button" onClick={() => setEditing(true)} className="shrink-0 display text-xs text-brand border border-brand/40 px-2.5 py-1 hover:bg-brand/10">Edit</button>
      )}
    </div>
  );
}
