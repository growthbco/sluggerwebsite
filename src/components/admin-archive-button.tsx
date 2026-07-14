"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Admin action: archive a team order with a note ("lost", "on hold") or
 *  bring it back. Archiving never deletes anything. */
export function AdminArchiveButton({ teamOrderId, archived }: { teamOrderId: string; archived: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    let note = "";
    if (!archived) {
      const answer = window.prompt('Archive this order? Add a note for follow-up (e.g. "lost - budget", "on hold until fall"):');
      if (answer === null) return; // cancelled
      note = answer;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/team-order/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamOrderId, archive: !archived, note }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      router.refresh();
    } catch (e) {
      window.alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className="text-xs display text-muted border border-line px-2.5 py-1 hover:border-brand/50 hover:text-foreground disabled:opacity-50"
    >
      {busy ? "..." : archived ? "Restore" : "Archive"}
    </button>
  );
}
