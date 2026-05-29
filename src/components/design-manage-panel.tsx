"use client";

import { useState } from "react";
import Image from "next/image";
import { upload } from "@vercel/blob/client";

type Props = {
  token: string;
  reference: string;
  teamName: string;
  status: string;
  vision: string | null;
  colors: string | null;
  contact: { name: string; email: string; phone: string | null };
  inspirationImages: string[];
  proofImages: string[];
  statusUrl: string;
};

export function DesignManagePanel({ token, reference, teamName, status, vision, colors, contact, inspirationImages, proofImages, statusUrl }: Props) {
  const [proofs, setProofs] = useState<string[]>(proofImages);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [pending, setPending] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setMessage("");
    try {
      const newUrls: string[] = [];
      for (const file of Array.from(files)) {
        if (file.size > 15 * 1024 * 1024) throw new Error(`${file.name} is over 15MB.`);
        const blob = await upload(`design-proofs/${file.name}`, file, {
          access: "public",
          handleUploadUrl: "/api/design-request/upload",
        });
        newUrls.push(blob.url);
      }
      setPending((p) => [...p, ...newUrls]);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function sendToClient() {
    if (pending.length === 0) return;
    setPosting(true);
    setMessage("");
    try {
      const res = await fetch(`/api/design-request/${token}/proof`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: pending }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send proof.");
      setProofs((p) => [...p, ...pending]);
      setPending([]);
      setMessage("Proof sent! Client has been emailed.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setPosting(false);
    }
  }

  async function copyStatus() {
    await navigator.clipboard.writeText(statusUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-8">
      <header>
        <span className="display text-brand text-sm">{reference} · {status.replace(/_/g, " ")}</span>
        <h1 className="display text-3xl sm:text-4xl text-foreground mt-1">{teamName}</h1>
      </header>

      <section className="bg-steel border border-line p-5 grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <div>
          <div className="display text-foreground text-xs">Contact</div>
          <div className="text-muted">{contact.name}</div>
          <div className="text-muted">{contact.email}</div>
          {contact.phone && <div className="text-muted">{contact.phone}</div>}
        </div>
        {colors && (
          <div>
            <div className="display text-foreground text-xs">Colors</div>
            <div className="text-muted">{colors}</div>
          </div>
        )}
        {vision && (
          <div className="sm:col-span-2">
            <div className="display text-foreground text-xs">Vision</div>
            <p className="text-muted whitespace-pre-line">{vision}</p>
          </div>
        )}
        <div className="sm:col-span-2">
          <div className="display text-foreground text-xs mb-2">Client status link (share to track)</div>
          <div className="flex gap-2">
            <input readOnly value={statusUrl} className="flex-1 bg-ink border border-line px-3 py-2 text-xs text-foreground/80" />
            <button onClick={copyStatus} className="clip-slant bg-brand text-on-brand display text-xs px-4 py-2 hover:bg-brand-dark">
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>
        </div>
      </section>

      {inspirationImages.length > 0 && (
        <section>
          <h2 className="display text-xl text-foreground">Inspiration from client</h2>
          <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
            {inspirationImages.map((u, i) => (
              <a key={i} href={u} target="_blank" rel="noopener noreferrer" className="relative aspect-square bg-steel border border-line overflow-hidden block">
                {/\.(png|jpe?g|webp|gif)$/i.test(u) ? (
                  <Image src={u} alt={`Inspiration ${i + 1}`} fill sizes="20vw" className="object-cover" unoptimized />
                ) : (
                  <div className="absolute inset-0 grid place-items-center text-xs text-muted p-2 text-center">PDF</div>
                )}
              </a>
            ))}
          </div>
        </section>
      )}

      {proofs.length > 0 && (
        <section>
          <h2 className="display text-xl text-foreground">Sent proofs</h2>
          <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
            {proofs.map((u, i) => (
              <a key={i} href={u} target="_blank" rel="noopener noreferrer" className="relative aspect-square bg-white border border-line overflow-hidden block">
                <Image src={u} alt={`Proof ${i + 1}`} fill sizes="20vw" className="object-contain p-1" unoptimized />
              </a>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="display text-xl text-foreground">Upload a proof</h2>
        <p className="text-sm text-muted mt-1">Add one or more proof images. When you click "Send to Client", they're emailed a link to approve.</p>

        <label className="mt-3 block cursor-pointer border-2 border-dashed border-line hover:border-brand/50 transition-colors p-6 text-center bg-steel">
          <input type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
          <span className="display text-foreground">{uploading ? "Uploading..." : "Click or drop proof files"}</span>
        </label>

        {pending.length > 0 && (
          <div className="mt-3 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
            {pending.map((u, i) => (
              <div key={i} className="relative aspect-square bg-white border border-line overflow-hidden">
                <Image src={u} alt={`Pending proof ${i + 1}`} fill sizes="20vw" className="object-contain p-1" unoptimized />
              </div>
            ))}
          </div>
        )}

        {message && <p className="mt-3 text-sm text-brand">{message}</p>}

        <button
          onClick={sendToClient}
          disabled={pending.length === 0 || posting}
          className="mt-4 clip-slant bg-brand hover:bg-brand-dark text-on-brand display text-lg px-6 py-3 transition-colors disabled:opacity-60"
        >
          {posting ? "Sending..." : `Send ${pending.length || ""} Proof${pending.length === 1 ? "" : "s"} to Client`}
        </button>
      </section>
    </div>
  );
}
