"use client";

import { useRef, useState } from "react";

/** "⋯" trigger that opens a floating dropdown of secondary row actions.
 *  Positioned fixed (measured from the trigger) so the table's horizontal
 *  scroll container can't clip it; opens upward near the viewport bottom. */
export function AdminRowMenu({ children }: { children: React.ReactNode }) {
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  function toggle() {
    if (pos) {
      setPos(null);
      return;
    }
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const right = Math.max(8, window.innerWidth - r.right);
    if (r.bottom > window.innerHeight - 280) {
      setPos({ bottom: window.innerHeight - r.top + 6, right });
    } else {
      setPos({ top: r.bottom + 6, right });
    }
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        title="More actions"
        aria-expanded={Boolean(pos)}
        className={`text-xs display px-2.5 py-1 border whitespace-nowrap ${
          pos ? "border-brand text-foreground bg-brand/10" : "border-line text-muted hover:border-brand/50 hover:text-foreground"
        }`}
      >
        ⋯
      </button>
      {pos && (
        <>
          {/* Click-away backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setPos(null)} />
          <div
            className="fixed z-50 min-w-[15rem] max-w-[90vw] bg-ink border border-line shadow-2xl p-2.5 flex flex-col items-start gap-2"
            style={pos}
          >
            {children}
          </div>
        </>
      )}
    </>
  );
}
