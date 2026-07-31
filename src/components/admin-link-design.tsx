"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type DesignOpt = { id: string; teamName: string; reference: string };

/** Admin: manually link a standalone team order (one that didn't auto-link,
 *  e.g. the coach used a different email) to a design request. */
export function AdminLinkDesign({ teamOrderId, designs }: { teamOrderId: string; designs: DesignOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function link() {
    if (!choice || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/team-order/link-design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamOrderId, designRequestId: choice }),
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

  if (!designs.length) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); setError(""); }}
        title="This order isn't linked to a design. Link it so it joins that project's Discord thread + print-file QA."
        className="text-xs display text-muted border border-line px-2 py-0.5 hover:border-brand/50 hover:text-foreground whitespace-nowrap"
      >
        🔗 Link to design
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] bg-black/60 grid place-items-center p-4" onClick={() => !busy && setOpen(false)}>
          <div className="w-full max-w-md bg-steel border border-line p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="display text-lg text-foreground">Link this order to a design</h3>
            <p className="text-sm text-muted mt-1">
              It&apos;ll join that design&apos;s Discord thread and print-file QA. Use this when the order came in under a different email than the design.
            </p>
            <select
              value={choice}
              onChange={(e) => setChoice(e.target.value)}
              className="mt-4 w-full bg-ink border border-line px-3 py-2.5 text-sm text-foreground focus:border-brand focus:outline-none"
            >
              <option value="">Select a design…</option>
              {designs.map((d) => (
                <option key={d.id} value={d.id}>{d.teamName} ({d.reference})</option>
              ))}
            </select>
            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} disabled={busy} className="text-sm display text-muted border border-line px-4 py-2 hover:text-foreground disabled:opacity-50">Cancel</button>
              <button type="button" onClick={link} disabled={busy || !choice} className="text-sm display text-on-brand bg-brand hover:bg-brand-dark px-4 py-2 rounded disabled:opacity-50">{busy ? "Linking…" : "Link"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
