"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type CustomerRow = {
  email: string;
  name: string;
  phone: string | null;
  orders: number;
  designs: number;
  spendCents: number;
  lastActivity: string;
  latestOrderId: string | null;
  latestDesignId: string | null;
};

type Segment = "all" | "buyers" | "repeat" | "leads";
type Sort = "recent" | "value" | "orders" | "name";

const PAGE_SIZE = 50;
const money = (c: number) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" });
const prettyPhone = (p: string) => {
  const d = p.replace(/\D/g, "").slice(-10);
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p;
};

export function AdminCustomersList({ rows }: { rows: CustomerRow[] }) {
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState<Segment>("all");
  const [sort, setSort] = useState<Sort>("recent");
  const [limit, setLimit] = useState(PAGE_SIZE);

  const counts = useMemo(() => ({
    all: rows.length,
    buyers: rows.filter((row) => row.orders > 0).length,
    repeat: rows.filter((row) => row.orders > 1).length,
    leads: rows.filter((row) => row.orders === 0 && row.designs > 0).length,
  }), [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const next = rows.filter((row) => {
      if (segment === "buyers" && row.orders === 0) return false;
      if (segment === "repeat" && row.orders < 2) return false;
      if (segment === "leads" && (row.orders > 0 || row.designs === 0)) return false;
      return !q || `${row.name} ${row.email} ${row.phone ?? ""}`.toLowerCase().includes(q);
    });
    next.sort((a, b) => {
      if (sort === "value") return b.spendCents - a.spendCents;
      if (sort === "orders") return b.orders - a.orders || b.designs - a.designs;
      if (sort === "name") return (a.name || a.email).localeCompare(b.name || b.email);
      return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
    });
    return next;
  }, [rows, search, segment, sort]);

  const visible = filtered.slice(0, limit);
  const setSegmentAndReset = (value: Segment) => { setSegment(value); setLimit(PAGE_SIZE); };

  return (
    <div>
      <div className="rounded-xl border border-line bg-steel p-3 sm:p-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true">⌕</span>
            <input
              value={search}
              onChange={(event) => { setSearch(event.target.value); setLimit(PAGE_SIZE); }}
              placeholder="Search by name, email, or phone…"
              aria-label="Search customers"
              className="w-full rounded-lg bg-background border border-line pl-9 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
            />
          </div>
          <select
            value={sort}
            onChange={(event) => { setSort(event.target.value as Sort); setLimit(PAGE_SIZE); }}
            aria-label="Sort customers"
            className="rounded-lg bg-background border border-line px-3 py-2.5 text-sm text-foreground focus:border-brand focus:outline-none"
          >
            <option value="recent">Most recent</option>
            <option value="value">Highest value</option>
            <option value="orders">Most orders</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>

        <div className="mt-3 flex flex-wrap gap-2" aria-label="Customer segments">
          {([
            ["all", "All", counts.all],
            ["buyers", "Ordered", counts.buyers],
            ["repeat", "Repeat", counts.repeat],
            ["leads", "Design leads", counts.leads],
          ] as const).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSegmentAndReset(key)}
              className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${segment === key ? "border-brand bg-brand/10 text-brand" : "border-line text-muted hover:border-brand/40 hover:text-foreground"}`}
            >
              {label} <span className="ml-1 tabular-nums opacity-80">{count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted">
        <span>{filtered.length.toLocaleString()} customer{filtered.length === 1 ? "" : "s"}</span>
        {(search || segment !== "all") && (
          <button type="button" onClick={() => { setSearch(""); setSegment("all"); setLimit(PAGE_SIZE); }} className="text-brand hover:text-foreground">Clear filters</button>
        )}
      </div>

      <section className="mt-3 overflow-hidden rounded-xl border border-line bg-steel/30">
        <div className="hidden lg:grid grid-cols-[minmax(0,1.45fr)_10rem_9rem_13rem] gap-4 bg-steel px-4 py-3 text-[10px] display uppercase tracking-wider text-muted">
          <span>Customer / contact</span><span>Relationship</span><span>Recorded value</span><span>Activity / actions</span>
        </div>
        {visible.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-foreground">No customers match those filters.</p>
            <button type="button" onClick={() => { setSearch(""); setSegment("all"); setLimit(PAGE_SIZE); }} className="mt-2 text-xs text-brand hover:text-foreground">Show everyone</button>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {visible.map((row) => (
              <article key={row.email} className="grid gap-3 px-4 py-4 lg:grid-cols-[minmax(0,1.45fr)_10rem_9rem_13rem] lg:gap-4 lg:items-center hover:bg-steel/60">
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">{row.name || row.email}</p>
                  <a href={`mailto:${row.email}`} className="mt-0.5 block truncate text-xs text-muted hover:text-brand">{row.email}</a>
                  {row.phone && <a href={`tel:${row.phone.replace(/\D/g, "")}`} className="mt-0.5 block text-xs text-muted hover:text-brand">{prettyPhone(row.phone)}</a>}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  {row.orders > 0 && <span className="rounded-full border border-green-400/30 bg-green-500/[0.06] px-2 py-1 text-green-300">{row.orders} order{row.orders === 1 ? "" : "s"}</span>}
                  {row.designs > 0 && <span className="rounded-full border border-sky-400/30 bg-sky-500/[0.06] px-2 py-1 text-sky-300">{row.designs} design{row.designs === 1 ? "" : "s"}</span>}
                  {row.orders === 0 && row.designs === 0 && <span className="rounded-full border border-line px-2 py-1 text-muted">Portal only</span>}
                </div>

                <div>
                  <p className={`display text-base tabular-nums ${row.spendCents > 0 ? "text-brand" : "text-muted"}`}>{row.spendCents > 0 ? money(row.spendCents) : "—"}</p>
                  <p className="text-[10px] text-muted">payments recorded</p>
                </div>

                <div className="min-w-0">
                  <p className="text-xs text-muted">Active {fmtDate(row.lastActivity)}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {row.phone && (
                      <Link href={`/admin/texts?to=${encodeURIComponent(row.phone)}&name=${encodeURIComponent(row.name)}`} className="rounded-md border border-brand/50 px-2.5 py-1.5 text-xs display text-brand hover:bg-brand/10">Text</Link>
                    )}
                    <a href={`mailto:${row.email}`} className="rounded-md border border-line px-2.5 py-1.5 text-xs display text-muted hover:border-brand/40 hover:text-foreground">Email</a>
                    {row.latestOrderId && <Link href={`/admin/team-order/${row.latestOrderId}`} className="rounded-md border border-line px-2.5 py-1.5 text-xs display text-muted hover:border-brand/40 hover:text-foreground">Order</Link>}
                    {row.latestDesignId && <Link href={`/admin/design-requests/${row.latestDesignId}`} className="rounded-md border border-line px-2.5 py-1.5 text-xs display text-muted hover:border-brand/40 hover:text-foreground">Design</Link>}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {visible.length < filtered.length && (
        <div className="mt-4 text-center">
          <button type="button" onClick={() => setLimit((current) => current + PAGE_SIZE)} className="rounded-lg border border-line px-5 py-2.5 text-sm display text-foreground hover:border-brand/50">
            Show {Math.min(PAGE_SIZE, filtered.length - visible.length)} more
          </button>
          <p className="mt-2 text-xs text-muted">Showing {visible.length} of {filtered.length}</p>
        </div>
      )}
    </div>
  );
}
