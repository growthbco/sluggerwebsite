"use client";

import { STAGE_CHIPS, useStatusFilter } from "@/components/admin-filter-store";

/** Status filter chips for the Team Orders section header. Drives the same
 *  shared filter as the top search bar, so either place works and they stay in
 *  sync. */
export function AdminStatusChips() {
  const [status, setStatus] = useStatusFilter();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={() => setStatus("")}
        className={`text-xs display px-2.5 py-1 border whitespace-nowrap ${
          status === "" ? "bg-brand text-on-brand border-brand" : "border-line text-muted hover:border-brand/50 hover:text-foreground"
        }`}
      >
        All
      </button>
      {STAGE_CHIPS.map((c) => {
        const on = status === c.value;
        return (
          <button
            key={c.value}
            type="button"
            onClick={() => setStatus(on ? "" : c.value)}
            className={`text-xs display px-2.5 py-1 border whitespace-nowrap ${
              on ? "bg-brand text-on-brand border-brand" : "border-line text-muted hover:border-brand/50 hover:text-foreground"
            }`}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
