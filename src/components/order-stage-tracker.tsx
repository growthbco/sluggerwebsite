// Presentational progress tracker for the customer order hub. Renders the four
// lifecycle stages (Approve -> Roster -> Deposit -> Track) so the customer sees
// one link that advances through their whole order. Server component - no state.

export type StageState = "done" | "active" | "todo";
export type Stage = { label: string; state: StageState };

export function OrderStageTracker({ stages }: { stages: Stage[] }) {
  return (
    <ol className="flex items-stretch gap-1 sm:gap-2" aria-label="Order progress">
      {stages.map((s, i) => {
        const done = s.state === "done";
        const active = s.state === "active";
        return (
          <li key={s.label} className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={`grid place-items-center h-7 w-7 shrink-0 rounded-full display text-sm border-2 ${
                  done
                    ? "bg-brand text-on-brand border-brand"
                    : active
                      ? "bg-brand/10 text-brand border-brand"
                      : "bg-transparent text-muted border-line"
                }`}
                aria-hidden
              >
                {done ? "✓" : i + 1}
              </span>
              {i < stages.length - 1 && (
                <span className={`hidden sm:block h-px flex-1 ${done ? "bg-brand" : "bg-line"}`} />
              )}
            </div>
            <p
              className={`mt-2 text-[11px] sm:text-xs leading-tight ${
                active ? "text-foreground display" : done ? "text-foreground" : "text-muted"
              }`}
            >
              {s.label}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
