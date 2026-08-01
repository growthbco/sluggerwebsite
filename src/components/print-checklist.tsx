"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";

type Jersey = { id: string; name: string; number: string; size: string; color: string; verifiedAt: string | null; sheet: string | null };
type Mismatch = { kind: string; detail: string };
type VerifyResult = { ok: boolean; summary: string; extracted: { name: string; number: string; size: string }[]; mismatches: Mismatch[] };

/** Per-jersey print-file QA: every jersey is a line with its own ✓. Select the
 *  jerseys on a sheet, upload it, and verify just those - already-verified ones
 *  stay verified and aren't re-checked. */
export function PrintChecklist({ token, jerseys }: { token: string; jerseys: Jersey[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [urls, setUrls] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "uploading" | "verifying">("idle");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState("");

  const verifiedCount = jerseys.filter((j) => j.verifiedAt).length;
  const groups = useMemo(() => {
    const m = new Map<string, Jersey[]>();
    for (const j of jerseys) {
      const k = j.color || "Design";
      m.set(k, [...(m.get(k) ?? []), j]);
    }
    return [...m.entries()];
  }, [jerseys]);

  function toggle(id: string) {
    setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function selectUnverified() {
    setSelected(new Set(jerseys.filter((j) => !j.verifiedAt).map((j) => j.id)));
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(""); setStatus("uploading");
    try {
      const up: string[] = [];
      for (const f of Array.from(files).slice(0, 10)) {
        const b = await upload(`print-files/${Date.now()}-${f.name}`, f, { access: "public", handleUploadUrl: "/api/design-request/upload" });
        up.push(b.url);
      }
      setUrls((p) => [...p, ...up].slice(0, 10));
    } catch (e) { setError((e as Error).message); }
    finally { setStatus("idle"); }
  }

  async function verify() {
    if (urls.length === 0) { setError("Upload the print sheet first."); return; }
    if (selected.size === 0) { setError("Check the jerseys that are on this sheet."); return; }
    setError(""); setStatus("verifying"); setResult(null);
    try {
      const res = await fetch(`/api/team-order/${token}/verify-rows`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowIds: [...selected], printFileUrls: urls }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Verification failed");
      setResult(d.result);
      if (d.result?.ok) { setSelected(new Set()); setUrls([]); router.refresh(); }
    } catch (e) { setError((e as Error).message); }
    finally { setStatus("idle"); }
  }

  return (
    <section className="bg-steel border border-line p-5 space-y-4">
      <header>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="display text-lg text-foreground">Print file QA - by jersey</h2>
          <span className="text-sm text-muted">{verifiedCount} of {jerseys.length} verified</span>
        </div>
        <p className="text-sm text-muted mt-1">
          Check the jerseys that are on the sheet you&apos;re uploading, then verify. Already-verified jerseys keep their ✓ and aren&apos;t re-checked - so new pieces are just the ones still unchecked.
        </p>
      </header>

      <div className="space-y-3">
        {groups.map(([color, list]) => (
          <div key={color} className="border border-line">
            <p className="display text-xs text-foreground bg-ink px-3 py-2 border-b border-line">{color} ({list.length})</p>
            <ul>
              {list.map((j) => (
                <li key={j.id} className="flex items-center gap-3 px-3 py-2 border-t border-line/50 first:border-t-0">
                  <input type="checkbox" checked={selected.has(j.id)} onChange={() => toggle(j.id)} className="accent-[color:var(--brand-gold)]" />
                  <span className="flex-1 text-sm text-foreground uppercase">{j.name || "-"} <span className="text-muted normal-case">#{j.number || "-"} · {j.size || "-"}</span></span>
                  {j.verifiedAt ? (
                    <span className="text-xs display text-emerald-400 border border-emerald-400/40 px-2 py-0.5 rounded whitespace-nowrap">✓ Verified</span>
                  ) : (
                    <span className="text-xs text-muted whitespace-nowrap">not verified</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={selectUnverified} className="text-xs display text-brand border border-brand/40 px-3 py-1.5 hover:bg-brand/10">Select all unverified</button>
        {selected.size > 0 && <button type="button" onClick={() => setSelected(new Set())} className="text-xs display text-muted border border-line px-3 py-1.5 hover:text-foreground">Clear ({selected.size})</button>}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <label className="flex-1 cursor-pointer">
          <input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" multiple className="hidden" disabled={status !== "idle"} onChange={(e) => onFiles(e.target.files)} />
          <span className="block bg-ink border border-line px-3 py-2.5 text-sm text-foreground/80 text-center hover:bg-ink/80">
            {status === "uploading" ? "Uploading…" : urls.length ? `${urls.length} sheet${urls.length === 1 ? "" : "s"} ready - add another` : "Upload print sheet(s)"}
          </span>
        </label>
        <button type="button" onClick={verify} disabled={status !== "idle" || urls.length === 0 || selected.size === 0}
          className="clip-slant bg-brand text-on-brand display text-sm px-5 py-2.5 hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed">
          {status === "verifying" ? "Verifying…" : `Verify ${selected.size || ""} selected`.trim()}
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {result && (
        <div className={`border p-4 ${result.ok ? "border-emerald-400/40 bg-emerald-400/5" : "border-amber-400/40 bg-amber-400/5"}`}>
          <p className={`display ${result.ok ? "text-emerald-400" : "text-amber-400"}`}>{result.ok ? "✅ " : "⚠️ "}{result.summary}</p>
          {!result.ok && result.mismatches.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm text-muted">
              {result.mismatches.slice(0, 12).map((m, i) => (<li key={i}><span className="text-amber-400 uppercase text-xs">{m.kind.replace("_", " ")}</span> - {m.detail}</li>))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
