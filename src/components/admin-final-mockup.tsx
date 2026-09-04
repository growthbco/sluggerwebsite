"use client";

import Image from "next/image";
import { useRef, useState } from "react";

type PreviewPosition = { top: number; left: number };

export function AdminFinalMockup({ teamName, images }: { teamName: string; images: string[] }) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<PreviewPosition | null>(null);

  if (images.length === 0) {
    return <span className="text-[11px] text-muted">None</span>;
  }

  function showPreview() {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const panelWidth = 360;
    const panelHeight = images.length > 2 ? 390 : 250;
    const left = rect.right + 12 + panelWidth <= window.innerWidth
      ? rect.right + 12
      : Math.max(12, rect.left - panelWidth - 12);
    const top = Math.min(
      Math.max(12, rect.top - 70),
      Math.max(12, window.innerHeight - panelHeight - 12),
    );
    setPosition({ top, left });
  }

  return (
    <div
      ref={triggerRef}
      className="relative inline-flex"
      onMouseEnter={showPreview}
      onMouseLeave={() => setPosition(null)}
      onFocus={showPreview}
      onBlur={() => setPosition(null)}
    >
      <a
        href={images[0]}
        target="_blank"
        rel="noopener noreferrer"
        title={`Hover to preview ${teamName}'s final approved mockup; click to open full size`}
        aria-label={`Open ${teamName}'s final approved mockup`}
        className="relative block h-12 w-12 overflow-hidden rounded border border-line bg-white hover:border-brand focus:border-brand focus:outline-none"
      >
        <Image src={images[0]} alt="" fill sizes="48px" className="object-contain" unoptimized />
        {images.length > 1 && (
          <span className="absolute bottom-0 right-0 bg-ink/90 px-1 py-0.5 text-[9px] leading-none text-foreground">
            +{images.length - 1}
          </span>
        )}
      </a>

      {position && (
        <div
          className="pointer-events-none fixed z-[100] w-[360px] max-w-[calc(100vw-24px)] rounded-lg border border-brand/50 bg-ink p-3 shadow-2xl"
          style={{ top: position.top, left: position.left }}
          role="tooltip"
        >
          <p className="display text-xs uppercase tracking-wide text-brand">Final approved mockup{images.length === 1 ? "" : "s"}</p>
          <p className="mt-0.5 truncate text-xs text-muted">{teamName}</p>
          <div className={`mt-2 grid gap-2 ${images.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
            {images.slice(0, 4).map((src, index) => (
              <div key={src} className="relative aspect-square overflow-hidden rounded bg-white">
                <Image
                  src={src}
                  alt={`${teamName} final approved mockup ${index + 1}`}
                  fill
                  sizes={images.length > 1 ? "164px" : "328px"}
                  className="object-contain"
                  unoptimized
                />
              </div>
            ))}
          </div>
          {images.length > 4 && <p className="mt-2 text-xs text-muted">+{images.length - 4} more approved mockups</p>}
          <p className="mt-2 text-[10px] text-muted">Click the thumbnail to open the first mockup full size.</p>
        </div>
      )}
    </div>
  );
}
