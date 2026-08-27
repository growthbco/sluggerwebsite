"use client";

import { useState } from "react";

export type ManageTab = { key: string; label: string; content: React.ReactNode };

/** Tabbed shell for the team-order manage page so a coach sees one focused
 *  panel at a time instead of one long scroll. All panels stay mounted (hidden
 *  when inactive) so in-progress roster edits and form state survive tab
 *  switches. The tab bar scrolls horizontally on narrow screens. */
export function ManageTabs({ tabs }: { tabs: ManageTab[] }) {
  const [active, setActive] = useState(tabs[0]?.key);
  return (
    <div>
      <div
        role="tablist"
        className="flex gap-1 overflow-x-auto border-b border-line -mx-4 px-4 sm:mx-0 sm:px-0 sticky top-0 z-20 bg-ink"
      >
        {tabs.map((t) => {
          const on = active === t.key;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={on}
              onClick={() => setActive(t.key)}
              className={`shrink-0 display text-sm px-4 py-3 border-b-2 -mb-px whitespace-nowrap transition-colors ${
                on ? "border-brand text-foreground" : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div className="pt-6">
        {tabs.map((t) => (
          <div key={t.key} role="tabpanel" hidden={active !== t.key}>
            {t.content}
          </div>
        ))}
      </div>
    </div>
  );
}
