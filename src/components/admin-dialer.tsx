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

/** The admin softphone: a floating Dialer (bottom-right, like Masters) that
 *  calls any US number straight from the browser, showing (352) 414-7270 as
 *  caller ID. Other admin surfaces can trigger it via
 *  window.dispatchEvent(new CustomEvent("slugger-dial", { detail: { phone } })). */
export function AdminDialer() {
  const [open, setOpen] = useState(false);
  const [number, setNumber] = useState("");
  const [status, setStatus] = useState<"idle" | "connecting" | "ringing" | "in-call" | "error">("idle");
  const [error, setError] = useState("");
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const deviceRef = useRef<Device | null>(null);
  const callRef = useRef<Call | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Click-to-call from anywhere in the admin (texts panel, order pages).
  useEffect(() => {
    const onDial = (e: Event) => {
      const phone = (e as CustomEvent<{ phone?: string }>).detail?.phone;
      if (!phone) return;
      setOpen(true);
      setNumber(prettyPhone(phone));
    };
    window.addEventListener("slugger-dial", onDial);
    return () => window.removeEventListener("slugger-dial", onDial);
  }, []);

  useEffect(() => () => { deviceRef.current?.destroy(); if (timerRef.current) clearInterval(timerRef.current); }, []);

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

  async function dial() {
    const to = toE164(number);
    if (!to) { setError("Enter a valid 10-digit US number."); return; }
    setError("");
    setStatus("connecting");
    try {
      const device = await getDevice();
      const call = await device.connect({ params: { To: to } });
      callRef.current = call;
      setStatus("ringing");
      call.on("accept", () => { setStatus("in-call"); startTimer(); });
      call.on("disconnect", () => { setStatus("idle"); setMuted(false); stopTimer(); callRef.current = null; });
      call.on("cancel", () => { setStatus("idle"); stopTimer(); callRef.current = null; });
      call.on("error", (e: Error) => { setStatus("error"); setError(e.message); stopTimer(); callRef.current = null; });
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Could not start the call");
    }
  }

  function hangUp() {
    callRef.current?.disconnect();
    deviceRef.current?.disconnectAll();
    setStatus("idle");
    setMuted(false);
    stopTimer();
  }

  function toggleMute() {
    const call = callRef.current;
    if (!call) return;
    call.mute(!muted);
    setMuted(!muted);
  }

  const mmss = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  const inCall = status === "in-call" || status === "ringing" || status === "connecting";

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open ? (
        <div className="w-72 border border-line bg-steel shadow-2xl rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 bg-background/60 border-b border-line">
            <span className="display text-sm text-foreground">📞 Dialer</span>
            <span className="flex items-center gap-2">
              <span className="text-[11px] text-muted">from (352) 414-7270</span>
              <button type="button" onClick={() => { if (!inCall) setOpen(false); }} className={`text-muted hover:text-foreground text-lg leading-none ${inCall ? "opacity-30" : ""}`} aria-label="Close">×</button>
            </span>
          </div>
          <div className="p-4 space-y-3">
            <input
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !inCall) dial(); }}
              placeholder="(000) 000-0000"
              inputMode="tel"
              disabled={inCall}
              className="w-full bg-background border border-line px-3 py-2.5 text-lg text-foreground text-center tracking-wide placeholder:text-muted/50 focus:border-brand focus:outline-none disabled:opacity-60"
            />
            <div className="text-center text-xs text-muted h-4">
              {status === "connecting" && "Connecting…"}
              {status === "ringing" && "Ringing…"}
              {status === "in-call" && `In call · ${mmss}`}
              {status === "error" && <span className="text-red-400">{error}</span>}
              {status === "idle" && error && <span className="text-red-400">{error}</span>}
            </div>
            {inCall ? (
              <div className="flex gap-2">
                <button type="button" onClick={toggleMute} className={`flex-1 display text-sm py-2.5 border ${muted ? "bg-amber-500/20 border-amber-500/50 text-amber-300" : "border-line text-foreground hover:border-brand/50"}`}>
                  {muted ? "Unmute" : "Mute"}
                </button>
                <button type="button" onClick={hangUp} className="flex-1 display text-sm py-2.5 bg-red-500 hover:bg-red-600 text-white">
                  Hang up
                </button>
              </div>
            ) : (
              <button type="button" onClick={dial} disabled={!number.trim()} className="w-full display text-sm py-2.5 bg-brand hover:bg-brand-dark text-on-brand disabled:opacity-50">
                Call
              </button>
            )}
          </div>
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
