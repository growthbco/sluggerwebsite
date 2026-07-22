"use client";

import { useState } from "react";

type Fact = { id: string; fact: string };

/** Admin "train the bot" panel: teach the AI assistant shop facts (pricing
 *  nuances, policies, product details). Every fact is injected into the AI's
 *  knowledge for client auto-replies and staff reply drafts. */
export function AdminAssistantFacts({ initial }: { initial: Fact[] }) {
  const [facts, setFacts] = useState<Fact[]>(initial);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function add() {
    const fact = draft.trim();
    if (!fact) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/assistant-facts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fact }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save");
      setFacts((f) => [...f, data.fact]);
      setDraft("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/assistant-facts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error("Could not delete");
      setFacts((f) => f.filter((x) => x.id !== id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {facts.length > 0 ? (
        <ul className="space-y-2">
          {facts.map((f) => (
            <li key={f.id} className="flex items-start justify-between gap-3 bg-steel border border-line px-3 py-2 text-sm">
              <span className="text-foreground/90 whitespace-pre-line">{f.fact}</span>
              <button
                type="button"
                onClick={() => remove(f.id)}
                disabled={busy}
                className="shrink-0 text-xs display text-muted hover:text-red-400 disabled:opacity-50"
                title="The AI immediately stops using this fact"
              >
                ✕ Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Nothing taught yet - the AI runs on the FAQs, price list, and order data.</p>
      )}
      <div className="mt-3 flex gap-2 items-end">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          placeholder={'e.g. "A quarter-zip changes the per-piece price - it is a different material."'}
          className="flex-1 bg-steel border border-line px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none"
          disabled={busy}
        />
        <button
          type="button"
          onClick={add}
          disabled={busy || !draft.trim()}
          className="clip-slant bg-brand hover:bg-brand-dark text-on-brand display text-sm px-5 py-2.5 disabled:opacity-50"
        >
          {busy ? "Saving..." : "Teach"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}
