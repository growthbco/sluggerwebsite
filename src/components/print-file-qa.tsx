"use client";

import { useState } from "react";
import Image from "next/image";
import { upload } from "@vercel/blob/client";

type Mismatch = {
  kind: "missing" | "extra" | "wrong_size" | "wrong_number" | "name_typo";
  roster?: { name?: string; number?: string; size?: string };
  printed?: { name?: string; number?: string; size?: string };
  detail: string;
};

type VerifyResult = {
  ok: boolean;
  summary: string;
  extracted: { name: string; number: string; size: string }[];
  mismatches: Mismatch[];
  verifiedAt: string;
  model: string;
};

type RosterEntry = { name: string; number: string; size: string };

type Props = {
  token: string; // team order manage token
  rosterCount: number;
  roster?: RosterEntry[];
  initialPrintFileUrls?: string[] | null;
  initialResult?: VerifyResult | null;
};

const KIND_LABEL: Record<Mismatch["kind"], string> = {
  missing: "Missing from print",
  extra: "Extra on print",
  wrong_size: "Wrong size",
  wrong_number: "Wrong number",
  name_typo: "Name typo",
};

export function PrintFileQA({ token, rosterCount, roster = [], initialPrintFileUrls, initialResult }: Props) {
  const [printFileUrls, setPrintFileUrls] = useState<string[]>(initialPrintFileUrls ?? []);
  const [status, setStatus] = useState<"idle" | "uploading" | "verifying" | "done" | "error">(
    initialResult ? "done" : "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerifyResult | null>(initialResult ?? null);

  // Upload one or more sheets; each is appended to the list.
  async function onFilesChange(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setStatus("uploading");
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files).slice(0, 10)) {
        const blob = await upload(`print-files/${Date.now()}-${file.name}`, file, {
          access: "public",
          handleUploadUrl: "/api/design-request/upload",
        });
        uploaded.push(blob.url);
      }
      setPrintFileUrls((prev) => [...prev, ...uploaded].slice(0, 10));
      setStatus("idle");
    } catch (e) {
      setError((e as Error).message);
      setStatus("error");
    }
  }

  function removeFile(url: string) {
    setPrintFileUrls((prev) => prev.filter((u) => u !== url));
  }

  async function verify() {
    if (printFileUrls.length === 0) return;
    setError(null);
    setStatus("verifying");
    try {
      const res = await fetch(`/api/team-order/${token}/verify-print-file`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ printFileUrls }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");
      setResult(data.result);
      setStatus("done");
    } catch (e) {
      setError((e as Error).message);
      setStatus("error");
    }
  }

  return (
    <section className="bg-steel border border-line p-5 space-y-4">
      <header>
        <h2 className="display text-lg text-foreground">Print File QA</h2>
        <p className="text-sm text-muted mt-1">
          Upload the print-file layout. Our AI reads every jersey on it and cross-checks it against
          the submitted roster — so typos, wrong sizes, or missing players get flagged before
          production. The submitted roster is below so you can also eyeball it yourself.
        </p>
      </header>

      {/* Side-by-side compare: what the coach submitted vs what's on the print
          file, so staff can double-check the AI (or catch anything it misses). */}
      <div className="grid sm:grid-cols-2 gap-4">
        <RosterTable title={`Submitted roster (${roster.length})`} rows={roster} emptyText="No roster on file." />
        <RosterTable
          title={result ? `On the print file (${result.extracted.length})` : "On the print file"}
          rows={result?.extracted ?? []}
          emptyText="Upload + verify to read the print file."
        />
      </div>

      {/* Upload + preview. Multiple sheets allowed - a print file can span
          two, three, or four files. */}
      <div className="flex flex-col sm:flex-row gap-4">
        <label className="flex-1 cursor-pointer">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            multiple
            className="hidden"
            disabled={status === "uploading" || status === "verifying"}
            onChange={(e) => onFilesChange(e.target.files)}
          />
          <span className="block bg-ink border border-line px-3 py-2.5 text-sm text-foreground/80 text-center hover:bg-ink/80">
            {status === "uploading"
              ? "Uploading…"
              : printFileUrls.length
              ? "Add another sheet"
              : "Upload print file(s)"}
          </span>
        </label>
        <button
          onClick={verify}
          disabled={printFileUrls.length === 0 || status === "verifying" || status === "uploading"}
          className="clip-slant bg-brand text-on-brand display text-sm px-5 py-2.5 hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === "verifying"
            ? "Verifying…"
            : result
            ? "Re-verify"
            : `Verify${printFileUrls.length > 1 ? ` ${printFileUrls.length} sheets` : ""}`}
        </button>
      </div>

      {printFileUrls.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-3">
          {printFileUrls.map((url, i) => (
            <div key={url} className="relative aspect-[16/9] bg-black/10 border border-line">
              <Image
                src={url}
                alt={`Print file sheet ${i + 1}`}
                fill
                sizes="(max-width: 768px) 100vw, 360px"
                className="object-contain"
                unoptimized
              />
              <span className="absolute top-1 left-1 text-[10px] bg-ink/80 text-foreground px-1.5 py-0.5">
                Sheet {i + 1}
              </span>
              <button
                type="button"
                onClick={() => removeFile(url)}
                disabled={status === "verifying" || status === "uploading"}
                className="absolute top-1 right-1 text-xs bg-ink/80 text-muted hover:text-brand px-1.5 py-0.5"
                aria-label={`Remove sheet ${i + 1}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-400">⚠ {error}</p>}

      {/* Result */}
      {result && (
        <div
          className={`rounded border p-4 ${
            result.ok ? "border-green-500/40 bg-green-500/5" : "border-amber-500/40 bg-amber-500/5"
          }`}
        >
          <p className="display text-foreground">
            {result.ok ? "✅ " : "⚠️ "}{result.summary}
          </p>
          <p className="text-xs text-muted mt-1">
            Verified {new Date(result.verifiedAt).toLocaleString()}
          </p>

          {result.mismatches.length > 0 && (
            <ul className="mt-3 space-y-2">
              {result.mismatches.map((m, i) => (
                <li key={i} className="text-sm border-l-2 border-amber-500/60 pl-3">
                  <span className="display text-xs uppercase tracking-wider text-amber-300">
                    {KIND_LABEL[m.kind]}
                  </span>
                  <p className="text-foreground/90">{m.detail}</p>
                </li>
              ))}
            </ul>
          )}

          <p className="text-xs text-muted mt-3">
            Full comparison is in the two tables above (submitted roster vs. print file).
          </p>
        </div>
      )}
    </section>
  );
}

function RosterTable({ title, rows, emptyText }: { title: string; rows: RosterEntry[]; emptyText: string }) {
  return (
    <div className="border border-line">
      <p className="display text-xs text-foreground bg-ink px-3 py-2 border-b border-line">{title}</p>
      {rows.length === 0 ? (
        <p className="text-xs text-muted px-3 py-3">{emptyText}</p>
      ) : (
        <div className="max-h-72 overflow-y-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted sticky top-0 bg-steel">
                <th className="px-3 py-1.5">Name</th>
                <th className="px-3 py-1.5">#</th>
                <th className="px-3 py-1.5">Size</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-line/50">
                  <td className="px-3 py-1.5 text-foreground uppercase">{r.name || "-"}</td>
                  <td className="px-3 py-1.5 text-muted">{r.number || "-"}</td>
                  <td className="px-3 py-1.5 text-muted">{r.size || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
