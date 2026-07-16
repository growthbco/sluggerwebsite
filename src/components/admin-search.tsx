"use client";

import { useEffect, useRef, useState } from "react";

// Filters the dashboard's project rows in place. Rows opt in with a
// data-search attribute (searchable text) and data-status attribute.
export function AdminSearch({ statuses }: { statuses: string[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = q.trim().toLowerCase();
    const rows = document.querySelectorAll<HTMLElement>("[data-search]");
    let anyShown = 0;
    const sectionCounts = new Map<string, number>();
    rows.forEach((row) => {
      const text = row.getAttribute("data-search") ?? "";
      const st = row.getAttribute("data-status") ?? "";
      const matchText = !term || text.includes(term);
      const matchStatus = !status || st === status;
      const show = matchText && matchStatus;
      row.style.display = show ? "" : "none";
      if (show) {
        anyShown++;
        const sec = row.getAttribute("data-section") ?? "";
        sectionCounts.set(sec, (sectionCounts.get(sec) ?? 0) + 1);
      }
    });
    // Toggle a "no matches" note per section.
    document.querySelectorAll<HTMLElement>("[data-empty-for]").forEach((el) => {
      const sec = el.getAttribute("data-empty-for") ?? "";
      el.style.display = (sectionCounts.get(sec) ?? 0) === 0 ? "" : "none";
    });
    void anyShown;
  }, [q, status]);

  return (
    <div ref={ref} className="mt-6 flex flex-wrap items-center gap-2">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="🔍 Search team, ref, or contact…"
        className="flex-1 min-w-52 bg-steel border border-line px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
      />
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="bg-steel border border-line px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none"
      >
        <option value="">All statuses</option>
        {statuses.map((s) => (
          <option key={s} value={s}>
            {s.replace(/_/g, " ")}
          </option>
        ))}
      </select>
      {(q || status) && (
        <button
          type="button"
          onClick={() => {
            setQ("");
            setStatus("");
          }}
          className="text-xs display text-muted border border-line px-3 py-2 hover:border-brand/50"
        >
          Clear
        </button>
      )}
    </div>
  );
}
