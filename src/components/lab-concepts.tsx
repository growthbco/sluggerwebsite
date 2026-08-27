"use client";

import { useState } from "react";
import Image from "next/image";

/** Concepts count that opens the visitor's generated images in a lightweight
 *  overlay - keeps the leads table scannable instead of 30 tall galleries. */
export function LabConcepts({ concepts }: { concepts: { url: string; note?: string | null }[] }) {
  const [open, setOpen] = useState(false);
  if (concepts.length === 0) return <span className="text-muted/40 tabular-nums">0</span>;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs display text-brand border border-brand/40 px-2 py-0.5 hover:bg-brand/10 tabular-nums"
      >
        {concepts.length}
      </button>
      {open && (
        <div className="fixed inset-0 z-[80] bg-black/80 p-4 overflow-auto" onClick={() => setOpen(false)}>
          <div className="mx-auto max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end">
              <button type="button" onClick={() => setOpen(false)} className="text-white/80 hover:text-white text-3xl leading-none" aria-label="Close">×</button>
            </div>
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {concepts.map((c, i) => (
                <figure key={i}>
                  <a href={c.url} target="_blank" rel="noopener noreferrer" className="block relative aspect-square bg-white border border-line overflow-hidden">
                    <Image src={c.url} alt={c.note ?? "AI concept"} fill sizes="25vw" className="object-contain p-1" unoptimized />
                  </a>
                  {c.note && <figcaption className="mt-1 text-[11px] text-white/70 line-clamp-2">{c.note}</figcaption>}
                </figure>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
