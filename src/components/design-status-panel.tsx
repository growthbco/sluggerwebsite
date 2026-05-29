"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

type Props = {
  token: string;
  reference: string;
  teamName: string;
  status: string;
  proofImages: string[];
  initialApprovedUrl: string | null;
  teamOrderUrl: string;
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

export function DesignStatusPanel({ token, reference, teamName, status, proofImages, initialApprovedUrl, teamOrderUrl }: Props) {
  const [currentStatus, setCurrentStatus] = useState(status);
  const [chosen, setChosen] = useState<string | null>(initialApprovedUrl ?? proofImages[proofImages.length - 1] ?? null);
  const [busy, setBusy] = useState<"" | "approving" | "requesting">("");
  const [message, setMessage] = useState("");
  const [showChanges, setShowChanges] = useState(false);
  const [note, setNote] = useState("");

  const copy = STATUS_COPY[currentStatus] ?? { label: currentStatus, blurb: "" };
  const isApproved = currentStatus === "approved" || currentStatus === "ordered";
  const hasProof = proofImages.length > 0;

  async function approve() {
    if (!chosen) return;
    setBusy("approving");
    setMessage("");
    try {
      const res = await fetch(`/api/design-request/${token}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvedUrl: chosen }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not approve");
      setCurrentStatus("approved");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function submitChanges() {
    setBusy("requesting");
    setMessage("");
    try {
      const res = await fetch(`/api/design-request/${token}/request-changes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save");
      setCurrentStatus("changes_requested");
      setShowChanges(false);
      setNote("");
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
      </header>

      {hasProof && (
        <section>
          <h2 className="display text-xl text-foreground">Your proof{proofImages.length > 1 ? "s" : ""}</h2>
          {proofImages.length > 1 && !isApproved && (
            <p className="text-sm text-muted mt-1">Click a proof to select it, then approve.</p>
          )}
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {proofImages.map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => !isApproved && setChosen(u)}
                className={`relative aspect-[4/3] bg-white border-2 overflow-hidden ${
                  chosen === u ? "border-brand" : "border-line hover:border-brand/50"
                } ${isApproved ? "cursor-default" : "cursor-pointer"}`}
              >
                <Image src={u} alt="Proof" fill sizes="(max-width: 640px) 100vw, 50vw" className="object-contain p-2" unoptimized />
                {chosen === u && !isApproved && (
                  <span className="absolute top-2 right-2 grid place-items-center h-7 w-7 bg-brand text-on-brand display text-xs">✓</span>
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      {message && <p className="text-sm text-brand">{message}</p>}

      {isApproved ? (
        <section className="bg-steel border border-line p-6 text-center">
          <div className="mx-auto h-12 w-12 grid place-items-center clip-slant bg-brand text-on-brand display text-xl">✓</div>
          <h2 className="display text-2xl text-foreground mt-4">Design approved!</h2>
          <p className="mt-2 text-muted">Next step: submit your team order. Your approved design and contact details are already attached.</p>
          <Link
            href={teamOrderUrl}
            className="inline-block mt-6 clip-slant bg-brand text-on-brand display text-lg px-8 py-4 hover:bg-brand-dark transition-colors"
          >
            Submit Your Team Order →
          </Link>
        </section>
      ) : hasProof ? (
        <section className="flex flex-wrap gap-3">
          <button
            onClick={approve}
            disabled={!chosen || busy !== ""}
            className="clip-slant bg-brand hover:bg-brand-dark text-on-brand display text-lg px-8 py-4 transition-colors disabled:opacity-60"
          >
            {busy === "approving" ? "Approving..." : "✓ Approve This Proof"}
          </button>
          <button
            onClick={() => setShowChanges((v) => !v)}
            className="clip-slant border border-line text-foreground hover:bg-foreground/5 display text-lg px-8 py-4 transition-colors"
          >
            Request Changes
          </button>
        </section>
      ) : (
        <p className="text-muted">No proof yet. We&apos;ll email you when it&apos;s ready.</p>
      )}

      {showChanges && !isApproved && (
        <section className="bg-steel border border-line p-5 space-y-3">
          <h3 className="display text-foreground">Tell us what to change</h3>
          <textarea
            className="w-full bg-ink border border-line px-3 py-2.5 text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none min-h-24"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What would you like adjusted? Colors, text, layout..."
          />
          <button
            onClick={submitChanges}
            disabled={busy !== ""}
            className="clip-slant bg-brand text-on-brand display px-6 py-3 hover:bg-brand-dark disabled:opacity-60"
          >
            {busy === "requesting" ? "Sending..." : "Send Changes"}
          </button>
        </section>
      )}
    </div>
  );
}
