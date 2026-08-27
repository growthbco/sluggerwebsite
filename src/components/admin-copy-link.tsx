"use client";

import { useState } from "react";

/** Small "Copy vendor link" button for the header - the vendor's private
 *  submit link, copied to clipboard instead of a big banner. */
export function AdminCopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => { navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="text-xs display border border-line rounded-lg px-3 py-1.5 text-muted hover:text-foreground hover:border-brand/50 transition-colors whitespace-nowrap"
      title={link}
    >
      {copied ? "Copied ✓" : "Copy vendor link"}
    </button>
  );
}
