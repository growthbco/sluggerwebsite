"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";

type Preset = { key: string; label: string; priceCents: number };

const money = (c: number) => `$${(c / 100).toFixed(0)}`;

/** Admin: open a standalone team store (no design request needed) - repeat
 *  customers, hat-only orders, anything where a link is all they need. */
export function AdminNewStore({ presets }: { presets: Preset[] }) {
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [localPricing, setLocalPricing] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const imgRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function toggleKey(k: string) {
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  async function uploadImage() {
    const file = imgRef.current?.files?.[0];
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const blob = await upload(`team-logos/${file.name}`, file, {
        access: "public",
        handleUploadUrl: "/api/design-request/upload",
      });
      setImageUrl(blob.url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/team-store/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, itemKeys: Array.from(picked), localPricing, imageUrl: imageUrl || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create");
      setResult(data.storeUrl);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div className="mt-3 bg-steel border border-brand/40 p-4">
        <p className="display text-sm text-foreground">✓ Store created - send this link:</p>
        <div className="mt-2 flex gap-2">
          <input readOnly value={result} className="flex-1 bg-ink border border-line px-3 py-2 text-xs text-foreground/80" />
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(result);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="clip-slant bg-brand text-on-brand display text-sm px-4 py-2 hover:bg-brand-dark"
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            setResult(null);
            setName("");
            setPicked(new Set());
            setImageUrl("");
          }}
          className="mt-3 text-xs display text-muted border border-line px-3 py-1.5 hover:border-brand/50"
        >
          Create another
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 bg-steel border border-line p-4">
      <p className="text-sm text-muted">
        For repeat customers or simple orders (like hat-only teams): make a store, send the link,
        they pick sizes and pay by card. No design request needed.
      </p>
      <div className="mt-3 flex flex-wrap gap-2 items-center">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Team name (e.g. Triboro Troopers 8U)"
          maxLength={80}
          className="flex-1 min-w-48 bg-ink border border-line px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
        />
        <button
          type="button"
          onClick={() => imgRef.current?.click()}
          disabled={busy}
          className="text-xs display text-foreground border border-line px-3 py-2 hover:border-brand/50 disabled:opacity-50"
        >
          {imageUrl ? "✓ Photo added" : "📷 Product photo (optional)"}
        </button>
        <input ref={imgRef} type="file" accept="image/*" className="hidden" onChange={uploadImage} />
      </div>
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {presets.map((p) => (
          <label key={p.key} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={picked.has(p.key)}
              onChange={() => toggleKey(p.key)}
              className="accent-[color:var(--brand-gold)]"
            />
            {p.label} <span className="text-muted">({money(p.priceCents)})</span>
          </label>
        ))}
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={localPricing}
          onChange={(e) => setLocalPricing(e.target.checked)}
          className="accent-[color:var(--brand-gold)]"
        />
        <span className="text-foreground">
          Ocala league team <span className="text-muted">($25 round-neck jerseys)</span>
        </span>
      </label>
      <button
        type="button"
        onClick={create}
        disabled={busy || picked.size === 0 || name.trim().length < 2}
        className="mt-3 clip-slant bg-brand text-on-brand display text-sm px-5 py-2.5 hover:bg-brand-dark disabled:opacity-50"
      >
        {busy ? "Working..." : "Create Store"}
      </button>
      {error && <p className="mt-2 text-sm text-brand">{error}</p>}
    </div>
  );
}
