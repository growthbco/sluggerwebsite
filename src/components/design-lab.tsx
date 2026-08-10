"use client";

import { useRef, useState, useEffect } from "react";
import { DropZone, firstImageFile } from "@/components/drop-zone";
import { SmsConsentNote } from "@/components/sms-consent";

const SPORTS = ["Baseball", "Softball", "Basketball", "Soccer", "Flag Football", "Football", "Volleyball", "Hockey", "Pickleball", "Bowling"];
const STYLES = ["Crew Neck", "Two-Button", "Full-Button", "Quarter-Zip", "Sleeveless / Tank", "Reversible"];

/** Private AI jersey designer preview. Each generation ~13 cents; the API
 *  enforces a daily cap and requires the test key or an admin session. */
export function DesignLab({ testKey, ladder, paidJustNow }: { testKey?: string; ladder?: boolean; paidJustNow?: boolean }) {
  const [sport, setSport] = useState("Baseball");
  const [style, setStyle] = useState("Crew Neck");
  const [primaryColor, setPrimaryColor] = useState("#0A0A0A");
  const [secondaryColor, setSecondaryColor] = useState("#B8A36C");
  const [extraColors, setExtraColors] = useState<string[]>([]);
  const [teamName, setTeamName] = useState("");
  const [backNumber, setBackNumber] = useState("");
  const [idea, setIdea] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [cleanToken, setCleanToken] = useState<string | undefined>(undefined);
  const [history, setHistory] = useState<{ img: string; token?: string }[]>([]);
  const [refinement, setRefinement] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<{ used: number; cap: number } | null>(null);
  const [need, setNeed] = useState<"email" | "upgrade" | null>(null);
  const [proceedOpen, setProceedOpen] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [estimatedPieces, setEstimatedPieces] = useState("10-14");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ reference: string; statusUrl?: string; checkoutUrl?: string } | null>(null);
  const [email, setEmail] = useState("");
  const [leadFirst, setLeadFirst] = useState("");
  const [leadLast, setLeadLast] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Persist the whole working session to localStorage so an accidental reload
  // or a new window doesn't wipe the design in progress. Restored on mount.
  const LS_KEY = "slugger_jersey_maker_v1";
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.sport) setSport(d.sport);
      if (d.style) setStyle(d.style);
      if (d.primaryColor) setPrimaryColor(d.primaryColor);
      if (d.secondaryColor) setSecondaryColor(d.secondaryColor);
      if (Array.isArray(d.extraColors)) setExtraColors(d.extraColors);
      if (typeof d.teamName === "string") setTeamName(d.teamName);
      if (typeof d.backNumber === "string") setBackNumber(d.backNumber);
      if (typeof d.idea === "string") setIdea(d.idea);
      if (d.logo) setLogo(d.logo);
      if (d.reference) setReference(d.reference);
      if (d.image) setImage(d.image);
      if (d.cleanToken) setCleanToken(d.cleanToken);
      if (Array.isArray(d.history)) setHistory(d.history);
    } catch { /* ignore corrupt/oversized */ }
  }, []);

  useEffect(() => {
    if (!restored.current) return;
    // Trim history images down until it fits localStorage's ~5MB quota.
    let hist = history;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify({
          sport, style, primaryColor, secondaryColor, extraColors, teamName, backNumber, idea,
          logo, reference, image, cleanToken, history: hist,
        }));
        return;
      } catch {
        if (hist.length > 1) hist = hist.slice(0, Math.max(1, Math.floor(hist.length / 2)));
        else break; // even one image too big; give up quietly
      }
    }
  }, [sport, style, primaryColor, secondaryColor, extraColors, teamName, backNumber, idea, logo, reference, image, cleanToken, history]);

  const refFileRef = useRef<HTMLInputElement>(null);

  function pickImage(file: File | undefined, set: (v: string) => void) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const scale = Math.min(1, 1024 / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        set(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result as string;
    };
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
          ladder: ladder || undefined,
          sport, style, primaryColor, secondaryColor, extraColors, teamName, backNumber, idea,
          logo: logo ?? undefined,
          reference: reference ?? undefined,
          ...(refine && image ? { previousImage: image, refinement } : {}),
        }),
      });
      const data = await res.json();
      if (res.status === 403 && data.need) { setNeed(data.need); return; }
      if (!res.ok || !data.image) { setError(data.error ?? "Generation failed"); return; }
      setNeed(null);
      setImage(data.image);
      setCleanToken(data.cleanToken);
      setHistory((h) => [{ img: data.image, token: data.cleanToken }, ...h].slice(0, 12));
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
    <div className="space-y-6">
      {paidJustNow && (
        <div className="border border-green-600/60 bg-green-600/10 text-foreground p-4 rounded">
          <p className="display">✅ Design session active</p>
          <p className="text-sm text-muted mt-1">Unlimited concepts for this project - and your $10 is credited toward your order.</p>
        </div>
      )}
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
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className={label}>PRIMARY</label>
            <div className="flex items-center gap-2">
              <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-10 w-12 bg-steel border border-line cursor-pointer rounded" />
              <span className="text-xs text-muted font-mono">{primaryColor}</span>
            </div>
          </div>
          <div>
            <label className={label}>ACCENT</label>
            <div className="flex items-center gap-2">
              <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="h-10 w-12 bg-steel border border-line cursor-pointer rounded" />
              <span className="text-xs text-muted font-mono">{secondaryColor}</span>
            </div>
          </div>
          {extraColors.map((col, i) => (
            <div key={i}>
              <label className={label}>COLOR {i + 3}</label>
              <div className="flex items-center gap-2">
                <input type="color" value={col} onChange={(e) => setExtraColors((a) => a.map((v, j) => (j === i ? e.target.value : v)))} className="h-10 w-12 bg-steel border border-line cursor-pointer rounded" />
                <button type="button" onClick={() => setExtraColors((a) => a.filter((_, j) => j !== i))} className="text-xs text-muted underline">remove</button>
              </div>
            </div>
          ))}
          {extraColors.length < 2 && (
            <button type="button" onClick={() => setExtraColors((a) => [...a, "#FFFFFF"])} className="h-10 border border-dashed border-line text-muted display text-xs px-3 hover:border-brand/60">
              + Color
            </button>
          )}
        </div>
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <div>
            <label className={label}>TEAM NAME (ON THE CHEST)</label>
            <input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="e.g. MONSTARS" className={input} maxLength={30} />
          </div>
          <div>
            <label className={label}>BACK #</label>
            <input value={backNumber} onChange={(e) => setBackNumber(e.target.value)} placeholder="12" className={input} maxLength={4} />
          </div>
        </div>
        <div>
          <label className={label}>DESCRIBE YOUR IDEA</label>
          <textarea value={idea} onChange={(e) => setIdea(e.target.value)} rows={3} maxLength={500}
            placeholder="e.g. lightning bolts down the sides, faded smoke pattern, retro 90s vibe, pinstripes…" className={`${input} resize-y`} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className={label}>TEAM LOGO OR SKETCH (OPTIONAL)</label>
            <DropZone onFiles={(fs) => pickImage(firstImageFile(fs), setLogo)} className="flex items-center gap-2 mt-1">
              <button type="button" onClick={() => fileRef.current?.click()} className="border border-line text-foreground display text-sm px-3 py-2.5 hover:border-brand/60">
                {logo ? "Change" : "Upload logo"}
              </button>
              {logo && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logo} alt="Logo preview" className="h-10 w-10 object-contain bg-white rounded" />
                  <button type="button" onClick={() => setLogo(null)} className="text-xs text-muted underline">remove</button>
                </>
              )}
            </DropZone>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
              onChange={(e) => pickImage(e.target.files?.[0], setLogo)} />
          </div>
          <div>
            <label className={label}>REFERENCE JERSEY (OPTIONAL)</label>
            <DropZone onFiles={(fs) => pickImage(firstImageFile(fs), setReference)} className="flex items-center gap-2 mt-1">
              <button type="button" onClick={() => refFileRef.current?.click()} className="border border-line text-foreground display text-sm px-3 py-2.5 hover:border-brand/60">
                {reference ? "Change" : "Upload reference"}
              </button>
              {reference && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={reference} alt="Reference preview" className="h-10 w-10 object-contain bg-white rounded" />
                  <button type="button" onClick={() => setReference(null)} className="text-xs text-muted underline">remove</button>
                </>
              )}
            </DropZone>
            <p className="mt-1 text-[11px] text-muted">A jersey you like - we restyle its look in your colors.</p>
            <input ref={refFileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
              onChange={(e) => pickImage(e.target.files?.[0], setReference)} />
          </div>
        </div>
        <button type="button" onClick={() => generate(false)} disabled={busy}
          className="w-full clip-slant bg-brand hover:bg-brand-dark text-on-brand display text-lg py-3.5 transition-colors disabled:opacity-60">
          {busy ? "Designing… (about 15 seconds)" : image ? "Generate a Fresh Design" : "Generate My Jersey"}
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>

      {/* Result */}
      <div>
        <div className={`relative aspect-[4/3] border border-line rounded overflow-hidden grid place-items-center ${image ? "bg-white" : "bg-steel"}`}>
          {image ? (
            <button type="button" onClick={() => setZoomOpen(true)} className="h-full w-full cursor-zoom-in" title="Tap to zoom">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt="AI jersey concept" className="h-full w-full object-contain" />
              <span className="absolute bottom-1.5 right-2 text-[11px] bg-ink/80 text-foreground px-1.5 py-0.5 rounded">🔍 tap to zoom</span>
            </button>
          ) : (
            <div className="text-center px-8">
              <svg className="mx-auto mb-3 opacity-30" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M16 3l5 3-2 4-2-1v11H7V9L5 10 3 6l5-3c0 1.1 1.8 2 4 2s4-.9 4-2z" strokeLinejoin="round"/></svg>
              <p className="text-muted text-sm">Your concept appears here - front and back, side by side.</p>
            </div>
          )}
          {busy && <div className="absolute inset-0 bg-black/40 grid place-items-center"><p className="display text-white">Designing…</p></div>}
        </div>
        {zoomOpen && image && (
          <div className="fixed inset-0 z-[90] bg-black/85 grid place-items-center p-3 cursor-zoom-out" onClick={() => setZoomOpen(false)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="AI jersey concept - full size" className="max-h-[95vh] max-w-[98vw] object-contain bg-white rounded" />
            <button type="button" className="absolute top-4 right-4 text-white text-3xl" aria-label="Close">×</button>
          </div>
        )}
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
            <div className="flex items-center justify-between gap-3">
              <a href={image} download="slugger-ai-concept.png" className="text-sm text-brand underline underline-offset-2">
                Download this concept
              </a>
              {!submitted && (
                <button type="button" onClick={() => setProceedOpen((v) => !v)}
                  className="clip-slant bg-brand hover:bg-brand-dark text-on-brand display text-sm px-5 py-2.5 transition-colors">
                  Proceed With This Design →
                </button>
              )}
            </div>
            {submitted && (
              <div className="border border-green-600/60 bg-green-600/10 p-4 rounded space-y-1">
                <p className="display text-foreground">🎉 Sent to our designer - {submitted.reference}</p>
                <p className="text-sm text-muted">Your concept, logo, and colors are in the designer&apos;s hands. You&apos;ll get a real proof to approve.</p>
                {submitted.checkoutUrl ? (
                  <a href={submitted.checkoutUrl} className="inline-block mt-1 clip-slant bg-brand text-on-brand display text-sm px-4 py-2">Finish: pay the design fee</a>
                ) : submitted.statusUrl ? (
                  <a href={submitted.statusUrl} className="text-sm text-brand underline">Track your design here</a>
                ) : null}
              </div>
            )}
            {proceedOpen && !submitted && (
              <div className="border border-brand/50 bg-brand/10 p-4 rounded space-y-3">
                <p className="display text-foreground">Send this concept to our designer</p>
                <p className="text-sm text-muted">We attach this exact design, your logo file, reference, and colors. Our designer turns it into a production-ready proof for your approval - free revisions before anything is made.</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Your name" className={input} maxLength={60} />
                  <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} type="email" placeholder="Email" className={input} maxLength={100} />
                  <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="Phone (optional)" className={input} maxLength={20} />
                  <select value={estimatedPieces} onChange={(e) => setEstimatedPieces(e.target.value)} className={input}>
                    {["6-9", "10-14", "15-24", "25+"].map((r) => <option key={r} value={r}>{r} pieces</option>)}
                  </select>
                </div>
                <SmsConsentNote />
                <button
                  type="button"
                  disabled={submitting || !contactName.trim() || !contactEmail.includes("@") || !teamName.trim()}
                  onClick={async () => {
                    setSubmitting(true);
                    setError(null);
                    try {
                      const r = await fetch("/api/design-lab/submit", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          key: testKey, contactName, contactEmail, contactPhone,
                          teamName, sport, style, backNumber, idea, estimatedPieces,
                          colorHexes: [primaryColor, secondaryColor, ...extraColors],
                          concept: image, cleanToken, logo: logo ?? undefined, reference: reference ?? undefined,
                        }),
                      });
                      const d = await r.json();
                      if (!r.ok || !d.reference) { setError(d.error ?? "Could not send - try again"); return; }
                      setSubmitted({ reference: d.reference, statusUrl: d.statusUrl, checkoutUrl: d.checkoutUrl });
                      setProceedOpen(false);
                    } catch {
                      setError("Could not send - try again");
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                  className="w-full clip-slant bg-brand hover:bg-brand-dark text-on-brand display py-3 disabled:opacity-60"
                >
                  {submitting ? "Sending to designer…" : "Send to Our Designer - Free Proof"}
                </button>
                {!teamName.trim() && <p className="text-xs text-red-400">Add your team name above first.</p>}
              </div>
            )}
            {history.length > 1 && (
              <div>
                <p className="display text-xs text-muted tracking-wide mt-2">EARLIER CONCEPTS - TAP TO BRING BACK</p>
                <div className="mt-1.5 flex gap-2 overflow-x-auto pb-1">
                  {history.map((h, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => { setImage(h.img); setCleanToken(h.token); }}
                      className={`shrink-0 h-16 w-[5.3rem] bg-white rounded overflow-hidden border-2 ${h.img === image ? "border-brand" : "border-line opacity-70 hover:opacity-100"}`}
                      aria-label={`Show concept ${history.length - i}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={h.img} alt={`Concept ${history.length - i}`} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>

      {/* Gate modal: unmissable, centered, dark scrim. */}
      {need && (
        <div className="fixed inset-0 z-[70] bg-black/75 grid place-items-center p-4">
          <div className="w-full max-w-md bg-ink border border-brand/60 rounded-lg shadow-2xl p-6 space-y-4">
            {need === "email" ? (
              <>
                <div>
                  <p className="display text-2xl text-foreground">🔥 You&apos;re on a roll!</p>
                  <p className="text-sm text-muted mt-1">
                    Unlock <span className="text-brand font-semibold">5 more free designs</span> - and we&apos;ll save
                    your concepts so our designer can pick up right where you leave off.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input value={leadFirst} onChange={(e) => setLeadFirst(e.target.value)} placeholder="First name" className={input} maxLength={40} />
                  <input value={leadLast} onChange={(e) => setLeadLast(e.target.value)} placeholder="Last name" className={input} maxLength={40} />
                  <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email" className={`${input} col-span-2`} maxLength={100} />
                  <input value={leadPhone} onChange={(e) => setLeadPhone(e.target.value)} type="tel" placeholder="Phone" className={`${input} col-span-2`} maxLength={20} />
                </div>
                <SmsConsentNote />
                {error && <p className="text-sm text-red-400">{error}</p>}
                <button
                  type="button"
                  disabled={unlocking || !leadFirst.trim() || !leadLast.trim() || !email.includes("@") || leadPhone.replace(/\D/g, "").length < 10}
                  onClick={async () => {
                    setUnlocking(true);
                    setError(null);
                    try {
                      const r = await fetch("/api/design-lab/unlock", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ email, firstName: leadFirst, lastName: leadLast, phone: leadPhone }),
                      });
                      if (r.ok) {
                        setNeed(null);
                        setContactName(`${leadFirst.trim()} ${leadLast.trim()}`);
                        setContactEmail(email);
                        setContactPhone(leadPhone);
                      } else {
                        setError((await r.json()).error ?? "Try again");
                      }
                    } finally {
                      setUnlocking(false);
                    }
                  }}
                  className="w-full clip-slant bg-brand hover:bg-brand-dark text-on-brand display text-lg py-3.5 disabled:opacity-50"
                >
                  {unlocking ? "Unlocking…" : "Unlock 5 More Free Designs"}
                </button>
                <p className="text-[11px] text-muted text-center">No spam - we only reach out about your designs.</p>
              </>
            ) : (
              <>
                <div>
                  <p className="display text-2xl text-foreground">Reserve your designer</p>
                  <p className="text-sm text-muted mt-1">
                    <span className="text-brand font-semibold">$10 - credited in full to your order.</span>
                  </p>
                </div>
                <ul className="text-sm text-muted list-disc pl-5 space-y-1">
                  <li>Unlimited AI concepts for this project</li>
                  <li>Priority proof from our real designer</li>
                  <li>The full $10 comes off your order</li>
                </ul>
                {error && <p className="text-sm text-red-400">{error}</p>}
                <button
                  type="button"
                  disabled={unlocking}
                  onClick={async () => {
                    setUnlocking(true);
                    try {
                      const r = await fetch("/api/design-lab/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ returnTo: window.location.pathname + window.location.search }) });
                      const d = await r.json();
                      if (d.url) window.location.href = d.url;
                      else { setError(d.error ?? "Checkout unavailable"); setUnlocking(false); }
                    } catch { setError("Checkout unavailable"); setUnlocking(false); }
                  }}
                  className="w-full clip-slant bg-brand hover:bg-brand-dark text-on-brand display text-lg py-3.5 disabled:opacity-60"
                >
                  {unlocking ? "Opening checkout…" : "Reserve My Designer - $10"}
                </button>
              </>
            )}
            <button type="button" onClick={() => setNeed(null)} className="w-full text-center text-xs text-muted underline">
              Not now - back to my designs
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
