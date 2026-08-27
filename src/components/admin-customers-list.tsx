"use client";

import { useState } from "react";
import Link from "next/link";

export type CustomerRow = {
  email: string;
  name: string;
  phone: string | null;
  orders: number;
  designs: number;
  spendCents: number;
  lastActivity: string;
  latestOrderId: string | null;
};

const money = (c: number) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" });
const prettyPhone = (p: string) => {
  const d = p.replace(/\D/g, "").slice(-10);
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p;
};

/** Searchable customer directory table with per-row jump-offs (text them,
 *  open their latest order). */
export function AdminCustomersList({ rows }: { rows: CustomerRow[] }) {
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const visible = q
    ? rows.filter((r) => `${r.name} ${r.email} ${r.phone ?? ""}`.toLowerCase().includes(q))
    : rows;

  return (
    <div>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={`Search ${rows.length} customers by name, email, or phone…`}
        className="w-full sm:w-96 bg-steel border border-line px-3 py-2.5 text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
      />
      <div className="mt-4 overflow-x-auto border border-line">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-steel text-left">
              <th className="px-3 py-2.5 text-xs display uppercase tracking-wide text-muted">Customer</th>
              <th className="px-3 py-2.5 text-xs display uppercase tracking-wide text-muted">Contact</th>
              <th className="px-3 py-2.5 text-xs display uppercase tracking-wide text-muted text-right">Orders</th>
              <th className="px-3 py-2.5 text-xs display uppercase tracking-wide text-muted text-right">Designs</th>
              <th className="px-3 py-2.5 text-xs display uppercase tracking-wide text-muted text-right">Spend (approx)</th>
              <th className="px-3 py-2.5 text-xs display uppercase tracking-wide text-muted">Last activity</th>
              <th className="px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.email} className="border-t border-line hover:bg-steel/60">
                <td className="px-3 py-2.5 text-foreground">{r.name || "-"}</td>
                <td className="px-3 py-2.5 text-muted">
                  <a href={`mailto:${r.email}`} className="hover:text-foreground">{r.email}</a>
                  {r.phone && <div className="text-xs">{prettyPhone(r.phone)}</div>}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-foreground">{r.orders || "-"}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-foreground">{r.designs || "-"}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-brand">{r.spendCents > 0 ? money(r.spendCents) : "-"}</td>
                <td className="px-3 py-2.5 text-muted whitespace-nowrap">{fmtDate(r.lastActivity)}</td>
                <td className="px-3 py-2.5 whitespace-nowrap text-right">
                  {r.phone && (
                    <Link
                      href={`/admin/texts?to=${encodeURIComponent(r.phone)}&name=${encodeURIComponent(r.name)}`}
                      className="text-xs display border border-brand/50 text-brand px-2 py-1 hover:bg-brand/10"
                    >
                      Text
                    </Link>
                  )}
                  {r.latestOrderId && (
                    <Link
                      href={`/admin/team-order/${r.latestOrderId}`}
                      className="ml-1.5 text-xs display border border-line text-muted px-2 py-1 hover:border-brand/40 hover:text-foreground"
                    >
                      Order →
                    </Link>
                  )}
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-muted">No customers match that search.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
