"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Wipe all no-name, unpaid Design Lab leads (test runs / abandoned sessions).
 *  Named or paid leads are always kept. */
export function AdminBulkLeadDelete({ count }: { count: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (count <= 0) return null;

  async function del() {
    if (!confirm(`Delete ${count} no-name test lead${count === 1 ? "" : "s"}? Named and paid leads are kept. This can't be undone.`)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/design-lab", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bulk: "unnamed" }),
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
      className="text-xs display text-red-400/80 border border-red-500/40 px-3 py-1.5 hover:bg-red-500/10 disabled:opacity-50"
    >
      {busy ? "Deleting…" : `🗑 Clear ${count} test lead${count === 1 ? "" : "s"}`}
    </button>
  );
}
