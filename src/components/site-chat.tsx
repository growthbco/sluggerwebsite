"use client";

import { useEffect, useRef, useState } from "react";

type Turn = { role: "user" | "bot"; text: string };

const WELCOME: Turn = {
  role: "bot",
  text: "Hey! I'm the Slugger assistant. Ask me about pricing, custom uniforms, hats, turnaround - anything. How can I help?",
};

const QUICK_PROMPTS = ["How much are custom jerseys?", "How does ordering work?", "How fast can you make hats?"];

/** Public AI chat widget (replaces the old unused GHL widget). Bottom-right;
 *  the staff shortcut lives bottom-left so they never collide. */
export function SiteChat() {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([WELCOME]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, open]);

  async function send(text: string) {
    const msg = text.trim();
    if (!msg || busy) return;
    const next: Turn[] = [...turns, { role: "user", text: msg }];
    setTurns(next);
    setDraft("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.slice(1) }), // drop the canned welcome
      });
      const data = await res.json();
      setTurns((t) => [...t, { role: "bot", text: data.reply ?? "Text us at (352) 660-1232 and we'll help right away." }]);
    } catch {
      setTurns((t) => [...t, { role: "bot", text: "I'm having trouble connecting - text us at (352) 660-1232 and we'll help right away." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Launcher */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close chat" : "Chat with us"}
        className="fixed bottom-4 right-4 z-50 h-14 w-14 clip-slant bg-brand text-on-brand shadow-xl grid place-items-center hover:bg-brand-dark transition-colors"
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /></svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" strokeLinecap="round" strokeLinejoin="round" /></svg>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-20 right-4 z-50 w-[92vw] max-w-sm bg-ink border border-line shadow-2xl flex flex-col" style={{ height: "min(560px, 75vh)" }}>
          <div className="px-4 py-3 border-b border-line bg-steel">
            <p className="display text-foreground">Slugger Athletics</p>
            <p className="text-xs text-muted">Usually replies instantly · or text (352) 660-1232</p>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {turns.map((t, i) => (
              <div key={i} className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] px-3 py-2 text-sm whitespace-pre-line border ${t.role === "user" ? "bg-brand/15 border-brand/40 text-foreground" : "bg-steel border-line text-foreground/90"}`}>
                  {t.text}
                </div>
              </div>
            ))}
            {busy && <p className="text-xs text-muted pl-1">typing…</p>}
            {turns.length === 1 && (
              <div className="pt-1 space-y-1.5">
                {QUICK_PROMPTS.map((q) => (
                  <button key={q} type="button" onClick={() => send(q)} className="block w-full text-left text-sm text-brand border border-brand/40 px-3 py-2 hover:bg-brand/10">
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-3 border-t border-line flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(draft); }}
              placeholder="Ask about pricing, turnaround…"
              className="flex-1 bg-steel border border-line px-3 py-2.5 text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
            />
            <button type="button" onClick={() => send(draft)} disabled={busy || !draft.trim()} className="clip-slant bg-brand text-on-brand display text-sm px-4 disabled:opacity-50">
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}
