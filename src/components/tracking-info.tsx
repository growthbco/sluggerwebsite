"use client";

import { useState } from "react";
import { carrierFor, trackingUrlFor } from "@/lib/tracking";

/** Admin-side tracking display: carrier badge + clickable carrier link + a
 *  copy button, plus the reprint-label link when a Shippo PDF is on file. */
export function TrackingInfo({
  trackingNumber,
  labelUrl,
}: {
  trackingNumber: string;
  labelUrl?: string | null;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(trackingNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <a
        href={trackingUrlFor(trackingNumber)}
        target="_blank"
        rel="noopener noreferrer"
        title={`Track on ${carrierFor(trackingNumber)}`}
        className="text-xs display text-sky-400 underline decoration-dotted underline-offset-2 hover:text-sky-300"
      >
        {carrierFor(trackingNumber)} {trackingNumber}
      </a>
      <button
        type="button"
        onClick={copy}
        title="Copy tracking number"
        className="text-[10px] display text-muted border border-line px-1.5 py-0.5 hover:border-brand/50 hover:text-foreground"
      >
        {copied ? "✓ copied" : "⧉ copy"}
      </button>
      {labelUrl && (
        <a
          href={labelUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Reprint the shipping label"
          className="text-[10px] display text-brand border border-brand/40 px-1.5 py-0.5 hover:bg-brand/10"
        >
          🖨 Label
        </a>
      )}
    </span>
  );
}
