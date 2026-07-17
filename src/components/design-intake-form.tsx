"use client";

import { useEffect, useState } from "react";
import { loadRememberedContact, saveRememberedContact } from "@/lib/remembered-contact";
import Image from "next/image";
import { upload } from "@vercel/blob/client";
import { DESIGN_FEE_WAIVED } from "@/lib/design-fee";

type Uploaded = { url: string; pathname: string };

export function DesignIntakeForm() {
  const [teamName, setTeamName] = useState("");
  const [sport, setSport] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [productTypes, setProductTypes] = useState<string[]>([]);
  const [jerseyStyle, setJerseyStyle] = useState("");
  const [otherProduct, setOtherProduct] = useState("");
  const [vision, setVision] = useState("");
  const [colors, setColors] = useState("");
  const [neededBy, setNeededBy] = useState("");
  const [images, setImages] = useState<Uploaded[]>([]);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [statusUrl, setStatusUrl] = useState<string | null>(null);
  const [welcomeBack, setWelcomeBack] = useState(false);

  // Returning customer on the same device: prefill contact info so they don't
  // retype it. Saved (locally only) after each successful submit.
  useEffect(() => {
    const saved = loadRememberedContact();
    if (saved) {
      setContactName((v) => v || saved.name);
      setContactEmail((v) => v || saved.email);
      setContactPhone((v) => v || saved.phone);
      setWelcomeBack(true);
    }
  }, []);

  const inputCls =
    "w-full bg-steel border border-line px-3 py-2.5 text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none";

  // What the customer wants us to mock up. "Jersey" reveals a cut dropdown;
  // "Other" reveals a free-text box.
  const PRODUCT_OPTIONS = ["Jersey / Shirt", "Shorts", "Pants", "Hoodie", "Hat", "Socks", "Bag", "Other"];
  const JERSEY_STYLES = ["Full-button", "Two-button", "Crew neck", "V-neck", "Sleeveless / Tank"];
  const wantsJersey = productTypes.includes("Jersey / Shirt");
  const wantsOther = productTypes.includes("Other");

  function toggleProduct(p: string) {
    setProductTypes((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setMessage("");
    try {
      const uploaded: Uploaded[] = [];
      for (const file of Array.from(files)) {
        if (file.size > 15 * 1024 * 1024) {
          throw new Error(`${file.name} is larger than 15MB.`);
        }
        const blob = await upload(`design-inspiration/${file.name}`, file, {
          access: "public",
          handleUploadUrl: "/api/design-request/upload",
        });
        uploaded.push({ url: blob.url, pathname: blob.pathname });
      }
      setImages((prev) => [...prev, ...uploaded]);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  function removeImage(i: number) {
    setImages((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function submit() {
    setStatus("sending");
    setMessage("");
    try {
      // Send "Other" as the typed text (falls back to the literal "Other").
      const sendProducts = productTypes.map((p) =>
        p === "Other" ? (otherProduct.trim() || "Other") : p,
      );
      const res = await fetch("/api/design-request/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamName,
          sport,
          contactName,
          contactEmail,
          contactPhone,
          productTypes: sendProducts,
          jerseyStyle: wantsJersey && jerseyStyle ? jerseyStyle : undefined,
          vision,
          colors,
          inspirationImages: images.map((i) => i.url),
          neededBy: neededBy || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not submit your design request.");
      // Three outcomes:
      //  - waived (returning customer): show success + status URL
      //  - needs payment: redirect to Stripe Checkout
      //  - misconfigured: fall back to showing the status URL
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      setStatus("done");
      setStatusUrl(data.statusUrl);
      saveRememberedContact({ name: contactName, email: contactEmail, phone: contactPhone });
      if (data.waived) setMessage(data.waivedReason || "waived");
    } catch (e) {
      setStatus("error");
      setMessage((e as Error).message);
    }
  }

  if (status === "done") {
    const returning = message === "returning_customer";
    return (
      <div className="bg-steel border border-line p-8 text-center">
        <div className="mx-auto h-12 w-12 grid place-items-center clip-slant bg-brand text-on-brand display text-xl">✓</div>
        <h2 className="display text-2xl text-foreground mt-4">
          {returning ? "Welcome back!" : "Design request received!"}
        </h2>
        <p className="mt-3 text-muted">
          {returning
            ? "Your $35 design fee was automatically waived as a returning Slugger customer. Our designer is already on it."
            : "Our in-house designer will get started on your mockup. You can track its progress here:"}
        </p>
        {!returning && DESIGN_FEE_WAIVED && message === "promo_campaign" && (
          <p className="mt-2 text-sm text-brand">No design fee — it&apos;s on us right now. 🎉</p>
        )}
        {statusUrl && (
          <div className="mt-4">
            <a href={statusUrl} className="text-brand hover:underline break-all text-sm">{statusUrl}</a>
            <p className="text-xs text-muted mt-2">Bookmark this link - you&apos;ll use it to approve the proof.</p>
          </div>
        )}
      </div>
    );
  }

  const canSubmit =
    teamName &&
    contactName &&
    contactEmail &&
    productTypes.length > 0 &&
    (vision.trim() || images.length > 0) &&
    !uploading;

  return (
    <div className="space-y-6">
      {/* Team + contact */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="display text-sm text-foreground">Team / Business Name *</label>
          <input className={`mt-2 ${inputCls}`} value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="e.g. Sandstorm Softball" />
        </div>
        <div>
          <label className="display text-sm text-foreground">Sport / Use</label>
          <input className={`mt-2 ${inputCls}`} value={sport} onChange={(e) => setSport(e.target.value)} placeholder="Softball, baseball, business..." />
        </div>
        <div>
          <label className="display text-sm text-foreground">Your Name *</label>
          {welcomeBack && (
            <p className="mt-1 text-xs text-brand">Welcome back! We filled in your info from last time - double-check it&apos;s still right.</p>
          )}
          <input className={`mt-2 ${inputCls}`} value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Your name" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="display text-sm text-foreground">Email *</label>
            <input className={`mt-2 ${inputCls}`} type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="you@email.com" />
          </div>
          <div>
            <label className="display text-sm text-foreground">Phone</label>
            <input className={`mt-2 ${inputCls}`} type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="(000) 000-0000" />
          </div>
        </div>
      </div>

      {/* What to mock up */}
      <div>
        <label className="display text-sm text-foreground">What do you want us to mock up? *</label>
        <p className="text-sm text-muted mt-1">Pick everything you&apos;d like designed. You can choose more than one.</p>
        <p className="mt-2 text-sm bg-brand/10 border border-brand/40 text-foreground p-3">
          Please only select the pieces you actually plan to buy. Each mockup takes real design
          time to create, so we&apos;d rather focus on the gear you intend to order than design things
          that won&apos;t get made.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {PRODUCT_OPTIONS.map((p) => {
            const on = productTypes.includes(p);
            return (
              <button
                key={p}
                type="button"
                onClick={() => toggleProduct(p)}
                aria-pressed={on}
                className={`display text-sm px-3.5 py-2 border transition-colors ${
                  on
                    ? "bg-brand text-on-brand border-brand"
                    : "bg-steel text-foreground border-line hover:border-brand/50"
                }`}
              >
                {on ? "✓ " : ""}
                {p}
              </button>
            );
          })}
        </div>

        {wantsJersey && (
          <div className="mt-4">
            <label className="display text-sm text-foreground">Jersey / shirt style</label>
            <select
              className={`mt-2 ${inputCls} max-w-xs`}
              value={jerseyStyle}
              onChange={(e) => setJerseyStyle(e.target.value)}
            >
              <option value="">Not sure yet — recommend one</option>
              {JERSEY_STYLES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        )}

        {wantsOther && (
          <div className="mt-4">
            <label className="display text-sm text-foreground">Tell us what else</label>
            <input
              className={`mt-2 ${inputCls}`}
              value={otherProduct}
              onChange={(e) => setOtherProduct(e.target.value)}
              placeholder="e.g. bags, beanies, warmup jackets..."
            />
          </div>
        )}
      </div>

      {/* Brief */}
      <div>
        <label className="display text-sm text-foreground">Describe your vision</label>
        <textarea
          className={`mt-2 ${inputCls} min-h-32 resize-y`}
          value={vision}
          onChange={(e) => setVision(e.target.value)}
          placeholder="What look are you going for? Theme, mood, references (e.g. 'Vice City vibe, palm trees, neon pink/teal')..."
        />
      </div>

      <div>
        <label className="display text-sm text-foreground">Colors</label>
        <input className={`mt-2 ${inputCls}`} value={colors} onChange={(e) => setColors(e.target.value)} placeholder="Team colors, hex codes, or 'we want pink and black'..." />
      </div>

      <div>
        <label className="display text-sm text-foreground">When do you need the uniforms in hand?</label>
        <input
          className={`mt-2 ${inputCls} max-w-xs`}
          type="date"
          value={neededBy}
          onChange={(e) => setNeededBy(e.target.value)}
          min={new Date().toISOString().split("T")[0]}
        />
        {(() => {
          if (!neededBy) return null;
          const days = (new Date(neededBy).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
          if (days >= 14) return <p className="mt-2 text-sm text-muted">✓ You&apos;re within our standard 2-3 week turnaround.</p>;
          if (days < 0) return <p className="mt-2 text-sm text-brand">That date is in the past — please pick a future date.</p>;
          return (
            <p className="mt-2 text-sm bg-brand/10 border border-brand/40 text-foreground p-3">
              ⚡ Heads up — that&apos;s within 2 weeks. A <strong>$5 per item rush fee</strong> applies to make this deadline.
            </p>
          );
        })()}
      </div>

      {/* Inspiration uploads */}
      <div>
        <label className="display text-sm text-foreground">Inspiration images (optional)</label>
        <p className="text-sm text-muted mt-1">Upload anything that inspires the look - other jerseys, logos, color palettes. JPG/PNG/WEBP/PDF up to 15MB each.</p>
        <label className="mt-3 block cursor-pointer border-2 border-dashed border-line hover:border-brand/50 transition-colors p-6 text-center bg-steel">
          <input
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <span className="display text-foreground">{uploading ? "Uploading..." : "Click or drop files here"}</span>
          <p className="text-sm text-muted mt-1">{uploading ? "Hang tight..." : "You can add multiple"}</p>
        </label>
        {images.length > 0 && (
          <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
            {images.map((img, i) => (
              <div key={img.url} className="relative aspect-square bg-steel border border-line group overflow-hidden">
                {/\.(png|jpe?g|webp|gif)$/i.test(img.url) ? (
                  <Image src={img.url} alt="Inspiration" fill sizes="20vw" className="object-cover" unoptimized />
                ) : (
                  <div className="absolute inset-0 grid place-items-center text-xs text-muted p-2 text-center break-all">
                    {img.pathname.split("/").pop()}
                  </div>
                )}
                <button
                  onClick={() => removeImage(i)}
                  className="absolute top-1 right-1 grid place-items-center h-6 w-6 bg-ink/80 text-foreground hover:bg-brand hover:text-on-brand text-xs"
                  aria-label="Remove image"
                  type="button"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {status === "error" && <p className="text-sm text-brand">{message}</p>}
      {message && status !== "error" && <p className="text-sm text-brand">{message}</p>}

      <button
        onClick={submit}
        disabled={!canSubmit || status === "sending"}
        className="w-full clip-slant bg-brand hover:bg-brand-dark text-on-brand display text-lg py-3.5 transition-colors disabled:opacity-60"
      >
        {status === "sending"
          ? "Submitting..."
          : DESIGN_FEE_WAIVED
          ? "Submit Design Request"
          : "Submit & Pay $35"}
      </button>
      {DESIGN_FEE_WAIVED ? (
        <p className="text-xs text-muted text-center">
          No design fee right now &mdash; it&apos;s on us. Our in-house designer starts as
          soon as you submit, free to see, no commitment.
        </p>
      ) : (
        <p className="text-xs text-muted text-center">
          $35 starts the design &mdash; credited 100% to your final order, so the design is free with purchase.
          <br />
          Returning customer? We&apos;ll waive it automatically when you submit.
        </p>
      )}
    </div>
  );
}
