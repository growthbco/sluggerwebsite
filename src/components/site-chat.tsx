"use client";

import { useEffect, useRef, useState } from "react";
import { SmsConsentNote } from "@/components/sms-consent";

type Turn = { role: "user" | "bot"; text: string };

// Bot replies mention site paths (/design, /pricing) and URLs - render them
// as real links so visitors can tap straight through.
const LINK_RE = /(https?:\/\/[^\s]+|(?<![\w/])\/(?:design|team-order|team-stores|team-uniforms|pricing|custom-[a-z-]+|hype-chains|embroidery|faq|track|gallery|services|size-guide)(?:\/[\w-]+)*)/g;

function withLinks(text: string) {
  const parts = text.split(LINK_RE);
  return parts.map((part, i) => {
    if (!part) return null;
    if (i % 2 === 1) {
      const href = part.startsWith("http") ? part.replace(/[.,!?)]+$/, "") : part;
      const trailing = part.slice(href.length);
      return (
        <span key={i}>
          <a href={href} className="text-brand underline underline-offset-2 break-all">{href}</a>
          {trailing}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

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
  const [textMode, setTextMode] = useState(false);
  const [tmName, setTmName] = useState("");
  const [tmPhone, setTmPhone] = useState("");
  const [tmConsent, setTmConsent] = useState(false);
  const [tmBusy, setTmBusy] = useState(false);
  const [tmError, setTmError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Hand the conversation off to SMS: we text them first, staff continue from
  // the admin Texts inbox.
  async function requestText() {
    setTmBusy(true);
    setTmError("");
    try {
      const lastUserMsg = [...turns].reverse().find((t) => t.role === "user")?.text ?? "";
      const res = await fetch("/api/chat/text-me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: tmName, phone: tmPhone, consent: tmConsent, question: lastUserMsg }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not set that up");
      setTextMode(false);
      setTurns((t) => [...t, { role: "bot", text: `Done! We just texted you at ${tmPhone} - reply there and a real person will take it from here. 📱` }]);
    } catch (e) {
      setTmError((e as Error).message);
    } finally {
      setTmBusy(false);
    }
  }

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
    // Hold the reply behind a human-like pause (30-60s) so it reads like a
    // real person typing, not an instant bot. The "typing…" indicator shows
    // the whole time; we run the request during the wait so the answer is
    // ready the moment the pause ends.
    const started = Date.now();
    const humanDelay = 30000 + Math.floor(Math.random() * 30000);
    let reply = "Text us at (352) 414-7270 and we'll help right away.";
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.slice(1) }), // drop the canned welcome
      });
      const data = await res.json();
      if (data.reply) reply = data.reply;
    } catch {
      reply = "I'm having trouble connecting - text us at (352) 414-7270 and we'll help right away.";
    }
    const remaining = humanDelay - (Date.now() - started);
    if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
    setTurns((t) => [...t, { role: "bot", text: reply }]);
    setBusy(false);
  }

  return (
    <>
      {/* Launcher */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close chat" : "Chat with us"}
        className="fixed bottom-4 right-4 z-50 h-14 w-14 rounded-full bg-brand text-on-brand shadow-xl grid place-items-center hover:bg-brand-dark transition-colors"
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /></svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" strokeLinecap="round" strokeLinejoin="round" /></svg>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-20 left-3 right-3 sm:left-auto sm:right-4 z-50 sm:w-96 bg-ink border border-line rounded-lg overflow-hidden shadow-2xl flex flex-col" style={{ height: "min(560px, 70dvh)" }}>
          <div className="px-4 py-3 border-b border-line bg-steel">
            <p className="display text-foreground">Slugger Athletics</p>
            <p className="text-xs text-muted">Usually replies in a minute · or text (352) 414-7270</p>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {turns.map((t, i) => (
              <div key={i} className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] px-3 py-2 text-sm whitespace-pre-line border rounded-md ${t.role === "user" ? "bg-brand/15 border-brand/40 text-foreground" : "bg-steel border-line text-foreground/90"}`}>
                  {t.role === "bot" ? withLinks(t.text) : t.text}
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

          {textMode ? (
            <div className="p-3 border-t border-line space-y-2">
              <p className="text-sm text-foreground display">📱 Get a text back</p>
              <div className="flex gap-2">
                <input value={tmName} onChange={(e) => setTmName(e.target.value)} placeholder="Name" maxLength={60}
                  className="flex-1 min-w-0 bg-steel border border-line px-3 py-2 text-base sm:text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none" />
                <input value={tmPhone} onChange={(e) => setTmPhone(e.target.value)} type="tel" placeholder="(000) 000-0000" maxLength={20}
                  className="flex-1 min-w-0 bg-steel border border-line px-3 py-2 text-base sm:text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none" />
              </div>
              <SmsConsentNote onChange={setTmConsent} />
              {tmError && <p className="text-xs text-red-400">{tmError}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={requestText} disabled={tmBusy || !tmConsent || !tmName.trim() || tmPhone.replace(/\D/g, "").length < 10}
                  className="flex-1 rounded bg-brand text-on-brand display text-sm py-2 disabled:opacity-50">
                  {tmBusy ? "Sending…" : "Text me"}
                </button>
                <button type="button" onClick={() => setTextMode(false)} className="rounded border border-line text-muted text-sm px-3">Back</button>
              </div>
            </div>
          ) : (
            <div className="p-3 border-t border-line">
              <div className="flex gap-2">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") send(draft); }}
                  placeholder="Ask about pricing, turnaround…"
                  className="flex-1 min-w-0 bg-steel border border-line px-3 py-2.5 text-base sm:text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
                />
                <button type="button" onClick={() => send(draft)} disabled={busy || !draft.trim()} className="rounded bg-brand text-on-brand display text-sm px-4 disabled:opacity-50">
                  Send
                </button>
              </div>
              <button type="button" onClick={() => setTextMode(true)} className="mt-2 w-full text-center text-xs text-brand underline underline-offset-2">
                📱 Prefer texting? Get a text back from a real person
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
