"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Admin action: archive a team order or design request with a reason
 *  ("completed", "lost", "on hold") or bring it back. Archiving never deletes
 *  anything. Uses an in-app dropdown instead of a browser prompt. */
export function AdminArchiveButton({
  kind,
  id,
  archived,
}: {
  kind: "team_order" | "design_request" | "order";
  id: string;
  archived: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [custom, setCustom] = useState("");
  const [error, setError] = useState("");

  async function submit(note: string) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, id, archive: !archived, note }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Restoring needs no note - toggle straight away.
  function onClick() {
    if (archived) submit("");
    else setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="text-xs display text-muted border border-line px-2.5 py-1 hover:border-brand/50 hover:text-foreground disabled:opacity-50 whitespace-nowrap"
      >
        {busy ? "..." : archived ? "Restore" : "Archive"}
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] bg-black/60 grid place-items-center p-4" onClick={() => !busy && setOpen(false)}>
          <div className="w-full max-w-sm bg-steel border border-line p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="display text-lg text-foreground">Archive this order</h3>
            <p className="text-sm text-muted mt-1">Pick a reason for follow-up. Archiving never deletes anything - you can restore it anytime.</p>

            <label className="block text-xs display text-muted mt-4 mb-1">Reason</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-ink border border-line px-3 py-2.5 text-sm text-foreground focus:border-brand focus:outline-none"
            >
              {REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>

            {reason === "Other" && (
              <input
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="Type a note"
                autoFocus
                className="mt-2 w-full bg-ink border border-line px-3 py-2.5 text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
              />
            )}

            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
                className="text-sm display text-muted border border-line px-4 py-2 hover:text-foreground disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => submit(reason === "Other" ? custom.trim() : reason)}
                disabled={busy || (reason === "Other" && !custom.trim())}
                className="text-sm display text-on-brand bg-brand hover:bg-brand-dark px-4 py-2 rounded disabled:opacity-50"
              >
                {busy ? "Archiving..." : "Archive"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const REASONS = [
  "Completed",
  "Lost - budget",
  "Lost - chose another vendor",
  "On hold until fall",
  "On hold until next season",
  "Duplicate / test order",
  "Other",
];
