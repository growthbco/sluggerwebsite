"use client";

import { useState } from "react";

// "Open in design studio": converts an AI Jersey Maker lead into a design
// request seeded with their saved designs, then jumps into the editable studio.
export function LabLeadConvertButton({ visitorId }: { visitorId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/design-lab/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId }),
      });
      const data = await res.json();
      if (!res.ok || !data.manageUrl) throw new Error(data?.error || "Could not open the studio");
      window.location.href = data.manageUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        onClick={go}
        disabled={busy}
        className="text-xs display border border-brand/60 text-brand px-2 py-0.5 hover:bg-brand/10 disabled:opacity-50"
        title="Create a design request from this lead's designs and open the AI studio"
      >
        {busy ? "Opening…" : "Open in design studio"}
      </button>
      {error && <span className="text-[11px] text-[#e5533c]">{error}</span>}
    </span>
  );
}
