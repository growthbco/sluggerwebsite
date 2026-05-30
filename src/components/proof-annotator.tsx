"use client";

import { useRef, useState } from "react";
import Image from "next/image";

export type Annotation = { n: number; x: number; y: number; note: string };

/** Click-to-pin annotator. Each click on the proof drops a numbered pin; the
 *  client adds a note tied to that pin. Coordinates are stored as percentages
 *  so the pins re-position correctly at any image size. */
export function ProofAnnotator({
  proofUrl,
  generalNote,
  setGeneralNote,
  annotations,
  setAnnotations,
  disabled,
}: {
  proofUrl: string;
  generalNote: string;
  setGeneralNote: (s: string) => void;
  annotations: Annotation[];
  setAnnotations: (a: Annotation[]) => void;
  disabled?: boolean;
}) {
  const imgRef = useRef<HTMLDivElement>(null);
  const [adding, setAdding] = useState(true);

  function handleImgClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!adding || disabled) return;
    const box = imgRef.current?.getBoundingClientRect();
    if (!box) return;
    const x = ((e.clientX - box.left) / box.width) * 100;
    const y = ((e.clientY - box.top) / box.height) * 100;
    const n = (annotations[annotations.length - 1]?.n ?? 0) + 1;
    setAnnotations([...annotations, { n, x, y, note: "" }]);
  }

  function updateNote(n: number, note: string) {
    setAnnotations(annotations.map((a) => (a.n === n ? { ...a, note } : a)));
  }

  function removePin(n: number) {
    // Renumber sequentially so pins always read 1, 2, 3...
    const next = annotations.filter((a) => a.n !== n).map((a, i) => ({ ...a, n: i + 1 }));
    setAnnotations(next);
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-muted">
            {adding ? "Click anywhere on the proof to drop a pin, then add a note." : "Annotation paused. Toggle to add more pins."}
          </p>
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            className="text-xs display text-foreground border border-line px-3 py-1 hover:border-brand/50"
          >
            {adding ? "Pause pin-drop" : "Resume pin-drop"}
          </button>
        </div>
        <div
          ref={imgRef}
          onClick={handleImgClick}
          className={`relative bg-white border border-line w-full ${adding && !disabled ? "cursor-crosshair" : ""}`}
          style={{ aspectRatio: "4 / 3" }}
        >
          <Image src={proofUrl} alt="Proof" fill sizes="(max-width: 768px) 100vw, 700px" className="object-contain p-2 pointer-events-none" unoptimized />
          {annotations.map((a) => (
            <span
              key={a.n}
              className="absolute -translate-x-1/2 -translate-y-1/2 grid place-items-center h-7 w-7 rounded-full bg-brand text-on-brand display text-xs shadow-lg ring-2 ring-on-brand pointer-events-none"
              style={{ left: `${a.x}%`, top: `${a.y}%` }}
            >
              {a.n}
            </span>
          ))}
        </div>
      </div>

      {annotations.length > 0 && (
        <div className="space-y-2">
          {annotations.map((a) => (
            <div key={a.n} className="flex gap-3 items-start bg-steel border border-line p-3">
              <span className="shrink-0 grid place-items-center h-7 w-7 rounded-full bg-brand text-on-brand display text-xs mt-0.5">{a.n}</span>
              <input
                value={a.note}
                onChange={(e) => updateNote(a.n, e.target.value)}
                placeholder={`Note for pin ${a.n} (e.g. "make the C bigger")`}
                className="flex-1 bg-ink border border-line px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
                disabled={disabled}
              />
              <button
                type="button"
                onClick={() => removePin(a.n)}
                className="text-muted hover:text-brand text-sm px-1"
                aria-label={`Remove pin ${a.n}`}
                disabled={disabled}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div>
        <label className="display text-sm text-foreground">Anything else (optional)</label>
        <textarea
          value={generalNote}
          onChange={(e) => setGeneralNote(e.target.value)}
          placeholder="General feedback that isn't tied to a specific spot..."
          className="mt-2 w-full bg-steel border border-line px-3 py-2.5 text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none min-h-20"
          disabled={disabled}
        />
      </div>
    </div>
  );
}
