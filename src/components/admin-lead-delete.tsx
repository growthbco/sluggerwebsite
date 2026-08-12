"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Delete a Design Lab lead (test runs / junk). Confirms first. */
export function AdminLeadDelete({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function del() {
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
    <button
      type="button"
      onClick={del}
      disabled={busy}
      className="ml-auto text-[11px] display text-red-400/80 border border-red-500/40 px-2 py-0.5 hover:bg-red-500/10 disabled:opacity-50"
    >
      {busy ? "…" : "Delete"}
    </button>
  );
}
