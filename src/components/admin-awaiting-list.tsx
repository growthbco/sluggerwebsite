"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type Unpaid = {
  key: string;
  kind: "Deposit" | "Final balance" | "Add-on" | "Custom invoice";
  customer: string;
  email: string | null;
  ref: string;
  amountCents: number;
  sinceISO: string;
  detail?: string;
  payUrl: string | null;
  href: string | null; // where the row opens (order page, or pay page for custom)
  invoiceId?: string; // custom invoices only - enables Void
};

const money = (c: number) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

const KIND_TONE: Record<Unpaid["kind"], string> = {
  Deposit: "border-sky-500/50 text-sky-400 bg-sky-500/10",
  "Final balance": "border-amber-500/50 text-amber-300 bg-amber-500/10",
  "Add-on": "border-brand/50 text-brand bg-brand/10",
  "Custom invoice": "border-violet-500/50 text-violet-400 bg-violet-500/10",
};

export function AdminAwaitingList({ items }: { items: Unpaid[] }) {
  const router = useRouter();
  const now = Date.now();
  const [voiding, setVoiding] = useState<string | null>(null);

  const daysAgo = (iso: string) => Math.max(0, Math.floor((now - new Date(iso).getTime()) / 86400000));

  async function voidInvoice(id: string) {
    if (!confirm("Void this custom invoice? Its pay link stops working and it drops off this list. (Use this after combining it into another invoice.)")) return;
    setVoiding(id);
    try {
      const res = await fetch("/api/admin/custom-invoice", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to void");
      router.refresh();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setVoiding(null);
    }
  }

  if (items.length === 0) {
    return (
      <div className="border border-line p-6">
        <p className="text-sm text-muted">Nothing outstanding - everyone&apos;s paid up. 🎉</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {items.map((it) => {
        const RowInner = (
          <div className="grid grid-cols-[1fr_auto] gap-3 p-4">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-block border px-2 py-0.5 text-[11px] display uppercase tracking-wide ${KIND_TONE[it.kind]}`}>{it.kind}</span>
                <span className="font-mono text-xs text-muted">{it.ref}</span>
                {it.href && <span className="text-[11px] text-muted/70 group-hover/row:text-brand">open ↗</span>}
              </div>
              <p className="text-foreground display leading-tight">{it.customer}</p>
              {it.email && <p className="text-xs text-muted break-all">{it.email}</p>}
              {it.detail && <p className="text-xs text-muted/90 leading-snug">{it.detail}</p>}
              <p className="text-[11px] text-muted/70">sent {daysAgo(it.sinceISO)}d ago</p>
            </div>
            <div className="flex flex-col items-end justify-between gap-2 shrink-0">
              <span className="display text-lg text-foreground tabular-nums whitespace-nowrap">{money(it.amountCents)}</span>
              <div className="flex items-center gap-2">
                {it.invoiceId && (
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); voidInvoice(it.invoiceId!); }}
                    disabled={voiding === it.invoiceId}
                    className="text-[11px] display text-red-400/80 border border-red-500/40 px-2 py-1 hover:bg-red-500/10 disabled:opacity-50"
                  >
                    {voiding === it.invoiceId ? "…" : "Void"}
                  </button>
                )}
                {it.payUrl && (
                  <a
                    href={it.payUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-[11px] display text-brand border border-brand/50 px-2 py-1 hover:bg-brand/10 whitespace-nowrap"
                  >
                    Pay link ↗
                  </a>
                )}
              </div>
            </div>
          </div>
        );

        const cls = "group/row block border border-line bg-steel/40 hover:border-brand/40 hover:bg-steel/70 transition-colors";
        // Custom-invoice pay pages are external; order pages are internal.
        if (it.href && it.href.startsWith("/")) {
          return <Link key={it.key} href={it.href} className={cls}>{RowInner}</Link>;
        }
        if (it.href) {
          return <a key={it.key} href={it.href} target="_blank" rel="noopener noreferrer" className={cls}>{RowInner}</a>;
        }
        return <div key={it.key} className={cls.replace("hover:border-brand/40 hover:bg-steel/70", "")}>{RowInner}</div>;
      })}
    </div>
  );
}
