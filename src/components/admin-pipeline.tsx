"use client";

import { useRouter } from "next/navigation";
import { useStatusFilter } from "@/components/admin-filter-store";
import { AdminIcon } from "@/components/admin-icons";

/** The order pipeline as big clickable cards: how many orders sit at each
 *  stage and what that stage needs from you. On the Team Orders page a card
 *  filters the table in place; with linkTo set (the dashboard), a card
 *  navigates to that page pre-filtered. */
export function AdminPipeline({ counts, linkTo }: { counts: Record<string, number>; linkTo?: string }) {
  const router = useRouter();
  const [status, setStatus] = useStatusFilter();

  const STAGES: { value: string; title: string; action: string; icon: string; tone: string }[] = [
    { value: "collecting", title: "Collecting roster", action: "Join link open - players adding themselves", icon: "users", tone: "border-line" },
    { value: "submitted", title: "Needs invoice", action: "Roster in - send the 50% deposit", icon: "invoice", tone: "border-amber-300/50" },
    { value: "quoted", title: "Awaiting payment", action: "Invoice sent - waiting on deposit", icon: "clock", tone: "border-amber-300/50" },
    { value: "in_production", title: "In production", action: "Deposit paid - send final invoice when ready", icon: "box", tone: "border-sky-400/50" },
    { value: "paid", title: "Ready to ship", action: "Paid in full - buy label + ship", icon: "truck", tone: "border-green-400/50" },
    { value: "shipped", title: "Shipped", action: "Done - tracking sent", icon: "check", tone: "border-line" },
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
              if (linkTo) {
                router.push(`${linkTo}?status=${encodeURIComponent(s.value)}`);
                return;
              }
              setStatus(on ? "" : s.value);
              if (!on) document.getElementById("team-orders")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            title={on ? "Click to clear the filter" : `Show only ${s.title.toLowerCase()} orders`}
            className={`text-left border rounded-lg bg-steel px-3 py-2.5 transition-colors ${on ? "border-brand ring-1 ring-brand" : `${s.tone} hover:border-brand/60`} ${n === 0 && !on ? "opacity-50" : ""}`}
          >
            <div className="flex items-start justify-between gap-2">
              {/* Title wraps to full words (never clipped mid-word); the count
                  is its own numeral, pinned top-right. */}
              <span className="flex items-start gap-1.5 min-w-0 display text-sm text-foreground leading-tight">
                <AdminIcon name={s.icon} className="w-4 h-4 text-muted shrink-0 mt-0.5" />
                <span className="min-w-0">{s.title}</span>
              </span>
              <span className={`display text-xl shrink-0 ${n > 0 ? "text-brand" : "text-muted"}`}>{n}</span>
            </div>
            <p className="mt-1 text-[11px] text-muted leading-tight">{s.action}</p>
          </button>
        );
      })}
    </div>
  );
}
