"use client";

import { useState } from "react";
import { itemLabel } from "@/lib/order-items";

type RosterRow = {
  id: string;
  playerName: string | null;
  playerNumber: string | null;
  size: string | null;
  sizes: Record<string, string> | null;
  notes: string | null;
};

type Props = {
  token: string;
  reference: string;
  teamName: string;
  jerseyStyle: string | null;
  items: string[];
  shareUrl: string;
  roster: RosterRow[];
  submitted: boolean;
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

export function TeamOrderManage({ token, reference, teamName, jerseyStyle, items, shareUrl, roster, submitted }: Props) {
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">(submitted ? "done" : "idle");
  const [message, setMessage] = useState("");

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
        {jerseyStyle && <p className="text-muted mt-1">{jerseyStyle}</p>}
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

      {/* Roster */}
      <div>
        <div className="flex items-center justify-between">
          <h2 className="display text-xl text-foreground">Roster</h2>
          <span className="text-sm text-muted">{roster.length} players</span>
        </div>
        {roster.length === 0 ? (
          <p className="mt-3 text-muted text-sm">No players yet - share the link above to start collecting.</p>
        ) : (
          <div className="mt-4 border border-line divide-y divide-[color:var(--line)]">
            {roster.map((r, i) => (
              <div key={r.id} className="grid grid-cols-[auto_1.4fr_0.5fr_2fr_1fr] gap-3 px-4 py-2.5 text-sm">
                <span className="text-muted">{i + 1}</span>
                <span className="text-foreground font-medium uppercase">{r.playerName || "-"}</span>
                <span className="text-muted">#{r.playerNumber || "-"}</span>
                <span className="text-muted">{rowSizes(r, items) || "-"}</span>
                <span className="text-muted">{r.notes || ""}</span>
              </div>
            ))}
          </div>
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
