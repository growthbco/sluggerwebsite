"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export type OrderRow = {
  reference: string;
  teamName: string;
  summary: string; // "12 Full Button jerseys"
  statusLabel: string;
  statusTone: "green" | "amber" | "gold";
  totalCents: number;
  dateLabel: string;
  href: string;
};

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

function Pill({ label, tone }: { label: string; tone: string }) {
  const cls =
    tone === "green" ? "border-green-500/40 bg-green-500/10 text-green-300"
    : tone === "amber" ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
    : "border-brand/40 bg-brand/10 text-brand";
  return <span className={`text-[11px] display px-2.5 py-0.5 rounded-full border whitespace-nowrap ${cls}`}>{label}</span>;
}

/** The portal HOME order index: a searchable list where the whole row is the
 *  click target into that order's workspace. No images, no per-row buttons. */
export function PortalOrderList({ orders }: { orders: OrderRow[] }) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const visible = useMemo(
    () => (query ? orders.filter((o) => `${o.reference} ${o.teamName} ${o.summary} ${o.statusLabel}`.toLowerCase().includes(query)) : orders),
    [orders, query],
  );

  return (
    <div className="space-y-4">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Find an order  ·  TO-NQ6BVA"
        className="w-full bg-ink border border-line px-3 py-2.5 text-base sm:text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
      />
      <div className="space-y-2">
        {visible.map((o) => (
          <Link
            key={o.reference}
            href={o.href}
            className="block border border-line bg-steel px-4 py-3 hover:border-brand/50 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="display text-foreground">{o.teamName || o.reference}</span>
                  <Pill label={o.statusLabel} tone={o.statusTone} />
                </div>
                <p className="text-xs text-muted mt-0.5">{o.reference}</p>
                {o.summary && <p className="text-sm text-foreground/90 mt-1">{o.summary}</p>}
              </div>
              <div className="text-right shrink-0">
                <p className="display text-foreground tabular-nums">{money(o.totalCents)}</p>
                <p className="text-xs text-muted mt-0.5">{o.dateLabel}</p>
              </div>
            </div>
          </Link>
        ))}
        {visible.length === 0 && (
          <p className="text-sm text-muted px-1 py-4">{orders.length === 0 ? "No orders on this account yet." : "No orders match that search."}</p>
        )}
      </div>
    </div>
  );
}
