"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";

export type CallRow = {
  sid: string;
  direction: "inbound" | "outbound";
  name: string | null;
  phone: string | null; // formatted display phone, null when not a real number
  digits: string | null; // last-10 digits for call-back / deep links
  isSoftphone: boolean; // browser-line leg (client:owner etc.)
  time: string | null; // ISO
  durationSec: number;
  answered: boolean;
  statusLabel: string;
  recordingSid: string | null;
  recordingSec: number | null;
  threadExists: boolean;
};

type Filter = "all" | "missed" | "answered";

const fmtDur = (sec: number) => {
  if (!sec || sec < 0) return "0:00";
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
};
const fmtTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";

/** Dark/gold audio player for a call recording. Shows the REAL call duration
 *  (passed in from the call record) as the total, so it never sits at
 *  0:00 / 0:00 the way the native control does with Twilio's MP3s. Loads the
 *  media lazily (only on first play). */
function CallPlayer({ src, totalSec }: { src: string; totalSec: number }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  // Prefer the browser's real duration once known, else the call's known length.
  const [realDur, setRealDur] = useState<number | null>(null);
  const total = realDur && realDur > 0 && Number.isFinite(realDur) ? realDur : totalSec;
  const pct = total > 0 ? Math.min(100, (cur / total) * 100) : 0;

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (!loaded) { a.src = src; setLoaded(true); }
    if (a.paused) { a.play(); setPlaying(true); } else { a.pause(); setPlaying(false); }
  }
  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const a = audioRef.current;
    if (!a || total <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (!loaded) { a.src = src; setLoaded(true); }
    a.currentTime = frac * total;
    setCur(frac * total);
  }

  return (
    <div className="mt-3 flex items-center gap-3 rounded-lg border border-line bg-background/60 px-3 py-2">
      <audio
        ref={audioRef}
        preload="none"
        onTimeUpdate={(e) => setCur(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => { const d = e.currentTarget.duration; if (Number.isFinite(d) && d > 0) setRealDur(d); }}
        onEnded={() => { setPlaying(false); setCur(0); }}
        className="hidden"
      />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause" : "Play"}
        className="grid place-items-center h-11 w-11 shrink-0 rounded-full bg-brand text-on-brand hover:bg-brand-dark"
      >
        {playing ? (
          <span className="flex gap-[3px]"><span className="block w-[3px] h-4 bg-current" /><span className="block w-[3px] h-4 bg-current" /></span>
        ) : (
          <span className="ml-0.5 block h-0 w-0 border-y-[7px] border-y-transparent border-l-[12px] border-l-current" />
        )}
      </button>
      <div
        onClick={seek}
        className="relative flex-1 h-2 rounded-full bg-line/60 cursor-pointer"
        role="slider"
        aria-label="Seek"
        aria-valuenow={Math.round(cur)}
        aria-valuemax={Math.round(total)}
        tabIndex={0}
      >
        <span className="absolute inset-y-0 left-0 rounded-full bg-brand" style={{ width: `${pct}%` }} />
        <span className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-brand shadow" style={{ left: `calc(${pct}% - 6px)` }} />
      </div>
      <span className="shrink-0 tabular-nums text-xs text-muted w-[74px] text-right">
        {fmtDur(cur)} / {fmtDur(total)}
      </span>
    </div>
  );
}

function DirBadge({ dir }: { dir: "inbound" | "outbound" }) {
  return (
    <span
      className={`grid place-items-center h-8 w-8 shrink-0 rounded-full border text-sm ${dir === "inbound" ? "border-brand/40 bg-brand/10 text-brand" : "border-line text-muted"}`}
      title={dir === "inbound" ? "Incoming" : "Outgoing"}
    >
      {dir === "inbound" ? "↙" : "↗"}
    </span>
  );
}

function StatusPill({ label }: { label: string }) {
  const good = label === "Answered";
  return (
    <span className={`text-[11px] display px-2 py-0.5 rounded-full border whitespace-nowrap ${good ? "border-green-500/40 bg-green-500/10 text-green-300" : "border-amber-500/40 bg-amber-500/10 text-amber-300"}`}>
      {label}
    </span>
  );
}

export function AdminCallsList({ calls }: { calls: CallRow[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  const missedCount = calls.filter((c) => c.statusLabel !== "Answered").length;
  const answeredCount = calls.length - missedCount;

  const q = search.trim().toLowerCase();
  const visible = useMemo(
    () =>
      calls.filter((c) => {
        if (filter === "missed" && c.statusLabel === "Answered") return false;
        if (filter === "answered" && c.statusLabel !== "Answered") return false;
        if (q && !(`${c.name ?? ""} ${c.phone ?? ""} ${c.digits ?? ""}`.toLowerCase().includes(q))) return false;
        return true;
      }),
    [calls, filter, q],
  );

  const chip = (f: Filter, label: string) => (
    <button
      type="button"
      onClick={() => setFilter(f)}
      className={`text-xs display px-3 min-h-[44px] sm:min-h-0 sm:py-1.5 inline-flex items-center border ${filter === f ? "bg-brand text-on-brand border-brand" : "border-line text-muted hover:text-foreground hover:border-brand/40"}`}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or number…"
          className="w-full sm:max-w-xs min-w-0 bg-background border border-line px-3 py-2 text-base sm:text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
        />
        <div className="flex flex-wrap gap-1.5">
          {chip("all", `All · ${calls.length}`)}
          {chip("missed", missedCount ? `Missed · ${missedCount}` : "Missed")}
          {chip("answered", answeredCount ? `Answered · ${answeredCount}` : "Answered")}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="text-muted">{calls.length === 0 ? "No calls yet." : "Nothing matches this view."}</p>
      ) : (
        <ul className="space-y-3">
          {visible.map((c) => (
            <li key={c.sid} className="rounded-xl border border-line bg-foreground/[0.02] p-4 min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
                <DirBadge dir={c.direction} />
                <div className="min-w-0 flex-1">
                  <p className="text-foreground display leading-tight truncate">
                    {c.isSoftphone ? "Slugger softphone" : c.name || c.phone || "Unknown"}
                    <span className="text-muted display text-xs ml-2 font-normal">
                      {c.isSoftphone ? "browser line" : c.direction === "inbound" ? "called in" : "we called"}
                    </span>
                  </p>
                  {!c.isSoftphone && c.name && c.phone && <p className="text-xs text-muted truncate">{c.phone}</p>}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted whitespace-nowrap">
                  <span>{fmtTime(c.time)}</span>
                  <span className="tabular-nums">{fmtDur(c.durationSec)}</span>
                  <StatusPill label={c.statusLabel} />
                </div>
              </div>

              {c.recordingSid ? (
                <CallPlayer src={`/api/admin/calls/recording/${c.recordingSid}`} totalSec={c.recordingSec || c.durationSec} />
              ) : c.answered ? (
                <p className="mt-2 text-xs text-muted">No recording captured for this call.</p>
              ) : null}

              {!c.isSoftphone && c.digits && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => window.dispatchEvent(new CustomEvent("slugger-dial", { detail: { phone: c.digits } }))}
                    className="display text-xs text-brand border border-brand/50 px-3 py-2 inline-flex items-center gap-1.5 hover:bg-brand/10"
                  >
                    📞 Call back
                  </button>
                  {c.threadExists && (
                    <Link
                      href={`/admin/texts?to=${c.digits}${c.name ? `&name=${encodeURIComponent(c.name)}` : ""}`}
                      className="display text-xs text-muted border border-line px-3 py-2 inline-flex items-center gap-1.5 hover:border-brand/50 hover:text-foreground"
                    >
                      💬 Messages
                    </Link>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
