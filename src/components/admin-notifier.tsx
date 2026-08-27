"use client";

import { useEffect, useRef, useState } from "react";

type Convo = { phone: string; name: string | null; lastAt: string; unread: boolean; last: { body: string; direction: string } | null };

const prettyPhone = (p: string) => {
  const d = p.replace(/\D/g, "").slice(-10);
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p;
};

/** Global admin notifier: polls for new inbound texts on any admin page and
 *  raises a desktop notification + a tab-title badge, so a reply never sits
 *  unseen. One-time permission ask via a small banner (browsers block silent
 *  requests). Also plays a short beep. */
export function AdminNotifier() {
  const [perm, setPerm] = useState<NotificationPermission>("default");
  const [showAsk, setShowAsk] = useState(false);
  const lastMax = useRef<number>(0);
  const primed = useRef(false);
  const baseTitle = useRef<string>("");
  // Separate baseline for client EMAILS (design-thread replies).
  const lastEmailMax = useRef<number>(0);
  const emailPrimed = useRef(false);

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    setPerm(Notification.permission);
    if (Notification.permission === "default") setShowAsk(true);
    baseTitle.current = document.title;
  }, []);

  function beep() {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 880; g.gain.value = 0.05;
      o.start();
      setTimeout(() => { o.stop(); ctx.close(); }, 180);
    } catch {}
  }

  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const res = await fetch("/api/admin/sms");
        if (!res.ok) return;
        const data = await res.json();
        const convos: Convo[] = data.conversations ?? [];
        const unreadConvos = convos.filter((c) => c.unread);
        const unreadCount = unreadConvos.length;
        // Newest inbound timestamp across all threads.
        const maxIn = convos.reduce((m, c) => {
          if (c.last?.direction === "in") return Math.max(m, new Date(c.lastAt).getTime());
          return m;
        }, 0);

        // Tab title badge.
        document.title = unreadCount > 0 ? `(${unreadCount}) ${baseTitle.current}` : baseTitle.current;

        // First poll just primes the baseline - don't notify for history.
        if (!primed.current) { primed.current = true; lastMax.current = maxIn; return; }
        if (maxIn > lastMax.current) {
          lastMax.current = maxIn;
          const newest = convos.find((c) => c.last?.direction === "in" && new Date(c.lastAt).getTime() === maxIn);
          const who = newest?.name ?? prettyPhone(newest?.phone ?? "");
          beep();
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            const n = new Notification(`New text from ${who}`, {
              body: newest?.last?.body?.slice(0, 120) ?? "Open your Texts inbox to reply.",
              tag: "slugger-sms",
            });
            n.onclick = () => { window.focus(); window.location.href = "/admin/texts"; };
          }
        }
      } catch {}

      // New CLIENT EMAILS (design-thread replies) - same beep + desktop alert.
      try {
        const res = await fetch("/api/admin/notifications");
        if (!res.ok) return;
        const data = await res.json();
        const email = data.latestClientEmail as { at: string; id: string; reference: string; team: string; preview: string } | null;
        const at = email ? new Date(email.at).getTime() : 0;
        if (!emailPrimed.current) { emailPrimed.current = true; lastEmailMax.current = at; return; }
        if (email && at > lastEmailMax.current) {
          lastEmailMax.current = at;
          beep();
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            const n = new Notification(`New email from ${email.team || "a customer"}`, {
              body: email.preview || `New reply on ${email.reference}. Open to answer.`,
              tag: "slugger-email",
            });
            n.onclick = () => { window.focus(); window.location.href = `/admin/texts?tab=email&open=${email.id}`; };
          }
        }
      } catch {}
    }
    poll();
    const t = setInterval(() => { if (alive) poll(); }, 15000);
    return () => { alive = false; clearInterval(t); document.title = baseTitle.current; };
  }, []);

  if (!showAsk || perm !== "default") return null;
  return (
    <div className="fixed bottom-20 sm:bottom-4 left-4 right-4 sm:right-auto z-40 sm:max-w-xs border border-brand/50 bg-steel shadow-xl rounded-lg p-3">
      <p className="text-sm text-foreground display">Turn on message alerts?</p>
      <p className="text-xs text-muted mt-0.5">Get a beep + desktop notification the moment a customer texts or emails back.</p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={async () => {
            const p = await Notification.requestPermission();
            setPerm(p);
            setShowAsk(false);
          }}
          className="text-xs display bg-brand text-on-brand px-3 py-1.5 rounded hover:bg-brand-dark"
        >
          Enable
        </button>
        <button type="button" onClick={() => setShowAsk(false)} className="text-xs display text-muted border border-line px-3 py-1.5 rounded hover:text-foreground">
          Not now
        </button>
      </div>
    </div>
  );
}
