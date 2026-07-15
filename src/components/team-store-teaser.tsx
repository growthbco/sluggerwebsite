"use client";

import { useState } from "react";
import Link from "next/link";

/** Compact team-store card for the design manage page. The full setup lives
 *  on its own page so this one stays uncluttered. */
export function TeamStoreTeaser({
  manageToken,
  store,
}: {
  manageToken: string;
  store: { url: string; active: boolean } | null;
}) {
  const [copied, setCopied] = useState(false);

  if (store) {
    return (
      <section className="bg-steel border border-line p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="display text-foreground">🛒 Team store</h2>
          <span
            className={`text-xs display px-2 py-0.5 border ${
              store.active ? "border-green-500/50 text-green-400" : "border-line text-muted"
            }`}
          >
            {store.active ? "OPEN" : "CLOSED"}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-2 items-center">
          <code className="text-xs text-foreground bg-ink border border-line px-3 py-2 break-all flex-1 min-w-48">{store.url}</code>
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(store.url);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="text-xs display text-foreground border border-line px-3 py-2 hover:border-brand/50"
          >
            {copied ? "Copied ✓" : "Copy link"}
          </button>
          <Link
            href={`/design/manage/${manageToken}/store`}
            className="text-xs display text-brand border border-brand/40 px-3 py-2 hover:bg-brand/10"
          >
            Store settings →
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-steel border border-line p-4">
      <h2 className="display text-foreground">🛒 Interested in a Team Store for this team?</h2>
      <p className="mt-1.5 text-sm text-muted">
        A private shop page built from their approved design - each player or parent picks their
        gear, adds their name and number, and pays Slugger directly by card. Great when people buy
        individually or join over time.
      </p>
      <Link
        href={`/design/manage/${manageToken}/store`}
        className="mt-3 inline-block clip-slant bg-brand text-on-brand display text-sm px-5 py-2.5 hover:bg-brand-dark"
      >
        Yes, set one up →
      </Link>
    </section>
  );
}
