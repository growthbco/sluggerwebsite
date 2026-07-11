"use client";

import { useState } from "react";
import Image from "next/image";
import { upload } from "@vercel/blob/client";

type Annotation = { n: number; x: number; y: number; note: string };
type ChangeRequest = {
  at: string;
  proofImageUrl?: string;
  generalNote?: string;
  annotations?: Annotation[];
};

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
  revisionsUsed: number;
  maxRevisions: number;
  changeRequests: ChangeRequest[];
  rush: boolean;
  neededBy: string | null;
};

export function DesignManagePanel({
  token,
  reference,
  teamName,
  status,
  vision,
  colors,
  contact,
  inspirationImages,
  proofImages,
  statusUrl,
  revisionsUsed,
  maxRevisions,
  changeRequests,
  rush,
  neededBy,
}: Props) {
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
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {rush && (
            <span className="inline-block clip-slant bg-brand text-on-brand display px-3 py-1">
              🚨 RUSH {neededBy ? `· needed by ${new Date(neededBy).toLocaleDateString()}` : ""}
            </span>
          )}
          {!rush && neededBy && (
            <span className="inline-block border border-line text-muted display px-3 py-1">
              Needed by {new Date(neededBy).toLocaleDateString()}
            </span>
          )}
          <span className="inline-block border border-line text-muted display px-3 py-1">
            Revisions: {revisionsUsed} / {maxRevisions}
          </span>
        </div>
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

      {changeRequests.length > 0 && (
        <section>
          <h2 className="display text-xl text-foreground">Change requests ({changeRequests.length})</h2>
          <p className="text-sm text-muted mt-1">Latest first. Pins are tied to specific spots on the proof.</p>
          <div className="mt-4 space-y-6">
            {[...changeRequests].reverse().map((cr, ridx) => {
              const round = changeRequests.length - ridx;
              return (
                <div key={cr.at + ridx} className="bg-steel border border-line p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="display text-foreground text-sm">Round {round}</span>
                    <span className="text-xs text-muted">{new Date(cr.at).toLocaleString()}</span>
                  </div>
                  {cr.proofImageUrl && (
                    <div className="relative bg-white border border-line w-full" style={{ aspectRatio: "4 / 3" }}>
                      <Image src={cr.proofImageUrl} alt={`Round ${round} proof`} fill sizes="(max-width: 768px) 100vw, 700px" className="object-contain p-2" unoptimized />
                      {(cr.annotations ?? []).map((a) => (
                        <span
                          key={a.n}
                          className="group absolute -translate-x-1/2 -translate-y-1/2 grid place-items-center h-7 w-7 rounded-full bg-brand text-on-brand display text-xs shadow-lg ring-2 ring-on-brand cursor-default"
                          style={{ left: `${a.x}%`, top: `${a.y}%` }}
                        >
                          {a.n}
                          {a.note && (
                            <span
                              className={`pointer-events-none absolute z-10 w-max max-w-60 bg-ink text-foreground text-xs font-normal leading-snug text-left px-3 py-2 border border-line shadow-xl opacity-0 group-hover:opacity-100 transition-opacity ${
                                a.y < 18 ? "top-full mt-2" : "bottom-full mb-2"
                              } ${a.x < 15 ? "left-0" : a.x > 85 ? "right-0" : "left-1/2 -translate-x-1/2"}`}
                            >
                              {a.note}
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                  {(cr.annotations?.length ?? 0) > 0 && (
                    <ol className="mt-3 space-y-1.5 text-sm">
                      {cr.annotations!.map((a) => (
                        <li key={a.n} className="flex gap-3">
                          <span className="shrink-0 grid place-items-center h-6 w-6 rounded-full bg-brand text-on-brand display text-xs">{a.n}</span>
                          <span className="text-foreground/90">{a.note}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                  {cr.generalNote && (
                    <p className="mt-3 text-sm text-muted whitespace-pre-line border-l-2 border-brand/60 pl-3">{cr.generalNote}</p>
                  )}
                </div>
              );
            })}
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
