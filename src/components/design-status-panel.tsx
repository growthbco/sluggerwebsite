"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ProofAnnotator, type Annotation } from "@/components/proof-annotator";
import { ProofLightbox } from "@/components/proof-lightbox";

type Props = {
  token: string;
  reference: string;
  teamName: string;
  status: string;
  proofImages: string[];
  proofLabels?: Record<string, string>;
  initialApprovedUrl: string | null;
  approvedUrls?: string[];
  teamOrderUrl: string;
  revisionsUsed: number;
  maxRevisions: number;
};

const STATUS_COPY: Record<string, { label: string; blurb: string }> = {
  submitted: { label: "Submitted", blurb: "Your request is in. Our designer will get started shortly." },
  in_design: { label: "In Design", blurb: "Our designer is working on your mockup." },
  proof_sent: { label: "Proof Ready", blurb: "Your proof is below. Approve it, or request changes." },
  changes_requested: { label: "Changes Requested", blurb: "We're updating the proof based on your notes." },
  approved: { label: "Approved", blurb: "Design approved! Time to submit your team order." },
  ordered: { label: "Ordered", blurb: "Your team order has been submitted. We're on it." },
  cancelled: { label: "Cancelled", blurb: "" },
};

export function DesignStatusPanel({
  token,
  reference,
  teamName,
  status,
  proofImages,
  proofLabels = {},
  initialApprovedUrl,
  approvedUrls = [],
  teamOrderUrl,
  revisionsUsed,
  maxRevisions,
}: Props) {
  const [currentStatus, setCurrentStatus] = useState(status);
  // Multi-select: a project can have several finals (jersey, hat, pants, or a
  // few practice jerseys), so the client can pick more than one to approve.
  const [selected, setSelected] = useState<string[]>(
    initialApprovedUrl ? [initialApprovedUrl] : proofImages.length === 1 ? [proofImages[0]] : [],
  );
  // The proof the change-request editor / lightbox act on (last one tapped).
  const [activeProof, setActiveProof] = useState<string>(
    initialApprovedUrl ?? proofImages[proofImages.length - 1] ?? "",
  );
  const [busy, setBusy] = useState<"" | "approving" | "requesting">("");
  const [message, setMessage] = useState("");
  // Final-approval gate: opening a confirm modal + requiring an explicit
  // acknowledgment checkbox before we send the design to production, so there's
  // a clear record the client understood approval is final.
  const [confirming, setConfirming] = useState(false);
  const [ack, setAck] = useState(false);
  const [showChanges, setShowChanges] = useState(false);
  const [generalNote, setGeneralNote] = useState("");
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [used, setUsed] = useState(revisionsUsed);
  const [expanded, setExpanded] = useState<string | null>(null);

  const copy = STATUS_COPY[currentStatus] ?? { label: currentStatus, blurb: "" };
  const isApproved = currentStatus === "approved" || currentStatus === "ordered";
  // When the roster lives on this same page (the unified hub passes a "#roster"
  // anchor), the post-approval CTA scrolls down instead of sending them to a
  // separate team-order form.
  const rosterInline = teamOrderUrl.startsWith("#");
  // Which design(s) the client approved, to show on the approved screen.
  const approvedShown = approvedUrls.length ? approvedUrls : initialApprovedUrl ? [initialApprovedUrl] : [];
  const hasProof = proofImages.length > 0;
  const revisionsLeft = Math.max(0, maxRevisions - used);
  const maxedOut = revisionsLeft === 0;

  function toggleSelect(u: string) {
    if (isApproved) return;
    setActiveProof(u);
    setSelected((s) => (s.includes(u) ? s.filter((x) => x !== u) : [...s, u]));
  }

  async function approve() {
    if (selected.length === 0) return;
    setBusy("approving");
    setMessage("");
    try {
      const res = await fetch(`/api/design-request/${token}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvedUrls: selected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not approve");
      setCurrentStatus("approved");
      setConfirming(false);
      // Reveal the next stage (roster & sizes) on this SAME page - the server
      // renders it once the order is provisioned, so reload to bring it in.
      if (rosterInline && typeof window !== "undefined") {
        window.location.reload();
        return;
      }
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function submitChanges() {
    const hasNote = generalNote.trim().length > 0;
    const hasPins = annotations.some((a) => a.note.trim().length > 0);
    if (!hasNote && !hasPins) {
      setMessage("Add at least one pin with a note, or write a general note.");
      return;
    }
    setBusy("requesting");
    setMessage("");
    try {
      const res = await fetch(`/api/design-request/${token}/request-changes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generalNote: generalNote.trim() || undefined,
          proofImageUrl: activeProof || undefined,
          annotations: annotations.filter((a) => a.note.trim().length > 0),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save");
      setCurrentStatus("changes_requested");
      setShowChanges(false);
      setGeneralNote("");
      setAnnotations([]);
      if (typeof data.used === "number") setUsed(data.used);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <span className="display text-brand text-sm">{reference}</span>
        <h1 className="display text-3xl sm:text-4xl text-foreground mt-1">{teamName}</h1>
        <div className="mt-4 inline-block clip-slant bg-brand text-on-brand display text-sm px-4 py-2">{copy.label}</div>
        {copy.blurb && <p className="mt-3 text-muted">{copy.blurb}</p>}
        {hasProof && !isApproved && (
          <p className="mt-2 text-xs text-muted">
            Revisions used: <strong className="text-foreground">{used}</strong> of {maxRevisions}
          </p>
        )}
      </header>

      {hasProof && (
        <section>
          <h2 className="display text-xl text-foreground">Your proof{proofImages.length > 1 ? "s" : ""}</h2>
          {!isApproved && (
            <p className="text-sm text-muted mt-1">
              {proofImages.length > 1
                ? "Tap each proof you want to approve (you can pick more than one). Use the magnifier to enlarge."
                : "Tap the proof to select it, then approve or request changes."}
            </p>
          )}
          <p className="text-xs text-muted mt-1">
            Note: every finished jersey includes standard Slugger Athletics branding - a size barcode
            tag on the lower-right front, the SA logo at the top of the back, and a neck label reading
            &quot;Slugger Athletics&quot; - even if it isn&apos;t shown on the proof.
          </p>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {proofImages.map((u) => {
              const isSel = selected.includes(u);
              return (
                <div
                  key={u}
                  onClick={() => toggleSelect(u)}
                  className={`group relative aspect-[4/3] bg-white border-2 overflow-hidden ${isApproved ? "" : "cursor-pointer"} ${
                    isSel ? "border-brand ring-2 ring-brand/40" : "border-line hover:border-brand/50"
                  }`}
                >
                  <Image src={u} alt={proofLabels[u] || "Proof"} fill sizes="(max-width: 640px) 100vw, 50vw" className="object-contain p-2" unoptimized />
                  {!isApproved && (
                    <span className={`absolute top-2 right-2 grid place-items-center h-7 w-7 display text-sm rounded-full border-2 ${isSel ? "bg-brand text-on-brand border-brand" : "bg-white/90 text-muted border-line"}`}>
                      {isSel ? "✓" : ""}
                    </span>
                  )}
                  {proofLabels[u] && (
                    <span className="absolute top-2 left-2 bg-black/75 text-white text-[11px] display px-2 py-1 pointer-events-none">{proofLabels[u]}</span>
                  )}
                  {/* Enlarge is its own control so tapping the image selects it. */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setExpanded(u); }}
                    className="absolute bottom-2 right-2 grid place-items-center h-8 w-8 bg-black/70 text-white rounded hover:bg-black/85"
                    title="Enlarge"
                    aria-label="Enlarge proof"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" strokeLinecap="round" /></svg>
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {hasProof && !isApproved && (
        <p className="text-sm text-foreground bg-brand/10 border border-brand/40 px-4 py-3">
          ⚠ <strong>Your approved design is what we produce.</strong> Every name, number, size, logo,
          and detail on the proof you approve prints exactly as shown. Not right yet? Request changes -
          revisions are included. Once you approve, it goes straight to production as-is.
        </p>
      )}

      {message && <p className="text-sm text-brand">{message}</p>}

      {isApproved ? (
        <section className="bg-steel border border-line p-6 text-center">
          <div className="mx-auto h-12 w-12 grid place-items-center clip-slant bg-brand text-on-brand display text-xl">✓</div>
          <h2 className="display text-2xl text-foreground mt-4">Design approved!</h2>
          {approvedShown.length > 0 && (
            <>
              <p className="mt-4 text-xs display uppercase tracking-wide text-muted">
                {approvedShown.length === 1 ? "Your approved design" : `Your ${approvedShown.length} approved designs`}
              </p>
              <div className={`mt-2 grid gap-3 ${approvedShown.length === 1 ? "grid-cols-1 max-w-md mx-auto" : "grid-cols-1 sm:grid-cols-2"}`}>
                {approvedShown.map((u) => (
                  <button key={u} type="button" onClick={() => setExpanded(u)} className="relative block aspect-[4/3] bg-white border-2 border-brand rounded overflow-hidden cursor-zoom-in">
                    <Image src={u} alt="Approved design" fill unoptimized className="object-contain" />
                  </button>
                ))}
              </div>
            </>
          )}
          <p className="mt-4 text-muted">
            {rosterInline
              ? "Next step: fill out your roster and sizes below. Your design and contact details are already attached."
              : "Next step: submit your team order. Your approved design and contact details are already attached."}
          </p>
          <Link
            href={teamOrderUrl}
            className="inline-block mt-6 clip-slant bg-brand text-on-brand display text-lg px-8 py-4 hover:bg-brand-dark transition-colors"
          >
            {rosterInline ? "Fill out your roster ↓" : "Submit Your Team Order →"}
          </Link>
        </section>
      ) : hasProof ? (
        <section className="flex flex-wrap gap-3">
          <button
            onClick={() => { setAck(false); setConfirming(true); }}
            disabled={selected.length === 0 || busy !== ""}
            className="clip-slant bg-brand hover:bg-brand-dark text-on-brand display text-lg px-8 py-4 transition-colors disabled:opacity-60"
          >
            {selected.length > 1 ? `✓ Approve ${selected.length} Selected` : "✓ Approve This Proof"}
          </button>
          <button
            onClick={() => setShowChanges((v) => !v)}
            disabled={maxedOut}
            className="clip-slant border border-line text-foreground hover:bg-foreground/5 display text-lg px-8 py-4 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={maxedOut ? `You've used all ${maxRevisions} free revisions` : undefined}
          >
            Request Changes{maxedOut ? " (locked)" : ""}
          </button>

          {confirming && (
            <div
              className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="approve-confirm-title"
              onClick={(e) => { if (e.target === e.currentTarget && busy === "") setConfirming(false); }}
            >
              <div className="w-full max-w-md bg-steel border border-amber-500/50 p-6 text-left">
                <h2 id="approve-confirm-title" className="display text-2xl text-foreground">⚠ Are you sure?</h2>
                <p className="mt-3 text-sm text-foreground/90">
                  Approving sends {selected.length > 1 ? "these designs" : "this design"} <strong>straight into production</strong>. This is <strong>final</strong> - every name, number, size, logo, and color prints <strong>exactly as shown on the proof</strong>.
                </p>
                <p className="mt-2 text-sm text-foreground/90">
                  Once you approve, it <strong>cannot be changed, cancelled, or refunded</strong>. Please double-check every detail first.
                </p>
                <label className="mt-4 flex items-start gap-2.5 text-sm text-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={ack}
                    onChange={(e) => setAck(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
                  />
                  <span>I&apos;ve checked every detail. I understand this is final and goes into production as-is, with no changes or refunds.</span>
                </label>
                <p className="mt-2 text-xs text-muted">
                  By approving you agree to our{" "}
                  <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">Terms &amp; Conditions</a>.
                </p>
                {message && <p className="mt-3 text-sm text-brand">{message}</p>}
                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    onClick={approve}
                    disabled={!ack || busy !== ""}
                    className="clip-slant bg-brand hover:bg-brand-dark text-on-brand display px-6 py-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {busy === "approving" ? "Approving…" : "Yes, approve & produce"}
                  </button>
                  <button
                    onClick={() => setConfirming(false)}
                    disabled={busy !== ""}
                    className="clip-slant border border-line text-foreground hover:bg-foreground/5 display px-6 py-3 transition-colors disabled:opacity-50"
                  >
                    Go back
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      ) : (
        <p className="text-muted">No proof yet. We&apos;ll email you when it&apos;s ready.</p>
      )}

      {maxedOut && !isApproved && hasProof && (
        <section className="bg-steel border border-line p-5">
          <p className="text-sm text-foreground">
            You&apos;ve used all <strong>{maxRevisions} free revisions</strong>. For additional changes,
            email <a href="mailto:apparel@sluggerathletics.com" className="text-brand hover:underline">apparel@sluggerathletics.com</a>.
          </p>
        </section>
      )}

      {showChanges && !isApproved && !maxedOut && (
        <section className="bg-steel border border-line p-5 space-y-4">
          <div>
            <h3 className="display text-foreground">Tell us what to change</h3>
            <p className="text-sm text-muted mt-1">
              Click pins on the proof to mark exactly what to change. You have{" "}
              <strong className="text-foreground">{revisionsLeft}</strong> revision{revisionsLeft === 1 ? "" : "s"} left.
            </p>
            {proofImages.length > 1 && (
              <p className="text-xs text-muted mt-1">
                Editing: <strong className="text-foreground">{proofLabels[activeProof] || "the selected proof"}</strong>. Tap a different proof above to switch.
              </p>
            )}
          </div>

          {activeProof && (
            <ProofAnnotator
              proofUrl={activeProof}
              generalNote={generalNote}
              setGeneralNote={setGeneralNote}
              annotations={annotations}
              setAnnotations={setAnnotations}
              disabled={busy !== ""}
            />
          )}

          <button
            onClick={submitChanges}
            disabled={busy !== ""}
            className="clip-slant bg-brand text-on-brand display px-6 py-3 hover:bg-brand-dark disabled:opacity-60"
          >
            {busy === "requesting" ? "Sending..." : "Send Changes"}
          </button>
        </section>
      )}

      {expanded && <ProofLightbox src={expanded} onClose={() => setExpanded(null)} />}
    </div>
  );
}
