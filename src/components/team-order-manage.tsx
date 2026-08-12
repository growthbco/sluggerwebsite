"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { itemLabel, sizesFor, sizeBreakdown, JERSEY_MATERIALS } from "@/lib/order-items";
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
  shareUrl: string;
  roster: RosterRow[];
  submitted: boolean;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  colors?: string | null;
  placedAt?: string | null; // ISO string of when the order came in
  locked?: boolean; // order shipped/cancelled: roster is read-only
};

function rowSizes(r: RosterRow, items: string[]): string {
  return items
    .map((k) => {
      const v = r.sizes?.[k] ?? (k === "jersey" ? r.size : undefined);
      return v ? `${itemLabel(k)}: ${v}` : null;
    })
    .filter(Boolean)
    .join(" · ");
}

export function TeamOrderManage({ token, reference, teamName, jerseyStyle, jerseyMaterial, items, shareUrl, roster, submitted, contactName, contactEmail, contactPhone, colors, placedAt, locked }: Props) {
  const materialLabel = jerseyMaterial
    ? JERSEY_MATERIALS.find((m) => m.key === jerseyMaterial)?.label ?? jerseyMaterial
    : null;
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">(submitted ? "done" : "idle");
  const [message, setMessage] = useState("");

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
  const [manual, setManual] = useState<{ name: string; number: string; sizes: Record<string, string> }>({
    name: "",
    number: "",
    sizes: {},
  });
  const [manualBusy, setManualBusy] = useState(false);
  const [manualError, setManualError] = useState("");

  async function addManual() {
    if (!manual.name.trim()) return;
    setManualBusy(true);
    setManualError("");
    try {
      await importRows([{ name: manual.name, number: manual.number, sizes: manual.sizes }]);
      setManual({ name: "", number: "", sizes: {} });
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

  return (
    <div className="space-y-8">
      <header>
        <span className="display text-brand text-sm">{teamName} · {reference}</span>
        <h1 className="display text-3xl sm:text-4xl text-foreground mt-1">Manage Team Order</h1>
        {(jerseyStyle || materialLabel) && (
          <p className="text-muted mt-1">{[jerseyStyle, materialLabel].filter(Boolean).join(" · ")}</p>
        )}
        <dl className="mt-4 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr] border-t border-line pt-4">
          {(contactName || contactEmail || contactPhone) && (
            <>
              <dt className="text-muted">Placed by</dt>
              <dd className="text-foreground">
                {[contactName, contactEmail, contactPhone].filter(Boolean).join(" · ")}
              </dd>
            </>
          )}
          {colors && (
            <>
              <dt className="text-muted">Colors</dt>
              <dd className="text-foreground">{colors}</dd>
            </>
          )}
          <dt className="text-muted">Items</dt>
          <dd className="text-foreground">{items.map((k) => itemLabel(k)).join(" · ") || "Jersey"}</dd>
          {placedAt && (
            <>
              <dt className="text-muted">Order placed</dt>
              <dd className="text-foreground">
                {new Date(placedAt).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
              </dd>
            </>
          )}
        </dl>
      </header>

      {/* Share link */}
      <div className="bg-steel border border-line p-5">
        <h2 className="display text-lg text-foreground">Share this link with your players</h2>
        <p className="text-sm text-muted mt-1">Each player opens it and enters their own name, number, and size.</p>
        <div className="mt-3 flex gap-2">
          <input readOnly value={shareUrl} className="flex-1 bg-ink border border-line px-3 py-2.5 text-sm text-foreground/80" />
          <button onClick={copy} className="clip-slant bg-brand text-on-brand display text-sm px-5 py-2.5 hover:bg-brand-dark">
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>
      </div>

      {/* Coach bulk import: paste or photograph the roster they were sent. */}
      {status !== "done" && <RosterImport itemKeys={items} onConfirm={importRows} />}

      {/* Roster */}
      <div>
        <div className="flex items-center justify-between">
          <h2 className="display text-xl text-foreground">Roster</h2>
          <span className="text-sm text-muted">{roster.length} players</span>
        </div>
        {status !== "done" && (
          <div className="mt-3 bg-steel border border-line p-3">
            <p className="text-sm text-muted mb-2">Or add a player yourself:</p>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                value={manual.name}
                onChange={(e) => setManual((m) => ({ ...m, name: e.target.value }))}
                placeholder="Player name"
                maxLength={60}
                className="flex-1 min-w-32 bg-ink border border-line px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
              />
              <input
                value={manual.number}
                onChange={(e) => setManual((m) => ({ ...m, number: e.target.value }))}
                placeholder="#"
                maxLength={4}
                className="w-14 bg-ink border border-line px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
              />
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
                    <option key={s}>{s}</option>
                  ))}
                </select>
              ))}
              <button
                type="button"
                onClick={addManual}
                disabled={manualBusy || !manual.name.trim()}
                className="clip-slant bg-brand text-on-brand display text-sm px-4 py-2 hover:bg-brand-dark disabled:opacity-50"
              >
                {manualBusy ? "Adding..." : "Add player"}
              </button>
            </div>
            {manualError && <p className="mt-2 text-sm text-brand">{manualError}</p>}
          </div>
        )}

        {roster.length > 0 && (() => {
          const breakdown = sizeBreakdown(roster, items);
          return breakdown.length > 0 ? (
            <div className="mt-4 border border-line bg-steel p-4">
              <p className="display text-sm text-foreground">Size breakdown ({roster.length} players)</p>
              <div className="mt-2 space-y-1.5">
                {breakdown.map((b) => (
                  <div key={b.key} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                    <span className="text-muted min-w-[7rem]">{b.label}:</span>
                    <span className="text-foreground">
                      {b.parts.map((p) => `${p.n} ${p.size}`).join(" · ")}
                    </span>
                    <span className="text-muted">({b.total})</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null;
        })()}

        {roster.length === 0 ? (
          <p className="mt-3 text-muted text-sm">No players yet - share the link above, import, or add them here.</p>
        ) : (
          <>
            {!locked && <p className="mt-4 mb-1 text-xs text-muted">Need to fix a size, name, or number? Tap <span className="text-foreground">Edit</span> on any player - changes save right away, even after you&apos;ve submitted.</p>}
            <div className="mt-1 border border-line divide-y divide-[color:var(--line)]">
              {roster.map((r, i) => (
                <RosterRowItem key={r.id} token={token} row={r} index={i} items={items} locked={locked} onChange={() => router.refresh()} />
              ))}
            </div>
          </>
        )}
      </div>

      {status === "done" ? (
        <div className="bg-steel border border-line p-6 text-center">
          <div className="mx-auto h-12 w-12 grid place-items-center clip-slant bg-brand text-on-brand display text-xl">✓</div>
          <h3 className="display text-xl text-foreground mt-3">Order Submitted</h3>
          <p className="mt-2 text-muted text-sm">Sent to Slugger Athletics. We&apos;ll email your total and a design proof to approve.</p>
        </div>
      ) : (
        <div>
          {status === "error" && <p className="text-sm text-brand mb-3">{message}</p>}
          <button
            onClick={submit}
            disabled={status === "sending" || roster.length === 0}
            className="clip-slant bg-brand hover:bg-brand-dark text-on-brand display text-lg px-8 py-4 transition-colors disabled:opacity-60"
          >
            {status === "sending" ? "Submitting…" : "Submit Team Order"}
          </button>
          <p className="text-xs text-muted mt-3">Refresh to see new players. Submitting closes the roster and sends it to us.</p>
        </div>
      )}
    </div>
  );
}

/** One roster row: read-only by default, tap Edit to correct name/number/size/
 *  notes or remove the player. Works after submission (blocked only once the
 *  order has shipped). */
function RosterRowItem({ token, row, index, items, locked, onChange }: {
  token: string;
  row: RosterRow;
  index: number;
  items: string[];
  locked?: boolean;
  onChange: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState(row.playerName ?? "");
  const [number, setNumber] = useState(row.playerNumber ?? "");
  const [notes, setNotes] = useState(row.notes ?? "");
  const [sizes, setSizes] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const k of items) init[k] = row.sizes?.[k] ?? (k === "jersey" ? row.size ?? "" : "");
    return init;
  });

  async function save() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/team-order/${token}/roster`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowId: row.id, playerName: name, playerNumber: number, notes, sizes }),
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
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Player name" maxLength={60} className="flex-1 min-w-32 bg-ink border border-line px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none" />
          <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="#" maxLength={4} className="w-14 bg-ink border border-line px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none" />
          {items.map((k) => (
            <select key={k} value={sizes[k] ?? ""} onChange={(e) => setSizes((s) => ({ ...s, [k]: e.target.value }))} className="bg-ink border border-line px-2 py-2 text-sm text-foreground focus:border-brand focus:outline-none" aria-label={`${itemLabel(k)} size`}>
              <option value="">{itemLabel(k)}: -</option>
              {sizesFor(k).map((s) => (<option key={s}>{s}</option>))}
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
      <span className="text-foreground font-medium uppercase flex-1 min-w-0 truncate">{row.playerName || "-"}</span>
      <span className="text-muted w-8 shrink-0">#{row.playerNumber || "-"}</span>
      <span className="text-muted flex-[2] min-w-0 truncate">{rowSizes(row, items) || "-"}{row.quantity && row.quantity > 1 ? ` ×${row.quantity}` : ""}</span>
      <span className="text-muted flex-1 min-w-0 truncate hidden sm:block">{[row.design, row.notes].filter(Boolean).join(" · ")}</span>
      {!locked && (
        <button type="button" onClick={() => setEditing(true)} className="shrink-0 display text-xs text-brand border border-brand/40 px-2.5 py-1 hover:bg-brand/10">Edit</button>
      )}
    </div>
  );
}
