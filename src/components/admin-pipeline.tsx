"use client";

import { useStatusFilter } from "@/components/admin-filter-store";

/** The order pipeline as big clickable cards: how many orders sit at each
 *  stage and what that stage needs from you. Clicking a card filters the
 *  Team Orders table (same shared filter as the chips/search). */
export function AdminPipeline({ counts }: { counts: Record<string, number> }) {
  const [status, setStatus] = useStatusFilter();

  const STAGES: { value: string; title: string; action: string; emoji: string; tone: string }[] = [
    { value: "collecting", title: "Collecting roster", action: "Join link open - players adding themselves", emoji: "📝", tone: "border-line" },
    { value: "submitted", title: "Needs invoice", action: "Roster in - send the 50% deposit", emoji: "📋", tone: "border-amber-300/50" },
    { value: "quoted", title: "Awaiting payment", action: "Invoice sent - waiting on deposit", emoji: "🧾", tone: "border-amber-300/50" },
    { value: "in_production", title: "In production", action: "Deposit paid - send final invoice when ready", emoji: "🏭", tone: "border-sky-400/50" },
    { value: "paid", title: "Ready to ship", action: "Paid in full - buy label + ship", emoji: "📦", tone: "border-green-400/50" },
    { value: "shipped", title: "Shipped", action: "Done - tracking sent", emoji: "🚚", tone: "border-line" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
      {STAGES.map((s) => {
        const n = counts[s.value] ?? 0;
        const on = status === s.value;
        return (
          <button
            key={s.value}
            type="button"
            onClick={() => {
              setStatus(on ? "" : s.value);
              // Team orders now sit below Design requests - jump to the table
              // so the filter's effect is visible.
              if (!on) document.getElementById("team-orders")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            title={on ? "Click to clear the filter" : `Show only ${s.title.toLowerCase()} orders`}
            className={`text-left border bg-steel px-3 py-2.5 transition-colors ${on ? "border-brand ring-1 ring-brand" : `${s.tone} hover:border-brand/60`} ${n === 0 && !on ? "opacity-50" : ""}`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="display text-sm text-foreground whitespace-nowrap">{s.emoji} {s.title}</span>
              <span className={`display text-xl ${n > 0 ? "text-brand" : "text-muted"}`}>{n}</span>
            </div>
            <p className="mt-0.5 text-[11px] text-muted leading-tight">{s.action}</p>
          </button>
        );
      })}
    </div>
  );
}
