"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";

type Design = { label: string; image: string };
type Item = { key: string; label: string; image?: string | null; designs: Design[] };

/** Manage the color/photo options parents pick from on a store item. Staff can
 *  upload a new colorway photo, rename it, reorder, or remove one - no code
 *  change needed to add (e.g.) a second Halloween jersey. */
export function AdminStoreDesigns({ teamId, items }: { teamId: string; items: Item[] }) {
  if (items.length === 0) return <p className="text-xs text-muted">This store has no items yet.</p>;
  return (
    <div className="space-y-4">
      {items.map((it) => (
        <ItemEditor key={it.key} teamId={teamId} item={it} />
      ))}
    </div>
  );
}

function ItemEditor({ teamId, item }: { teamId: string; item: Item }) {
  const router = useRouter();
  const [designs, setDesigns] = useState<Design[]>(item.designs.map((d) => ({ ...d })));
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const dirty =
    designs.length !== item.designs.length ||
    designs.some((d, i) => d.label !== item.designs[i]?.label || d.image !== item.designs[i]?.image);

  function patch(i: number, next: Partial<Design>) {
    setSaved(false);
    setDesigns((cur) => cur.map((d, j) => (j === i ? { ...d, ...next } : d)));
  }
  function remove(i: number) {
    setSaved(false);
    setDesigns((cur) => cur.filter((_, j) => j !== i));
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= designs.length) return;
    setSaved(false);
    setDesigns((cur) => {
      const next = [...cur];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  async function addPhoto(file: File) {
    setUploading(true);
    setError("");
    try {
      const blob = await upload(`store-designs/${Date.now()}-${file.name}`, file, {
        access: "public",
        handleUploadUrl: "/api/design-request/upload",
      });
      const guess = file.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim();
      setSaved(false);
      setDesigns((cur) => [...cur, { label: guess || `Option ${cur.length + 1}`, image: blob.url }]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/admin/store/designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, itemKey: item.key, designs }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border border-line bg-background/40 p-3">
      <p className="display text-sm text-foreground">{item.label}</p>
      <p className="text-xs text-muted mt-0.5">{designs.length} color option{designs.length === 1 ? "" : "s"} parents can choose from</p>

      <ul className="mt-2.5 space-y-2">
        {designs.map((d, i) => (
          <li key={i} className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={d.image} alt={d.label} className="h-14 w-14 object-cover border border-line bg-steel shrink-0" />
            <input
              value={d.label}
              onChange={(e) => patch(i, { label: e.target.value })}
              placeholder="Color name (e.g. Bone White)"
              className="flex-1 min-w-0 bg-ink border border-line px-2 py-1.5 text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
            />
            <span className="flex items-center gap-1 shrink-0">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="text-sm text-muted hover:text-foreground disabled:opacity-30 px-2 py-1.5" title="Move up">↑</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === designs.length - 1} className="text-sm text-muted hover:text-foreground disabled:opacity-30 px-2 py-1.5" title="Move down">↓</button>
              <button type="button" onClick={() => remove(i)} className="text-sm display text-red-400/80 border border-red-500/40 px-2 py-1 hover:bg-red-500/10" title="Remove">✕</button>
            </span>
          </li>
        ))}
        {designs.length === 0 && <li className="text-xs text-muted">No color options - the item shows its default photo only.</li>}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className={`text-xs display border border-brand/50 text-brand px-2.5 py-1.5 cursor-pointer hover:bg-brand/10 ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
          {uploading ? "Uploading…" : "＋ Add color photo"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) addPhoto(f);
              e.target.value = "";
            }}
          />
        </label>
        <button
          type="button"
          onClick={save}
          disabled={busy || !dirty}
          className="text-xs display bg-brand text-on-brand px-3 py-1.5 hover:bg-brand-dark disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        {saved && !dirty && <span className="text-xs text-green-400 display">✓ Saved &amp; live</span>}
      </div>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}
