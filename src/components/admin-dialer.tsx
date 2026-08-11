"use client";

import { useEffect, useRef, useState } from "react";
import type { Device, Call } from "@twilio/voice-sdk";

const prettyPhone = (p: string) => {
  const d = p.replace(/\D/g, "").slice(-10);
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p;
};
const toE164 = (raw: string): string | null => {
  const d = raw.replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  return null;
};

type Recent = { direction: "in" | "out"; number: string; name: string | null; at: string; durationSec: number; status: string };

const KEYS: [string, string][] = [
  ["1", ""], ["2", "ABC"], ["3", "DEF"],
  ["4", "GHI"], ["5", "JKL"], ["6", "MNO"],
  ["7", "PQRS"], ["8", "TUV"], ["9", "WXYZ"],
  ["*", ""], ["0", "+"], ["#", ""],
];

/** The admin softphone: keypad + recents tabs, browser calling from
 *  (352) 414-7270 with mute, a call timer, and in-call touch tones (the
 *  keypad sends DTMF during a call, for phone menus). Other admin surfaces
 *  open it via window.dispatchEvent(new CustomEvent("slugger-dial",
 *  { detail: { phone } })). */
export function AdminDialer() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"keypad" | "recents">("keypad");
  const [number, setNumber] = useState("");
  const [status, setStatus] = useState<"idle" | "connecting" | "ringing" | "in-call" | "error">("idle");
  const [error, setError] = useState("");
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [recents, setRecents] = useState<Recent[] | null>(null);
  const [showPadInCall, setShowPadInCall] = useState(false);
  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Click-to-call from anywhere in the admin (texts panel, order pages).
  useEffect(() => {
    const onDial = (e: Event) => {
      const phone = (e as CustomEvent<{ phone?: string }>).detail?.phone;
      if (!phone) return;
      setOpen(true);
      setTab("keypad");
      setNumber(prettyPhone(phone));
    };
    window.addEventListener("slugger-dial", onDial);
    return () => window.removeEventListener("slugger-dial", onDial);
  }, []);

  useEffect(() => () => { deviceRef.current?.destroy(); if (timerRef.current) clearInterval(timerRef.current); }, []);

  // Load call history when the Recents tab opens.
  useEffect(() => {
    if (!open || tab !== "recents") return;
    setRecents(null);
    fetch("/api/admin/voice/recents")
      .then((r) => r.json())
      .then((d) => setRecents(d.calls ?? []))
      .catch(() => setRecents([]));
  }, [open, tab]);

  async function getDevice(): Promise<Device> {
    if (deviceRef.current) return deviceRef.current;
    const res = await fetch("/api/admin/voice/token");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Softphone unavailable");
    const { Device } = await import("@twilio/voice-sdk");
    const device = new Device(data.token, { logLevel: "error" });
    device.on("tokenWillExpire", async () => {
      try {
        const r = await fetch("/api/admin/voice/token");
        const d = await r.json();
        if (r.ok) device.updateToken(d.token);
      } catch {}
    });
    deviceRef.current = device;
    return device;
  }

  function startTimer() {
    setSeconds(0);
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  }
  function stopTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }
  function resetCallState() {
    setStatus("idle");
    setMuted(false);
    setShowPadInCall(false);
    stopTimer();
    callRef.current = null;
  }

  async function dial(target?: string) {
    const to = toE164(target ?? number);
    if (!to) { setError("Enter a valid 10-digit US number."); return; }
    if (target) setNumber(prettyPhone(target));
    setError("");
    setTab("keypad");
    setStatus("connecting");
    try {
      const device = await getDevice();
      const call = await device.connect({ params: { To: to } });
      callRef.current = call;
      setStatus("ringing");
      call.on("accept", () => { setStatus("in-call"); startTimer(); });
      call.on("disconnect", resetCallState);
      call.on("cancel", resetCallState);
      call.on("error", (e: Error) => { setStatus("error"); setError(e.message); stopTimer(); callRef.current = null; });
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Could not start the call");
    }
  }

  function hangUp() {
    callRef.current?.disconnect();
    deviceRef.current?.disconnectAll();
    resetCallState();
  }

  function pressKey(k: string) {
    if (inCall && callRef.current) {
      // Mid-call: send touch tones for phone menus ("press 2 for...").
      callRef.current.sendDigits(k);
      setNumber((n) => n + k); // show what was sent
    } else {
      setNumber((n) => (n.replace(/\D/g, "").length >= 11 ? n : n + k));
    }
  }

  const mmss = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  const inCall = status === "in-call" || status === "ringing" || status === "connecting";
  const fmtAgo = (iso: string) =>
    new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const fmtDur = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`);

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open ? (
        <div className="w-80 border border-line bg-steel shadow-2xl rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 bg-background/60 border-b border-line">
            <span className="display text-sm text-foreground">📞 Dialer</span>
            <span className="flex items-center gap-2">
              <span className="text-[11px] text-muted">from (352) 414-7270</span>
              <button type="button" onClick={() => { if (!inCall) setOpen(false); }} className={`text-muted hover:text-foreground text-lg leading-none ${inCall ? "opacity-30" : ""}`} aria-label="Close">×</button>
            </span>
          </div>

          {!inCall && (
            <div className="flex border-b border-line">
              {(["keypad", "recents"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`flex-1 display text-xs uppercase tracking-wide py-2 ${tab === t ? "text-brand border-b-2 border-brand" : "text-muted hover:text-foreground"}`}
                >
                  {t === "keypad" ? "Keypad" : "Recents"}
                </button>
              ))}
            </div>
          )}

          {tab === "recents" && !inCall ? (
            <div className="max-h-80 overflow-y-auto">
              {recents === null && <p className="px-4 py-6 text-sm text-muted text-center">Loading call history…</p>}
              {recents?.length === 0 && <p className="px-4 py-6 text-sm text-muted text-center">No calls yet.</p>}
              {recents?.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => dial(r.number)}
                  title="Call back"
                  className="w-full text-left px-4 py-2.5 border-b border-line/60 last:border-b-0 hover:bg-brand/10 flex items-center justify-between gap-2"
                >
                  <span className="min-w-0">
                    <span className="block text-sm text-foreground truncate">
                      {r.direction === "out" ? "↗" : r.status === "no-answer" || r.status === "busy" ? "↙ ✗" : "↙"} {r.name ?? prettyPhone(r.number)}
                    </span>
                    <span className="block text-[11px] text-muted">
                      {r.name ? `${prettyPhone(r.number)} · ` : ""}{fmtAgo(r.at)}{r.durationSec > 0 ? ` · ${fmtDur(r.durationSec)}` : r.status === "no-answer" ? " · missed" : ""}
                    </span>
                  </span>
                  <span className="text-brand text-lg shrink-0">📞</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-4 space-y-3">
              <div className="relative">
                <input
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !inCall) dial(); }}
                  placeholder="(000) 000-0000"
                  inputMode="tel"
                  disabled={inCall}
                  className="w-full bg-background border border-line px-3 py-2.5 pr-9 text-lg text-foreground text-center tracking-wide placeholder:text-muted/50 focus:border-brand focus:outline-none disabled:opacity-60"
                />
                {!inCall && number && (
                  <button type="button" onClick={() => setNumber((n) => n.slice(0, -1))} onDoubleClick={() => setNumber("")} title="Backspace (double-click to clear)"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-foreground">⌫</button>
                )}
              </div>

              <div className="text-center text-xs text-muted h-4">
                {status === "connecting" && "Connecting…"}
                {status === "ringing" && "Ringing…"}
                {status === "in-call" && <span className="text-green-400 display">● In call · {mmss}{muted ? " · muted" : ""}</span>}
                {(status === "error" || (status === "idle" && error)) && <span className="text-red-400">{error}</span>}
              </div>

              {(!inCall || showPadInCall) && (
                <div className="grid grid-cols-3 gap-1.5">
                  {KEYS.map(([k, letters]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => pressKey(k)}
                      className="rounded-lg border border-line bg-background py-2.5 hover:border-brand/50 hover:bg-brand/5 active:bg-brand/15"
                    >
                      <span className="block text-lg leading-none text-foreground">{k}</span>
                      <span className="block text-[9px] tracking-[0.2em] text-muted h-2.5">{letters}</span>
                    </button>
                  ))}
                </div>
              )}

              {inCall ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { callRef.current?.mute(!muted); setMuted(!muted); }}
                    className={`flex-1 display text-sm py-2.5 rounded-lg border ${muted ? "bg-amber-500/20 border-amber-500/60 text-amber-300" : "border-line text-foreground hover:border-brand/50"}`}
                  >
                    {muted ? "🔇 Unmute" : "🎙 Mute"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPadInCall((v) => !v)}
                    title="Touch tones for phone menus"
                    className={`display text-sm px-3 py-2.5 rounded-lg border ${showPadInCall ? "border-brand text-brand bg-brand/10" : "border-line text-foreground hover:border-brand/50"}`}
                  >
                    #
                  </button>
                  <button type="button" onClick={hangUp} className="flex-1 display text-sm py-2.5 rounded-lg bg-red-500 hover:bg-red-600 text-white">
                    ⏹ End
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => dial()} disabled={!number.trim()} className="w-full display text-sm py-3 rounded-lg bg-brand hover:bg-brand-dark text-on-brand disabled:opacity-50">
                  📞 Call
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 border border-brand/50 bg-steel text-brand display text-sm px-4 py-2.5 rounded-full shadow-xl hover:bg-brand/10"
        >
          📞 Dialer
        </button>
      )}
    </div>
  );
}
