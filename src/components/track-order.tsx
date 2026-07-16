"use client";

import { useState } from "react";

type Result = {
  reference: string;
  team: string;
  status: string;
  shipped: boolean;
  tracking: { number: string; url: string } | null;
};

export function TrackOrder() {
  const [reference, setReference] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lookup failed");
      setResult(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <form onSubmit={lookup} className="space-y-3">
        <input
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="Order number (TO-XXXXXX or SA-XXXXXX)"
          className="w-full bg-steel border border-line px-3 py-2.5 text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email used on the order"
          className="w-full bg-steel border border-line px-3 py-2.5 text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || !reference.trim() || !email.trim()}
          className="w-full clip-slant bg-brand text-on-brand display text-lg px-6 py-3 hover:bg-brand-dark disabled:opacity-50"
        >
          {busy ? "Checking..." : "Check Status"}
        </button>
      </form>

      {error && <p className="mt-4 text-sm text-brand">{error}</p>}

      {result && (
        <div className="mt-6 bg-steel border border-line p-5">
          <p className="display text-brand text-sm">{result.reference}</p>
          <h2 className="display text-2xl text-foreground mt-1">{result.team}</h2>
          <p className="mt-3 text-foreground">
            <span className="display">Status:</span> {result.status}
          </p>
          {result.tracking && (
            <a
              href={result.tracking.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block clip-slant bg-brand text-on-brand display text-sm px-5 py-2.5 hover:bg-brand-dark"
            >
              🚚 Track package ({result.tracking.number})
            </a>
          )}
        </div>
      )}
    </div>
  );
}
