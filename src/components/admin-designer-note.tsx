"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Admin: set a designer/production note on a team order. Saving pushes it to
 *  Discord so the designer sees it. */
export function AdminDesignerNote({ teamOrderId, current }: { teamOrderId: string; current: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(current ?? "");
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/admin/team-order/designer-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamOrderId, note: note.trim(), notify }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      setOpen(false);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); setErr(""); }}
        title="Add a note for the designer/production (pushed to Discord)"
        className="text-xs display text-muted border border-line px-2 py-0.5 hover:border-brand/50 hover:text-foreground whitespace-nowrap"
      >
        Note{current ? " " : ""}
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] bg-black/60 grid place-items-center p-4" onClick={() => !busy && setOpen(false)}>
          <div className="w-full max-w-md bg-steel border border-line p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="display text-lg text-foreground">Designer note</h3>
            <p className="text-sm text-muted mt-1">A note for the designer/production - e.g. &quot;light grey, not the dark one.&quot; Saved on the order.</p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 1000))}
              rows={4}
              placeholder="Type the note the designer should see"
              className="mt-3 w-full bg-ink border border-line px-3 py-2.5 text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none resize-y"
            />
            <label className="mt-2 flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="accent-[color:var(--brand-gold)]" />
              <span className="text-muted">Ping the designer on Discord</span>
            </label>
            {err && <p className="text-sm text-red-400 mt-2">{err}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} disabled={busy} className="text-sm display text-muted border border-line px-4 py-2 hover:text-foreground disabled:opacity-50">Cancel</button>
              <button type="button" onClick={save} disabled={busy} className="text-sm display text-on-brand bg-brand hover:bg-brand-dark px-4 py-2 rounded disabled:opacity-50">{busy ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
