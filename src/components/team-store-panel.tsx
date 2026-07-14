"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";

type Preset = { key: string; label: string; priceCents: number };

type StoreInfo = {
  url: string;
  active: boolean;
  itemLabels: string[];
  slug?: string;
  color?: string | null;
  logoUrl?: string | null;
};

const money = (c: number) => `$${(c / 100).toFixed(0)}`;

/** Staff controls on the design manage page: open a per-person team store
 *  from the approved design, share its link, and open/close it. */
export function TeamStorePanel({
  manageToken,
  presets,
  initialStore,
}: {
  manageToken: string;
  presets: Preset[];
  initialStore: StoreInfo | null;
}) {
  const [store, setStore] = useState<StoreInfo | null>(initialStore);
  // Appearance controls (URL / color / logo)
  const [slugDraft, setSlugDraft] = useState(initialStore?.slug ?? "");
  const [colorDraft, setColorDraft] = useState(initialStore?.color ?? "#b8a36c");
  const logoRef = useRef<HTMLInputElement>(null);
  const [appearanceBusy, setAppearanceBusy] = useState(false);
  const [appearanceMsg, setAppearanceMsg] = useState("");

  async function saveAppearance(extra: { logoUrl?: string | null } = {}) {
    setAppearanceBusy(true);
    setAppearanceMsg("");
    try {
      const res = await fetch("/api/team-store/customize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manageToken, slug: slugDraft || undefined, color: colorDraft, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save");
      setStore((s) => (s ? { ...s, url: data.storeUrl, slug: slugDraft, color: colorDraft, ...(extra.logoUrl !== undefined ? { logoUrl: extra.logoUrl } : {}) } : s));
      setAppearanceMsg("Saved ✓");
      setTimeout(() => setAppearanceMsg(""), 2500);
    } catch (e) {
      setAppearanceMsg((e as Error).message);
    } finally {
      setAppearanceBusy(false);
    }
  }

  async function uploadLogo() {
    const file = logoRef.current?.files?.[0];
    if (!file) return;
    setAppearanceBusy(true);
    setAppearanceMsg("Uploading logo...");
    try {
      const blob = await upload(`team-logos/${file.name}`, file, {
        access: "public",
        handleUploadUrl: "/api/design-request/upload",
      });
      await saveAppearance({ logoUrl: blob.url });
    } catch (e) {
      setAppearanceMsg((e as Error).message);
      setAppearanceBusy(false);
    }
  }
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  function toggleKey(k: string) {
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  async function create() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/team-store/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manageToken, itemKeys: Array.from(picked) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create the store");
      setStore({
        url: data.storeUrl,
        active: data.active,
        itemLabels: (data.items ?? []).map((i: { label: string }) => i.label),
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function setActive(active: boolean) {
    if (!store) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/team-store/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manageToken, active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update the store");
      setStore({ ...store, active });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!store) return;
    try {
      await navigator.clipboard.writeText(store.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <section>
      <h2 className="display text-xl text-foreground">Team store</h2>
      {store ? (
        <div className="mt-3 bg-steel border border-line p-4 space-y-3">
          <p className="text-sm text-muted">
            Share this link - each player/parent buys their own gear and pays by card.
            Selling: {store.itemLabels.join(", ") || "configured items"}.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="text-xs text-foreground bg-ink border border-line px-3 py-2 break-all">{store.url}</code>
            <button
              type="button"
              onClick={copy}
              className="text-xs display text-foreground border border-line px-3 py-2 hover:border-brand/50"
            >
              {copied ? "Copied!" : "Copy link"}
            </button>
            <span
              className={`text-xs display px-3 py-2 ${
                store.active ? "bg-brand/10 border border-brand/40 text-foreground" : "border border-line text-muted"
              }`}
            >
              {store.active ? "OPEN" : "CLOSED"}
            </span>
            <button
              type="button"
              onClick={() => setActive(!store.active)}
              disabled={busy}
              className="text-xs display text-foreground border border-line px-3 py-2 hover:border-brand/50 disabled:opacity-50"
            >
              {store.active ? "Close store" : "Reopen store"}
            </button>
          </div>

          {/* Appearance: friendly URL, team color, logo */}
          <div className="pt-3 border-t border-line">
            <p className="text-sm text-foreground display">Make it theirs (optional)</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted">…/store/</span>
              <input
                value={slugDraft}
                onChange={(e) => setSlugDraft(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                placeholder="rookies"
                maxLength={60}
                className="w-40 bg-ink border border-line px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
                aria-label="Custom store URL"
              />
              <label className="flex items-center gap-1.5 text-xs text-muted">
                Team color
                <input
                  type="color"
                  value={colorDraft || "#b8a36c"}
                  onChange={(e) => setColorDraft(e.target.value)}
                  className="h-8 w-10 bg-ink border border-line cursor-pointer"
                  aria-label="Team color"
                />
              </label>
              <button
                type="button"
                onClick={() => logoRef.current?.click()}
                disabled={appearanceBusy}
                className="text-xs display text-foreground border border-line px-3 py-2 hover:border-brand/50 disabled:opacity-50"
              >
                {store.logoUrl ? "Replace logo" : "Add logo"}
              </button>
              <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={uploadLogo} />
              <button
                type="button"
                onClick={() => saveAppearance()}
                disabled={appearanceBusy}
                className="clip-slant bg-brand text-on-brand display text-xs px-4 py-2 hover:bg-brand-dark disabled:opacity-50"
              >
                {appearanceBusy ? "Saving..." : "Save look"}
              </button>
            </div>
            <p className="mt-1.5 text-xs text-muted">
              Custom URL is easier to share ("sluggerathletics.com/store/rookies"); the color themes
              the store's buttons and accents; the logo shows at the top of the store.
              {appearanceMsg && <span className="ml-2 text-brand">{appearanceMsg}</span>}
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-3 bg-steel border border-line p-4">
          <p className="text-sm text-foreground">
            <strong>What's a team store?</strong>{" "}
            <span className="text-muted">
              A private shop page for this team, built from their approved design. Each player or
              parent opens the link, picks their gear and size, adds their name and number, and{" "}
              <strong className="text-foreground">pays Slugger directly by card</strong> - no
              collecting sizes or money by hand.
            </span>
          </p>
          <p className="mt-2 text-sm text-muted">
            <strong className="text-foreground">When to use it:</strong> people buy individually or
            join over time (rec teams, fan gear, fundraisers).{" "}
            <strong className="text-foreground">When NOT to:</strong> one coach pays for the whole
            team at once - use the roster + invoice flow instead.
          </p>
          <p className="mt-3 text-sm text-foreground display">1. Check what this team can buy:</p>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {presets.map((p) => (
              <label key={p.key} className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={picked.has(p.key)}
                  onChange={() => toggleKey(p.key)}
                  className="accent-[color:var(--color-brand)]"
                />
                {p.label} <span className="text-muted">({money(p.priceCents)})</span>
              </label>
            ))}
          </div>
          <p className="mt-3 text-sm text-foreground display">2. Open the store and share the link with the coach:</p>
          <button
            type="button"
            onClick={create}
            disabled={busy || picked.size === 0}
            className="mt-2 clip-slant bg-brand text-on-brand display px-6 py-3 hover:bg-brand-dark disabled:opacity-50"
          >
            {busy ? "Creating..." : "Open Team Store"}
          </button>
          <p className="mt-3 text-xs text-muted">
            Every purchase pays by card on the spot, emails the buyer a receipt, posts to Discord
            under this team, and shows up (with revenue) on the staff dashboard. Buyers pick live-rate
            shipping or free Ocala pickup. You can close or reopen the store anytime.
          </p>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-brand">{error}</p>}
    </section>
  );
}
