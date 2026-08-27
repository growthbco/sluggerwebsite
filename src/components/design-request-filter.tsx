"use client";

import { useEffect, useState } from "react";

// Search + clickable status chips for the Design Requests table. Self-contained
// (no shared cross-page store): it filters the active-design rows in place by
// text (data-search) and status (data-status). Click a status to see only
// those; click it again (or "All") to clear.
export function DesignRequestFilter({
  statuses,
  total,
}: {
  statuses: { value: string; label: string; count: number }[];
  total: number;
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    const term = q.trim().toLowerCase();
    const rows = document.querySelectorAll<HTMLElement>('[data-section="designs"]');
    let shown = 0;
    rows.forEach((row) => {
      const text = row.getAttribute("data-search") ?? "";
      const st = row.getAttribute("data-status") ?? "";
      const show = (!term || text.includes(term)) && (!status || st === status);
      row.style.display = show ? "" : "none";
      if (show) shown++;
    });
    document.querySelectorAll<HTMLElement>('[data-empty-for="designs"]').forEach((el) => {
      el.style.display = shown === 0 ? "" : "none";
    });
  }, [q, status]);

  const chip = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-xs display border transition-colors whitespace-nowrap ${
      active ? "bg-brand text-on-brand border-brand" : "border-line text-muted hover:text-foreground hover:border-brand/50"
    }`;

  return (
    <div className="mt-4 space-y-3">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search team, ref, or contact…"
        className="w-full sm:max-w-sm bg-steel border border-line rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
      />
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => setStatus("")} className={chip(status === "")}>
          All <span className="opacity-60">({total})</span>
        </button>
        {statuses.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => setStatus((cur) => (cur === s.value ? "" : s.value))}
            className={chip(status === s.value)}
          >
            {s.label} <span className="opacity-60">({s.count})</span>
          </button>
        ))}
      </div>
    </div>
  );
}
