"use client";

import { useState } from "react";

export type HatRun = {
  runKey: string;
  size: string;
  label: string;
  rows: { unitKey: string; number: string; name: string; note: string }[];
};
type Stage = "s" | "c" | "b";
type Checklist = Record<string, { s?: boolean; c?: boolean; b?: boolean }>;

const STAGES: { stage: Stage; label: string }[] = [
  { stage: "s", label: "Stitched" },
  { stage: "c", label: "Cleaned" },
  { stage: "b", label: "Bagged" },
];

/** The interactive body of the hat production sheet: tap any box to check a
 *  hat through Stitched -> Cleaned -> Bagged. Saves per click (shared across
 *  staff, survives reloads) and prints exactly as checked. */
export function HatSheetTables({
  teamOrderId,
  runs,
  initialChecklist,
  hasNames,
  hasNotes,
}: {
  teamOrderId: string;
  runs: HatRun[];
  initialChecklist: Checklist;
  hasNames: boolean;
  hasNotes: boolean;
}) {
  const [checks, setChecks] = useState<Checklist>(initialChecklist);
  const [failed, setFailed] = useState(false);

  async function toggle(unitKey: string, stage: Stage) {
    const on = !checks[unitKey]?.[stage];
    // Optimistic: flip immediately, revert if the save fails.
    setChecks((c) => ({ ...c, [unitKey]: { ...c[unitKey], [stage]: on } }));
    setFailed(false);
    try {
      const res = await fetch("/api/admin/team-order/hat-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamOrderId, key: unitKey, stage, on }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setChecks((c) => ({ ...c, [unitKey]: { ...c[unitKey], [stage]: !on } }));
      setFailed(true);
    }
  }

  const doneCount = (rows: HatRun["rows"], stage: Stage) => rows.filter((r) => checks[r.unitKey]?.[stage]).length;

  return (
    <>
      {failed && (
        <p className="no-print mt-3 text-sm font-semibold text-[#a3271f]">Couldn&apos;t save that last check - it was undone. Check your connection and tap it again.</p>
      )}
      {runs.map((run, runIdx) => (
        <section key={run.runKey} className="mt-6 break-inside-avoid">
          <h2 className="text-base font-bold uppercase tracking-[0.08em]">
            Run {runIdx + 1} - {run.size}{" "}
            <span className="normal-case tracking-normal font-semibold text-neutral-500 text-sm">
              {run.rows.length} × {run.label}
            </span>
            <span className="no-print normal-case tracking-normal font-semibold text-neutral-500 text-sm">
              {" "}· {STAGES.map(({ stage, label }) => `${label} ${doneCount(run.rows, stage)}/${run.rows.length}`).join(" · ")}
            </span>
          </h2>
          <table className="w-full border-collapse mt-2">
            <thead>
              <tr className="border-b-2 border-black">
                <th className="text-left text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500 px-2 py-1">Player</th>
                {hasNotes && <th className="text-left text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500 px-2 py-1">Note</th>}
                {STAGES.map(({ stage, label }) => (
                  <th key={stage} className="text-center text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500 px-2 py-1 w-20">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {run.rows.map((h, i) => (
                <tr key={h.unitKey} className="border-b border-neutral-300 even:bg-neutral-100">
                  <td className="px-2 py-1.5 font-extrabold text-lg tabular-nums">
                    {h.number ? `#${h.number}` : `Hat ${i + 1}`}
                    {hasNames && h.name && <span className="font-semibold text-sm text-neutral-600"> · {h.name}</span>}
                  </td>
                  {hasNotes && <td className="px-2 py-1.5 text-sm text-neutral-600">{h.note}</td>}
                  {STAGES.map(({ stage, label }) => {
                    const on = Boolean(checks[h.unitKey]?.[stage]);
                    return (
                      <td key={stage} className="text-center px-2 py-1.5">
                        <button
                          type="button"
                          onClick={() => toggle(h.unitKey, stage)}
                          aria-label={`${label}: hat ${h.number || i + 1}`}
                          aria-pressed={on}
                          className={`inline-grid h-7 w-7 place-items-center border-2 border-black align-middle text-base font-extrabold leading-none print:h-4 print:w-4 print:text-xs ${
                            on ? "bg-black text-white print:bg-white print:text-black" : "bg-white text-white hover:bg-neutral-200"
                          }`}
                        >
                          {on ? "✓" : ""}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </>
  );
}
