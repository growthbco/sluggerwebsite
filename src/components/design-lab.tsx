"use client";

import { useRef, useState } from "react";

const SPORTS = ["Baseball", "Softball", "Basketball", "Soccer", "Flag Football", "Football", "Volleyball", "Hockey", "Pickleball", "Bowling"];
const STYLES = ["Crew Neck", "Two-Button", "Full-Button", "Quarter-Zip", "Sleeveless / Tank", "Reversible"];

/** Private AI jersey designer preview. Each generation ~13 cents; the API
 *  enforces a daily cap and requires the test key or an admin session. */
export function DesignLab({ testKey }: { testKey?: string }) {
  const [sport, setSport] = useState("Baseball");
  const [style, setStyle] = useState("Crew Neck");
  const [primaryColor, setPrimaryColor] = useState("black");
  const [secondaryColor, setSecondaryColor] = useState("gold");
  const [teamName, setTeamName] = useState("");
  const [idea, setIdea] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [refinement, setRefinement] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<{ used: number; cap: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function onLogoPick(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLogo(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function generate(refine: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/design-lab/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: testKey,
          sport, style, primaryColor, secondaryColor, teamName, idea,
          logo: logo ?? undefined,
          ...(refine && image ? { previousImage: image, refinement } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.image) { setError(data.error ?? "Generation failed"); return; }
      setImage(data.image);
      setRefinement("");
      if (data.usedToday) setUsage({ used: data.usedToday, cap: data.capToday });
    } catch {
      setError("Connection problem - try again");
    } finally {
      setBusy(false);
    }
  }

  const input = "w-full bg-steel border border-line px-3 py-2.5 text-base sm:text-sm text-foreground focus:border-brand focus:outline-none";
  const label = "display text-xs text-muted tracking-wide";

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Controls */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>SPORT</label>
            <select value={sport} onChange={(e) => setSport(e.target.value)} className={input}>
              {SPORTS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>JERSEY STYLE</label>
            <select value={style} onChange={(e) => setStyle(e.target.value)} className={input}>
              {STYLES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>PRIMARY COLOR</label>
            <input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} placeholder="black, navy, royal blue…" className={input} />
          </div>
          <div>
            <label className={label}>ACCENT COLOR</label>
            <input value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} placeholder="gold, white, red…" className={input} />
          </div>
        </div>
        <div>
          <label className={label}>TEAM NAME (ON THE CHEST)</label>
          <input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="e.g. MONSTARS" className={input} maxLength={30} />
        </div>
        <div>
          <label className={label}>DESCRIBE YOUR IDEA</label>
          <textarea value={idea} onChange={(e) => setIdea(e.target.value)} rows={3} maxLength={500}
            placeholder="e.g. lightning bolts down the sides, faded smoke pattern, retro 90s vibe, pinstripes…" className={`${input} resize-y`} />
        </div>
        <div>
          <label className={label}>TEAM LOGO OR SKETCH (OPTIONAL)</label>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => fileRef.current?.click()} className="border border-line text-foreground display text-sm px-4 py-2.5 hover:border-brand/60">
              {logo ? "Change image" : "Upload image"}
            </button>
            {logo && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logo} alt="Logo preview" className="h-10 w-10 object-contain bg-white rounded" />
                <button type="button" onClick={() => setLogo(null)} className="text-xs text-muted underline">remove</button>
              </>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
            onChange={(e) => onLogoPick(e.target.files?.[0])} />
        </div>
        <button type="button" onClick={() => generate(false)} disabled={busy}
          className="w-full clip-slant bg-brand hover:bg-brand-dark text-on-brand display text-lg py-3.5 transition-colors disabled:opacity-60">
          {busy ? "Designing… (about 15 seconds)" : image ? "Generate a Fresh Design" : "Generate My Jersey"}
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {usage && <p className="text-xs text-muted">{usage.used}/{usage.cap} generations today (~${(usage.used * 0.134).toFixed(2)} spent)</p>}
      </div>

      {/* Result */}
      <div>
        <div className="relative aspect-square bg-white border border-line rounded overflow-hidden grid place-items-center">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="AI jersey concept" className="h-full w-full object-contain" />
          ) : (
            <p className="text-muted text-sm px-8 text-center">Your AI jersey concept will appear here.</p>
          )}
          {busy && <div className="absolute inset-0 bg-black/40 grid place-items-center"><p className="display text-white">Designing…</p></div>}
        </div>
        {image && (
          <div className="mt-3 space-y-2">
            <div className="flex gap-2">
              <input value={refinement} onChange={(e) => setRefinement(e.target.value)} maxLength={200}
                placeholder="Refine it: 'make the stripes thinner', 'add camo'…" className={input} />
              <button type="button" onClick={() => generate(true)} disabled={busy || !refinement.trim()}
                className="shrink-0 border border-brand/70 text-foreground display text-sm px-4 hover:bg-brand/10 disabled:opacity-50">
                Refine
              </button>
            </div>
            <a href={image} download="slugger-ai-concept.png" className="inline-block text-sm text-brand underline underline-offset-2">
              Download this concept
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
