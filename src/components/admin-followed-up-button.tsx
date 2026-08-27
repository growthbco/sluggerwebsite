"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** One-tap "I followed up" for a design that's waiting on us. Records the
 *  follow-up so the "waiting on us" flag clears until the customer replies
 *  again. Tap again to undo. */
export function FollowedUpButton({ id, followedUp }: { id: string; followedUp: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [on, setOn] = useState(followedUp);

  async function toggle() {
    const next = !on;
    setOn(next); // optimistic
    setBusy(true);
    try {
      const res = await fetch("/api/admin/design-request/followed-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, followedUp: next }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setOn(!next); // revert
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      title={on ? "Marked followed up - tap to undo" : "Mark that you followed up (clears it from 'waiting on us')"}
      className={`display text-xs px-2.5 py-1 border transition-colors disabled:opacity-50 whitespace-nowrap ${
        on ? "border-green-500/40 text-green-400/90 bg-green-500/10" : "border-line text-muted hover:text-foreground hover:border-brand/50"
      }`}
    >
      {on ? "✓ Followed up" : "Followed up"}
    </button>
  );
}
