"use client";

import { useRef, useState } from "react";
import { DropZone, firstImageFile } from "@/components/drop-zone";

type Version = { url: string; cleanUrl?: string; product?: string; note: string; at: string };

const PRODUCTS = [
  { id: "jersey", label: "Jersey" },
  { id: "hat", label: "Hat" },
  { id: "hype-chain", label: "Hype chain" },
  { id: "hoodie", label: "Hoodie" },
  { id: "pants", label: "Pants" },
  { id: "socks", label: "Socks" },
];

// Same jersey cuts the customer picks on the order form.
const JERSEY_STYLES = ["Standard Crew Neck", "V-Neck", "Full Button", "Two Button", "Quarter-Zip"];

type Props = {
  token: string;
  teamName: string;
  latestChangeRequest?: string;
  initialVersions?: Version[];
  /** The client's inspiration uploads - one tap to use as the reference. */
  inspirationImages?: string[];
};

/** Staff-only AI design studio on the designer's manage page. Generate a
 *  mockup from the brief, refine it with change instructions, and every
 *  version is saved to the design request - so anyone on the team can pick up
 *  exactly where the design left off. */
export function AiDesignStudio({ token, teamName, latestChangeRequest, initialVersions = [], inspirationImages = [] }: Props) {
  const [versions, setVersions] = useState<Version[]>(initialVersions);
  const [activeIdx, setActiveIdx] = useState(initialVersions.length - 1);
  const [instruction, setInstruction] = useState(latestChangeRequest ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const [proofLabel, setProofLabel] = useState("");

  // Staff-supplied reference image + colors (optional overrides).
  const [refImage, setRefImage] = useState<string | null>(null);
  const [product, setProduct] = useState<string>("jersey");
  // Jersey cut - "" = whatever the customer's brief says.
  const [jerseyStyle, setJerseyStyle] = useState<string>("");
  const [useColors, setUseColors] = useState(false);
  const [primary, setPrimary] = useState("#1f4fd8");
  const [accent, setAccent] = useState("#d81f1f");
  const fileRef = useRef<HTMLInputElement>(null);

  const active = versions[activeIdx];
  const downloadUrl = active?.cleanUrl ?? active?.url;

  // Which client-inspiration thumbnail is currently the reference (if any).
  const [inspoIdx, setInspoIdx] = useState<number | null>(null);

  // Downscale a data URL to keep the request small; a reference only needs to
  // convey the vibe.
  function downscale(dataUrl: string, done: (out: string) => void) {
    const img = new Image();
    img.onload = () => {
      const max = 1024;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { done(dataUrl); return; }
      ctx.drawImage(img, 0, 0, w, h);
      done(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => done(dataUrl);
    img.src = dataUrl;
  }

  async function onPickFile(file: File) {
    const dataUrl: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
    setInspoIdx(null);
    downscale(dataUrl, setRefImage);
  }

  /** One tap: use one of the client's inspiration uploads as the reference -
   *  no download/re-upload round trip. */
  async function useInspiration(url: string, idx: number) {
    try {
      setError(null);
      const res = await fetch(url);
      const blob = await res.blob();
      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
      downscale(dataUrl, (out) => { setRefImage(out); setInspoIdx(idx); });
    } catch {
      setError("Couldn't load that inspiration image - try downloading it instead.");
    }
  }

  async function run(action: "generate" | "refine") {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch(`/api/design-request/${token}/ai-design`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          instruction,
          // Refine from the CLEAN master so the watermark never gets baked in.
          baseUrl: action === "refine" ? (active?.cleanUrl ?? active?.url) : undefined,
          // Refine keeps the active version's product; generate uses the picker.
          product: action === "refine" ? (active?.product ?? product) : product,
          // Send the uploaded reference on BOTH actions: on refine it becomes
          // the image being edited ("look at this and change X").
          refImage: refImage ?? undefined,
          colors: action === "generate" && useColors ? [primary, accent] : undefined,
          style: action === "generate" && product === "jersey" && jerseyStyle ? jerseyStyle : undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.version) { setError(d.error ?? "Generation failed"); return; }
      setVersions((v) => { const next = [...v, d.version]; setActiveIdx(next.length - 1); return next; });
      setInstruction("");
      if (d.usedFallback) setNote("Made with the backup model (Pro busy) - lettering may be slightly softer.");
    } catch {
      setError("Connection problem - try again");
    } finally {
      setBusy(false);
    }
  }

  async function sendAsProof() {
    if (!active) return;
    setBusy(true); setError(null); setNote(null);
    try {
      const res = await fetch(`/api/design-request/${token}/proof`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: [active.url], labels: proofLabel.trim() ? { [active.url]: proofLabel.trim() } : {} }),
      });
      if (!res.ok) { setError((await res.json()).error ?? "Could not send proof"); return; }
      setProofLabel("");
      setNote("Sent to the customer as a proof - it's in Sent proofs above and pinged the thread.");
    } catch { setError("Could not send proof"); } finally { setBusy(false); }
  }

  const input = "w-full bg-steel border border-line px-3 py-2.5 text-base sm:text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none";

  return (
    <section className="mt-10 border border-brand/40 bg-brand/[0.04] p-5">
      <div className="flex items-center gap-2">
        <span className="display text-brand text-sm">⚡ STAFF</span>
        <h2 className="display text-xl text-foreground">AI Design Studio</h2>
      </div>
      <p className="mt-1 text-sm text-muted">
        Create or revise {teamName}&apos;s mockup with AI. Every version is saved here, so anyone on
        the team can pick up exactly where the design left off.
      </p>

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <div>
          <button
            type="button"
            onClick={() => active && setZoom(active.url)}
            className="relative block aspect-[4/3] w-full bg-white border border-line rounded overflow-hidden grid place-items-center cursor-zoom-in"
            title={active ? "Click to enlarge" : undefined}
          >
            {active ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={active.url} alt="AI mockup" className="h-full w-full object-contain" />
            ) : (
              <span className="text-muted text-sm px-8 text-center">No AI mockup yet - generate one from the brief below.</span>
            )}
            {busy && <span className="absolute inset-0 bg-black/40 grid place-items-center"><span className="display text-white">Working…</span></span>}
          </button>
          {active && (
            <>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
              <button type="button" onClick={() => setZoom(active.url)} className="text-brand underline underline-offset-2">Enlarge</button>
              <a href={downloadUrl} download target="_blank" rel="noopener noreferrer" className="text-brand underline underline-offset-2">Download (clean)</a>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                value={proofLabel}
                onChange={(e) => setProofLabel(e.target.value)}
                placeholder="Label (e.g. Practice Jersey 1)"
                maxLength={60}
                className="flex-1 min-w-[10rem] bg-steel border border-line px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
              />
              <button type="button" onClick={sendAsProof} disabled={busy} className="bg-brand text-on-brand display text-sm px-4 py-2 rounded disabled:opacity-50">
                Send to customer as proof →
              </button>
            </div>
            </>
          )}
          {versions.length > 1 && (
            <div className="mt-3">
              <p className="display text-xs text-muted tracking-wide">VERSION HISTORY</p>
              <div className="mt-1.5 flex gap-2 overflow-x-auto pb-1">
                {versions.map((v, i) => (
                  <button key={i} type="button" onClick={() => setActiveIdx(i)} title={v.note}
                    className={`shrink-0 h-16 w-[5.3rem] bg-white rounded overflow-hidden border-2 ${i === activeIdx ? "border-brand" : "border-line opacity-70 hover:opacity-100"}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={v.url} alt={`v${i + 1}`} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <label className="display text-xs text-muted tracking-wide">
              {active ? "DESCRIBE THE CHANGE (from the customer's request)" : "EXTRA DIRECTION (optional)"}
            </label>
            <textarea value={instruction} onChange={(e) => setInstruction(e.target.value)} rows={4} maxLength={800}
              placeholder={active ? "e.g. make the sleeves red, add pinstripes, bigger number…" : "e.g. horror theme, blood drips, distressed texture…"}
              className={`${input} resize-y`} />
          </div>

          {/* Product type + staff reference + colors - applied to a fresh mockup
              (Generate / Start a fresh mockup). Refine ignores these. */}
          <div className="space-y-3 border border-line rounded p-3 bg-steel/40">
              <div>
                <label className="display text-xs text-muted tracking-wide">PRODUCT {active ? "(for a fresh mockup)" : ""}</label>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {PRODUCTS.map((p) => (
                    <button key={p.id} type="button" onClick={() => setProduct(p.id)}
                      className={`text-sm px-3 py-1.5 rounded border ${product === p.id ? "bg-brand text-on-brand border-brand" : "border-line text-foreground hover:bg-brand/10"}`}>
                      {p.label}
                    </button>
                  ))}
                </div>
                {product === "jersey" && (
                  <div className="mt-2">
                    <label className="display text-xs text-muted tracking-wide">JERSEY CUT</label>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <button type="button" onClick={() => setJerseyStyle("")}
                        className={`text-sm px-3 py-1.5 rounded border ${jerseyStyle === "" ? "bg-brand text-on-brand border-brand" : "border-line text-foreground hover:bg-brand/10"}`}>
                        From the brief
                      </button>
                      {JERSEY_STYLES.map((s) => (
                        <button key={s} type="button" onClick={() => setJerseyStyle(s)}
                          className={`text-sm px-3 py-1.5 rounded border ${jerseyStyle === s ? "bg-brand text-on-brand border-brand" : "border-line text-foreground hover:bg-brand/10"}`}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="display text-xs text-muted tracking-wide">REFERENCE IMAGE (optional)</label>
                <DropZone
                  onFiles={(fs) => { const f = firstImageFile(fs); if (f) onPickFile(f); }}
                  className="mt-1.5 flex items-center gap-3 rounded"
                >
                  {refImage ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={refImage} alt="reference" className="h-14 w-14 object-cover rounded border border-line" />
                      <button type="button" onClick={() => { setRefImage(null); setInspoIdx(null); if (fileRef.current) fileRef.current.value = ""; }} className="text-sm text-brand underline underline-offset-2">Remove</button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => fileRef.current?.click()} className="text-sm border border-brand/70 text-foreground hover:bg-brand/10 px-3 py-1.5 rounded">
                        Upload a reference
                      </button>
                      <span className="text-xs text-muted">or drag &amp; drop an image here</span>
                    </>
                  )}
                  <input ref={fileRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickFile(f); }} />
                </DropZone>
                {inspirationImages.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-muted">…or tap an image the client sent (inspiration + message attachments) to use it directly:</p>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {inspirationImages.filter((u) => !/\.(pdf|ai|eps|svg|zip|mp4|mov)($|\?)/i.test(u)).map((u, i) => (
                        <button
                          key={u}
                          type="button"
                          onClick={() => useInspiration(u, i)}
                          title="Use as the reference image"
                          className={`relative h-14 w-14 rounded overflow-hidden border-2 bg-white ${inspoIdx === i ? "border-brand ring-1 ring-brand" : "border-line hover:border-brand/60"}`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={u} alt={`Client inspiration ${i + 1}`} className="h-full w-full object-cover" />
                          {inspoIdx === i && <span className="absolute inset-0 grid place-items-center bg-brand/30 text-on-brand text-base">✓</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <p className="mt-1 text-xs text-muted">On a fresh mockup: a jersey/sketch to riff on. On Generate revision: a logo/graphic to add to the current design.</p>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input type="checkbox" checked={useColors} onChange={(e) => setUseColors(e.target.checked)} />
                  Set specific colors
                </label>
                {useColors && (
                  <div className="mt-2 flex items-center gap-4 text-sm text-muted">
                    <label className="flex items-center gap-2">Primary
                      <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="h-8 w-10 bg-transparent border border-line rounded" />
                    </label>
                    <label className="flex items-center gap-2">Accent
                      <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-8 w-10 bg-transparent border border-line rounded" />
                    </label>
                  </div>
                )}
              </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {active && (
              <button type="button" onClick={() => run("refine")} disabled={busy || !instruction.trim()}
                className="bg-brand hover:bg-brand-dark text-on-brand display px-5 py-2.5 rounded disabled:opacity-50">
                {busy ? "Working…" : "Generate revision"}
              </button>
            )}
            <button type="button" onClick={() => run("generate")} disabled={busy}
              className={`display px-5 py-2.5 rounded disabled:opacity-50 ${active ? "border border-brand/70 text-foreground hover:bg-brand/10" : "bg-brand hover:bg-brand-dark text-on-brand"}`}>
              {active ? "Start a fresh mockup" : busy ? "Working…" : "Generate mockup from brief"}
            </button>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          {note && <p className="text-sm text-green-400">{note}</p>}
          <p className="text-xs text-muted">
            Jerseys, hats, hype chains, hoodies, pants, socks - in the team&apos;s colors, seeded with the customer&apos;s logo/reference plus anything you add above. ~13¢ each.
          </p>
        </div>
      </div>

      {/* Click-to-enlarge lightbox. */}
      {zoom && (
        <div
          onClick={() => setZoom(null)}
          className="fixed inset-0 z-50 bg-black/80 grid place-items-center p-4 cursor-zoom-out"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="AI mockup enlarged" className="max-h-[92vh] max-w-[95vw] object-contain rounded shadow-2xl" />
        </div>
      )}
    </section>
  );
}
