"use client";

import { useEffect, useRef, useState } from "react";
import { useStatusFilter, ORDER_STAGES, stageTitle } from "@/components/admin-filter-store";

// Filters the dashboard's project rows in place. Rows opt in with a
// data-search attribute (searchable text) and data-status attribute.
export function AdminSearch({ statuses, initialStatus }: { statuses: string[]; initialStatus?: string }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useStatusFilter();
  const ref = useRef<HTMLDivElement>(null);

  // Pre-filter from a ?status= deep link (dashboard pipeline cards).
  useEffect(() => {
    if (initialStatus) setStatus(initialStatus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialStatus]);

  useEffect(() => {
    const term = q.trim().toLowerCase();
    const rows = document.querySelectorAll<HTMLElement>("[data-search]");
    let anyShown = 0;
    const sectionCounts = new Map<string, number>();
    rows.forEach((row) => {
      const text = row.getAttribute("data-search") ?? "";
      const st = row.getAttribute("data-status") ?? "";
      const matchText = !term || text.includes(term);
      // The pipeline/status filter is about ORDER stages - design-request rows
      // have their own statuses and are only narrowed by the text search.
      const matchStatus = !status || row.getAttribute("data-section") !== "orders" || st === status;
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
    <div ref={ref} className="mt-4 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search team, ref, or contact…"
        className="w-full sm:w-72 bg-steel border border-line px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
      />
      {statuses.length > 0 && (() => {
        // Show the six pipeline stages (present ones) in funnel order using the
        // SAME names as the stage cards, then any leftover statuses (draft /
        // cancelled). Full names, min-width so nothing clips.
        const present = new Set(statuses);
        const staged = ORDER_STAGES.filter((s) => present.has(s.value));
        const others = statuses.filter((s) => !ORDER_STAGES.some((x) => x.value === s));
        return (
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="min-w-44 bg-steel border border-line px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none"
          >
            <option value="">All stages</option>
            {staged.map((s) => (
              <option key={s.value} value={s.value}>{s.title}</option>
            ))}
            {others.map((s) => (
              <option key={s} value={s}>{stageTitle(s)}</option>
            ))}
          </select>
        );
      })()}
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
    </div>
  );
}
