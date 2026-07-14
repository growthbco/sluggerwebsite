"use client";

import { useRef, useState } from "react";
import { sizesFor, itemLabel } from "@/lib/order-items";

export type ImportedRow = {
  name: string;
  number: string;
  sizes: Record<string, string>;
  notes?: string;
};

/** AI roster import: paste text or add a photo, review the parsed rows, then
 *  confirm. The AI only fills the preview - the coach always approves. */
export function RosterImport({
  itemKeys,
  onConfirm,
  confirmLabel,
}: {
  itemKeys: string[];
  onConfirm: (rows: ImportedRow[]) => Promise<void> | void;
  confirmLabel?: string;
}) {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ImportedRow[] | null>(null);
  const [busy, setBusy] = useState<"" | "parsing" | "saving">("");
  const [error, setError] = useState("");

  async function parse() {
    setBusy("parsing");
    setError("");
    try {
      const form = new FormData();
      form.set("text", text);
      form.set("items", JSON.stringify(itemKeys));
      const file = fileRef.current?.files?.[0];
      if (file) form.set("image", file);
      const res = await fetch("/api/roster/parse", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not read the roster");
      setPreview(data.rows);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  function update(i: number, patch: Partial<ImportedRow>) {
    setPreview((p) => (p ? p.map((r, j) => (j === i ? { ...r, ...patch } : r)) : p));
  }
  function updateSize(i: number, key: string, value: string) {
    setPreview((p) =>
      p ? p.map((r, j) => (j === i ? { ...r, sizes: { ...r.sizes, [key]: value } } : r)) : p,
    );
  }

  async function confirm() {
    if (!preview?.length) return;
    setBusy("saving");
    setError("");
    try {
      await onConfirm(preview);
      setPreview(null);
      setText("");
      setFileName("");
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="bg-steel border border-brand/30 p-4">
      <h3 className="display text-foreground">⚡ Quick import with AI</h3>
      <p className="text-sm text-muted mt-1">
        Paste the roster however you got it (text message, spreadsheet, list) or add a photo/screenshot.
        You&apos;ll review every row before anything is added.
      </p>

      {!preview && (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'e.g. "Smith 23 Large, Johnny #7 youth medium, De La Cruz 12 XL..."'}
            className="mt-3 w-full bg-ink border border-line px-3 py-2.5 text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none min-h-20"
            disabled={busy !== ""}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="text-xs display text-foreground border border-line px-3 py-2 hover:border-brand/50"
              disabled={busy !== ""}
            >
              {fileName ? `📷 ${fileName}` : "📷 Add a photo"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
            />
            <button
              type="button"
              onClick={parse}
              disabled={busy !== "" || (!text.trim() && !fileName)}
              className="clip-slant bg-brand text-on-brand display text-sm px-5 py-2 hover:bg-brand-dark disabled:opacity-50"
            >
              {busy === "parsing" ? "Reading..." : "Read Roster"}
            </button>
          </div>
        </>
      )}

      {preview && (
        <div className="mt-3">
          <p className="text-sm text-foreground">
            Found <strong>{preview.length}</strong> player{preview.length === 1 ? "" : "s"} - check every row, fix anything we misread, then confirm.
          </p>
          <div className="mt-3 space-y-2">
            {preview.map((r, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 bg-ink border border-line p-2">
                <span className="text-xs text-muted w-5">{i + 1}</span>
                <input
                  value={r.name}
                  onChange={(e) => update(i, { name: e.target.value })}
                  placeholder="Name"
                  className="flex-1 min-w-28 bg-steel border border-line px-2 py-1.5 text-sm text-foreground"
                />
                <input
                  value={r.number}
                  onChange={(e) => update(i, { number: e.target.value })}
                  placeholder="#"
                  className="w-14 bg-steel border border-line px-2 py-1.5 text-sm text-foreground"
                />
                {itemKeys.map((k) => {
                  const allowed = sizesFor(k);
                  const val = r.sizes[k] ?? "";
                  return (
                    <select
                      key={k}
                      value={val}
                      onChange={(e) => updateSize(i, k, e.target.value)}
                      title={itemLabel(k)}
                      className={`bg-steel border px-2 py-1.5 text-sm ${
                        val && !allowed.includes(val) ? "border-amber-500 text-amber-400" : "border-line text-foreground"
                      }`}
                    >
                      <option value="">{itemLabel(k)}: -</option>
                      {val && !allowed.includes(val) && <option value={val}>⚠ {val}</option>}
                      {allowed.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setPreview((p) => (p ? p.filter((_, j) => j !== i) : p))}
                  className="text-muted hover:text-brand px-1"
                  aria-label={`Remove ${r.name}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={confirm}
              disabled={busy !== "" || preview.length === 0}
              className="clip-slant bg-brand text-on-brand display text-sm px-5 py-2.5 hover:bg-brand-dark disabled:opacity-50"
            >
              {busy === "saving" ? "Adding..." : confirmLabel ?? `Looks right - add ${preview.length} players`}
            </button>
            <button
              type="button"
              onClick={() => setPreview(null)}
              disabled={busy !== ""}
              className="text-xs display text-muted border border-line px-3 py-2 hover:border-brand/50"
            >
              Start over
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-brand">{error}</p>}
    </div>
  );
}
