"use client";

import { useMemo, useState } from "react";

export type UnbilledJob = {
  teamOrderId: string;
  teamName: string;
  reference: string;
  kind: "team_order" | "order";
  group: string;
  qty: number; // unbilled pieces (delta)
  unitCostCents?: number;
  since?: string | null;
};

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

function ageLabel(iso?: string | null): string {
  if (!iso) return "—";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "1d";
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

/** The produced-but-not-billed list, as a searchable table - the "nudge them"
 *  list, the SAME unbilled set the vendor sees on their own link. */
export function AdminUnbilledTable({ jobs }: { jobs: UnbilledJob[] }) {
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return jobs;
    return jobs.filter((j) => [j.teamName, j.reference, j.group].some((x) => (x ?? "").toLowerCase().includes(s)));
  }, [jobs, q]);

  if (!jobs.length) {
    return <p className="text-sm text-muted">Nothing outstanding — every produced job has been billed or settled.</p>;
  }

  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search team or order number…"
        className="w-full sm:max-w-xs mb-3 rounded-lg bg-ink border border-line px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:border-brand focus:outline-none"
      />
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="bg-steel text-left text-[11px] uppercase tracking-wide text-muted">
              <th className="py-2 px-3 font-medium">Team / order</th>
              <th className="py-2 px-3 font-medium text-right">Qty</th>
              <th className="py-2 px-3 font-medium text-right">Exp. cost/pc</th>
              <th className="py-2 px-3 font-medium text-right">Exp. total</th>
              <th className="py-2 px-3 font-medium text-right">Age</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="py-6 text-center text-muted">No jobs match that search.</td></tr>
            ) : (
              rows.map((j) => (
                <tr key={j.teamOrderId} className="border-t border-line">
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <span className="text-foreground">{j.teamName}</span>
                      <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${j.kind === "order" ? "bg-brand/15 text-brand" : "bg-steel text-muted"}`}>
                        {j.kind === "order" ? "Shop" : "Team"}
                      </span>
                    </div>
                    <span className="block font-mono text-[11px] text-muted">
                      {j.reference}{j.kind === "order" && j.group ? ` · ${j.group}` : ""}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-foreground">{j.qty}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-muted">{j.unitCostCents ? money(j.unitCostCents) : "—"}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-foreground">{j.unitCostCents ? money(j.unitCostCents * j.qty) : "—"}</td>
                  <td className="py-2.5 px-3 text-right text-muted whitespace-nowrap">{ageLabel(j.since)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
