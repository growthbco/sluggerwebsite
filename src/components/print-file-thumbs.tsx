"use client";

import { useState } from "react";

/** Small clickable thumbnails of approved print-file sheets. Images open in an
 *  in-page lightbox; PDFs open in a new tab (they can't thumbnail inline). */
export function PrintFileThumbs({ urls }: { urls: string[] }) {
  const [active, setActive] = useState<string | null>(null);
  if (!urls?.length) return null;
  const isPdf = (u: string) => /\.pdf($|\?)/i.test(u);
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted">Print file:</span>
      {urls.map((u, i) =>
        isPdf(u) ? (
          <a
            key={i}
            href={u}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs display border border-line px-2 py-1 rounded text-brand hover:bg-brand/10"
          >
            📄 Sheet {i + 1} (PDF)
          </a>
        ) : (
          <button
            key={i}
            type="button"
            onClick={() => setActive(u)}
            className="h-12 w-12 border border-line rounded overflow-hidden bg-white hover:ring-2 hover:ring-brand"
            title="Click to enlarge"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt={`Print file sheet ${i + 1}`} className="h-full w-full object-cover" />
          </button>
        ),
      )}
      {active && (
        <div className="fixed inset-0 z-[70] bg-black/80 grid place-items-center p-4" onClick={() => setActive(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={active} alt="Print file" className="max-h-[90vh] max-w-[90vw] object-contain" />
          <button type="button" className="absolute top-4 right-4 text-white text-2xl" aria-label="Close">×</button>
        </div>
      )}
    </div>
  );
}
