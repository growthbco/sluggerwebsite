"use client";

import { useEffect, useState } from "react";

// Search + status chips for the Design Lab Leads table. Filters rows in place by
// text (data-search) and category flags (data-paid / data-converted /
// data-noname) - same interaction as the Design Requests filter.
export function AdminLabFilter({
  counts,
}: {
  counts: { all: number; paid: number; converted: number; noname: number };
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<"all" | "paid" | "converted" | "noname">("all");

  useEffect(() => {
    const term = q.trim().toLowerCase();
    const rows = document.querySelectorAll<HTMLElement>('[data-section="lab"]');
    let shown = 0;
    rows.forEach((row) => {
      const text = row.getAttribute("data-search") ?? "";
      const matchText = !term || text.includes(term);
      const matchCat =
        cat === "all" ||
        (cat === "paid" && row.getAttribute("data-paid") === "1") ||
        (cat === "converted" && row.getAttribute("data-converted") === "1") ||
        (cat === "noname" && row.getAttribute("data-noname") === "1");
      const show = matchText && matchCat;
      row.style.display = show ? "" : "none";
      if (show) shown++;
    });
    const empty = document.querySelector<HTMLElement>('[data-empty-for="lab"]');
    if (empty) empty.style.display = shown === 0 ? "" : "none";
  }, [q, cat]);

  const chip = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-xs display border transition-colors whitespace-nowrap ${
      active ? "bg-brand text-on-brand border-brand" : "border-line text-muted hover:text-foreground hover:border-brand/50"
    }`;

  const cats: { key: typeof cat; label: string; n: number }[] = [
    { key: "all", label: "All", n: counts.all },
    { key: "paid", label: "Paid", n: counts.paid },
    { key: "converted", label: "Converted", n: counts.converted },
    { key: "noname", label: "No name", n: counts.noname },
  ];

  return (
    <div className="mt-4 space-y-3">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search name, email, or phone…"
        className="w-full sm:max-w-sm bg-steel border border-line rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
      />
      <div className="flex flex-wrap gap-1.5">
        {cats.map((c) => (
          <button key={c.key} type="button" onClick={() => setCat(c.key)} className={chip(cat === c.key)}>
            {c.label} <span className="opacity-60">({c.n})</span>
          </button>
        ))}
      </div>
    </div>
  );
}
