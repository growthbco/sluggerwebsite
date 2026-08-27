"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Per-row kebab menu for a Design Lab lead, so Delete lives in a menu instead
 *  of a loud red button competing with the row's real actions. */
export function LabRowMenu({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function del() {
    setOpen(false);
    if (!confirm(`Delete the lead "${name}" and its saved concepts? This can't be undone.`)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/design-lab", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not delete");
      router.refresh();
    } catch (e) {
      alert((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="relative flex justify-end">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        aria-label="Row actions"
        className="text-muted hover:text-foreground px-2 py-0.5 leading-none disabled:opacity-50"
      >
        {busy ? "…" : "⋯"}
      </button>
      {open && (
        <>
          {/* click-away layer */}
          <button type="button" aria-hidden className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} tabIndex={-1} />
          <div className="absolute right-0 top-full z-20 mt-1 min-w-32 bg-steel border border-line shadow-xl">
            <button
              type="button"
              onClick={del}
              className="block w-full text-left text-xs display text-red-400/80 px-3 py-2 hover:bg-red-500/10"
            >
              Delete lead
            </button>
          </div>
        </>
      )}
    </div>
  );
}
