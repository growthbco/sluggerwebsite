import type { ReactNode } from "react";

// Standard page header for every admin screen: a small section eyebrow over a
// large title, with an optional right-hand slot for actions or a stat. Matches
// the dashboard's "Command center / Overview" treatment - no emoji.
export function AdminPageHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div>
        {eyebrow && <span className="text-[11px] uppercase tracking-[0.2em] text-muted">{eyebrow}</span>}
        <h1 className="display text-3xl sm:text-4xl text-foreground mt-1">{title}</h1>
      </div>
      {children && <div className="flex flex-wrap items-center gap-3">{children}</div>}
    </header>
  );
}
