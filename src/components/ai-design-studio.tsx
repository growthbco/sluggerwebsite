"use client";

import { useState } from "react";

type Version = { url: string; note: string; at: string };

type Props = {
  token: string;
  teamName: string;
  latestChangeRequest?: string;
  initialVersions?: Version[];
};

/** Staff-only AI design studio on the designer's manage page. Generate a
 *  mockup from the brief, refine it with change instructions, and every
 *  version is saved to the design request - so anyone on the team can pick up
 *  exactly where the design left off. */
export function AiDesignStudio({ token, teamName, latestChangeRequest, initialVersions = [] }: Props) {
  const [versions, setVersions] = useState<Version[]>(initialVersions);
  const [activeIdx, setActiveIdx] = useState(initialVersions.length - 1);
  const [instruction, setInstruction] = useState(latestChangeRequest ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const active = versions[activeIdx];

  async function run(action: "generate" | "refine") {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch(`/api/design-request/${token}/ai-design`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          instruction,
          baseUrl: action === "refine" ? active?.url : undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.version) { setError(d.error ?? "Generation failed"); return; }
      setVersions((v) => { const next = [...v, d.version]; setActiveIdx(next.length - 1); return next; });
      setInstruction("");
      if (d.usedFallback) setNote("Made with the backup model (Pro busy) - lettering may be slightly softer.");
    } catch {
      setError("Connection problem - try again");
    } finally {
      setBusy(false);
    }
  }

  async function sendAsProof() {
    if (!active) return;
    setBusy(true); setError(null); setNote(null);
    try {
      const res = await fetch(`/api/design-request/${token}/proof`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: [active.url] }),
      });
      if (!res.ok) { setError((await res.json()).error ?? "Could not send proof"); return; }
      setNote("Sent to the customer as a proof - it's in Sent proofs above and pinged the thread.");
    } catch { setError("Could not send proof"); } finally { setBusy(false); }
  }

  const input = "w-full bg-steel border border-line px-3 py-2.5 text-base sm:text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none";

  return (
    <section className="mt-10 border border-brand/40 bg-brand/[0.04] p-5">
      <div className="flex items-center gap-2">
        <span className="display text-brand text-sm">⚡ STAFF</span>
        <h2 className="display text-xl text-foreground">AI Design Studio</h2>
      </div>
      <p className="mt-1 text-sm text-muted">
        Create or revise {teamName}&apos;s mockup with AI. Every version is saved here, so anyone on
        the team can pick up exactly where the design left off.
      </p>

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <div>
          <div className="relative aspect-[4/3] bg-white border border-line rounded overflow-hidden grid place-items-center">
            {active ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={active.url} alt="AI mockup" className="h-full w-full object-contain" />
            ) : (
              <p className="text-muted text-sm px-8 text-center">No AI mockup yet - generate one from the brief below.</p>
            )}
            {busy && <div className="absolute inset-0 bg-black/40 grid place-items-center"><p className="display text-white">Working…</p></div>}
          </div>
          {active && (
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
              <a href={active.url} download target="_blank" rel="noopener noreferrer" className="text-brand underline underline-offset-2">Download</a>
              <button type="button" onClick={sendAsProof} disabled={busy} className="clip-slant bg-brand text-on-brand display text-sm px-4 py-2 disabled:opacity-50">
                Send to customer as proof →
              </button>
            </div>
          )}
          {versions.length > 1 && (
            <div className="mt-3">
              <p className="display text-xs text-muted tracking-wide">VERSION HISTORY</p>
              <div className="mt-1.5 flex gap-2 overflow-x-auto pb-1">
                {versions.map((v, i) => (
                  <button key={i} type="button" onClick={() => setActiveIdx(i)} title={v.note}
                    className={`shrink-0 h-16 w-[5.3rem] bg-white rounded overflow-hidden border-2 ${i === activeIdx ? "border-brand" : "border-line opacity-70 hover:opacity-100"}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={v.url} alt={`v${i + 1}`} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <label className="display text-xs text-muted tracking-wide">
              {active ? "DESCRIBE THE CHANGE (from the customer's request)" : "EXTRA DIRECTION (optional)"}
            </label>
            <textarea value={instruction} onChange={(e) => setInstruction(e.target.value)} rows={4} maxLength={800}
              placeholder={active ? "e.g. make the sleeves red, add pinstripes, bigger number…" : "e.g. horror theme, blood drips, distressed texture…"}
              className={`${input} resize-y`} />
          </div>
          <div className="flex flex-wrap gap-2">
            {active && (
              <button type="button" onClick={() => run("refine")} disabled={busy || !instruction.trim()}
                className="clip-slant bg-brand hover:bg-brand-dark text-on-brand display px-5 py-2.5 disabled:opacity-50">
                {busy ? "Working…" : "Generate revision"}
              </button>
            )}
            <button type="button" onClick={() => run("generate")} disabled={busy}
              className={`display px-5 py-2.5 disabled:opacity-50 ${active ? "border border-brand/70 text-foreground hover:bg-brand/10" : "clip-slant bg-brand hover:bg-brand-dark text-on-brand"}`}>
              {active ? "Start a fresh mockup" : busy ? "Working…" : "Generate mockup from brief"}
            </button>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          {note && <p className="text-sm text-green-400">{note}</p>}
          <p className="text-xs text-muted">
            Front &amp; back, in the team&apos;s colors, seeded with any logo/reference the customer uploaded. ~13¢ each.
          </p>
        </div>
      </div>
    </section>
  );
}
