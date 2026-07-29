"use client";

import { useState } from "react";
import { PrintFileQA } from "@/components/print-file-qa";

type Group = { key: string; label: string; count: number };
type RosterEntry = { name: string; number: string; size: string };
type VerifyResult = Parameters<typeof PrintFileQA>[0]["initialResult"];

type Props = {
  token: string;
  groups: Group[];
  rosters: Record<string, RosterEntry[]>;
  qa: Record<string, (VerifyResult & { urls?: string[] }) | undefined>;
};

/** Per-design print-file QA: the store has multiple designs (gray, white,
 *  practice...), each a separate print file, so the designer picks one and
 *  verifies its file against only that design's ordered jerseys. */
export function StorePrintFileQA({ token, groups, rosters, qa }: Props) {
  const [active, setActive] = useState(groups[0]?.key ?? "");
  if (groups.length === 0) {
    return <p className="text-muted">No printed jerseys ordered yet - add-ons appear here once families pay.</p>;
  }
  const current = qa[active];
  return (
    <div>
      <p className="display text-xs text-muted tracking-wide">PICK THE DESIGN YOU&apos;RE VERIFYING</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {groups.map((g) => {
          const done = qa[g.key];
          const state = done ? (done.ok || (done.dismissed?.length ?? 0) >= done.mismatches.length ? "✅" : "⚠️") : "";
          return (
            <button
              key={g.key}
              type="button"
              onClick={() => setActive(g.key)}
              className={`display text-sm px-4 py-2 border transition-colors ${active === g.key ? "border-brand bg-brand/10 text-foreground" : "border-line text-muted hover:border-brand/50"}`}
            >
              {state && <span className="mr-1">{state}</span>}
              {g.label} <span className="text-xs opacity-70">({g.count})</span>
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        <p className="text-sm text-muted mb-3">
          Verifying <span className="text-foreground display">{groups.find((g) => g.key === active)?.label}</span> -
          upload the print file for <strong className="text-foreground">this design only</strong>.
        </p>
        {/* key=active resets the uploader/result when switching designs */}
        <PrintFileQA
          key={active}
          token={token}
          basePath={`/api/store/${token}`}
          group={active}
          rosterCount={rosters[active]?.length ?? 0}
          roster={rosters[active] ?? []}
          initialPrintFileUrls={current?.urls ?? null}
          initialResult={current ?? null}
        />
      </div>
    </div>
  );
}
