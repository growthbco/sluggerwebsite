"use client";

import { useState } from "react";

export function CopyTextButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="text-xs display border border-line px-3 py-1.5 text-muted hover:border-brand/50 hover:text-foreground"
    >
      {copied ? "Copied" : "Copy customer update"}
    </button>
  );
}
