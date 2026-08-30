"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProofFollowUpState } from "@/lib/proof-follow-up-policy";

type Action = "send_next" | "send_final" | "snooze" | "mark_unresponsive";

export function AdminProofFollowUpActions({
  id,
  teamName,
  state,
  primaryOnly = false,
}: {
  id: string;
  teamName: string;
  state: ProofFollowUpState;
  primaryOnly?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function run(action: Action, days?: 7 | 30) {
    if (action === "mark_unresponsive" && !window.confirm(`Move ${teamName} to Unresponsive? Their history stays saved and the Discord thread will be archived.`)) return;
    setBusy(days ? `${action}-${days}` : action);
    setError("");
    try {
      const res = await fetch("/api/admin/design-request/follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, days }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update follow-up.");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const sendButton = (state === "due" || state === "final_due") ? (
    <button
      type="button"
      onClick={() => run(state === "final_due" ? "send_final" : "send_next")}
      disabled={Boolean(busy)}
      className="border border-brand/50 bg-brand/10 px-2.5 py-1 text-xs text-brand hover:bg-brand/20 disabled:opacity-50"
    >
      {busy?.startsWith("send_") ? "Sending…" : state === "final_due" ? "Send final reminder" : "Send reminder"}
    </button>
  ) : null;

  if (primaryOnly) {
    if (!sendButton) return null;
    return <div className="space-y-1">{sendButton}{error && <p className="text-xs text-red-300">{error}</p>}</div>;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {sendButton}
        <button
          type="button"
          onClick={() => run("snooze", 7)}
          disabled={Boolean(busy)}
          className="border border-line px-2.5 py-1 text-xs text-muted hover:border-brand/50 hover:text-foreground disabled:opacity-50"
        >
          {busy === "snooze-7" ? "Snoozing…" : "Snooze 7 days"}
        </button>
        <button
          type="button"
          onClick={() => run("snooze", 30)}
          disabled={Boolean(busy)}
          className="border border-line px-2.5 py-1 text-xs text-muted hover:border-brand/50 hover:text-foreground disabled:opacity-50"
        >
          {busy === "snooze-30" ? "Snoozing…" : "Snooze 30 days"}
        </button>
        <button
          type="button"
          onClick={() => run("mark_unresponsive")}
          disabled={Boolean(busy)}
          className="border border-line px-2.5 py-1 text-xs text-muted hover:border-amber-400/50 hover:text-amber-300 disabled:opacity-50"
        >
          {busy === "mark_unresponsive" ? "Moving…" : "Mark unresponsive"}
        </button>
      </div>
      {error && <p className="text-xs leading-5 text-red-300">{error}</p>}
    </div>
  );
}
