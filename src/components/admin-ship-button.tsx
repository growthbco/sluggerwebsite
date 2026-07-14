"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Admin action: paste the Pirate Ship tracking number; the customer gets the
 *  "on the way" email with a tracking link and the order flips to shipped. */
export function AdminShipButton({
  kind,
  id,
  who,
}: {
  kind: "team_order" | "order";
  id: string;
  who: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function ship() {
    const trackingNumber = window.prompt(`Tracking number for ${who} (from Pirate Ship):`);
    if (!trackingNumber?.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/ship", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, id, trackingNumber: trackingNumber.trim() }),
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
      onClick={ship}
      disabled={busy}
      className="text-xs display text-foreground border border-brand/50 px-2.5 py-1 hover:bg-brand/10 disabled:opacity-50"
    >
      {busy ? "..." : "🚚 Mark shipped"}
    </button>
  );
}
