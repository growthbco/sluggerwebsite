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
  products: string | null;
  estimatedPieces: string | null;
  vision: string | null;
  colors: string | null;
  colorHexes: string[];
  contact: { name: string; email: string; phone: string | null };
  source?: string | null;
  inspirationImages: string[];
  proofImages: string[];
  proofLabels?: Record<string, string>;
  designSkus?: Record<string, string>;
  approvedUrls: string[];
  statusUrl: string;
  revisionsUsed: number;
  maxRevisions: number;
  changeRequests: ChangeRequest[];
  rush: boolean;
  priorityReview: boolean;
  neededBy: string | null;
  rushApprovedAt: string | null;
  rushApprovedBy: string | null;
  /** The admin detail page already owns the project title and status summary. */
  showRequestHeader?: boolean;
  // Which slice of this panel to render, so the admin page can put the brief in
  // an "Overview" tab and the proof workflow in a "Proofs" tab from the SAME
  // markup. Omit to render everything (legacy single-scroll).
  view?: "overview" | "proofs";
};

export function DesignManagePanel({
  token,
  reference,
  teamName,
  status,
  products,
  estimatedPieces,
  vision,
  colors,
  colorHexes,
  contact,
  source,
  inspirationImages,
  proofImages,
  proofLabels = {},
  designSkus = {},
  approvedUrls,
  statusUrl,
  revisionsUsed,
  maxRevisions,
  changeRequests,
  rush,
  priorityReview,
  neededBy,
  rushApprovedAt,
  rushApprovedBy,
  showRequestHeader = true,
  view,
}: Props) {
  const showOverview = view !== "proofs";
  const showProofs = view !== "overview";
  const [proofs, setProofs] = useState<string[]>(proofImages);
  const [labels, setLabels] = useState<Record<string, string>>(proofLabels);
  const [skus, setSkus] = useState<Record<string, string>>(designSkus);
  const [savingMeta, setSavingMeta] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [approved, setApproved] = useState<string[]>(approvedUrls);
  const [settingApproved, setSettingApproved] = useState<string | null>(null);
  const [approvedMessage, setApprovedMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [pending, setPending] = useState<string[]>([]);
  const [pendingLabels, setPendingLabels] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [rushOk, setRushOk] = useState<{ by: string } | null>(rushApprovedAt ? { by: rushApprovedBy ?? "staff" } : null);
  const [rushName, setRushName] = useState("");
  const [rushBusy, setRushBusy] = useState(false);
  const [rushError, setRushError] = useState("");

  async function approveRush() {
    setRushBusy(true);
    setRushError("");
    try {
      const res = await fetch(`/api/design-request/${token}/rush`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: rushName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not approve");
      setRushOk({ by: data.rushApprovedBy });
    } catch (e) {
      setRushError((e as Error).message);
    } finally {
      setRushBusy(false);
    }
  }
  const [dragOver, setDragOver] = useState(false);

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
      setPendingLabels((l) => [...l, ...newUrls.map(() => "")]);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function removeProof(url: string) {
    setRemoving(url);
    setMessage("");
    try {
      const res = await fetch(`/api/design-request/${token}/proof`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Could not remove proof.");
      setProofs((p) => p.filter((u) => u !== url));
      setApproved((a) => a.filter((u) => u !== url));
      setLabels((l) => { const n = { ...l }; delete n[url]; return n; });
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setRemoving(null);
    }
  }

  async function sendToClient() {
    if (pending.length === 0) return;
    setPosting(true);
    setMessage("");
    try {
      const labels: Record<string, string> = {};
      pending.forEach((u, i) => { const t = (pendingLabels[i] ?? "").trim(); if (t) labels[u] = t; });
      const res = await fetch(`/api/design-request/${token}/proof`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: pending, labels }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send proof.");
      setProofs((p) => [...p, ...pending]);
      setPending([]);
      setPendingLabels([]);
      // Show the REAL delivery outcome (email/text/failed), not a fixed message.
      setMessage(data.notice ? `Proof uploaded. ${data.notice}` : "Proof sent to the client.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setPosting(false);
    }
  }

  async function saveMeta(url: string) {
    setSavingMeta(url);
    try {
      const res = await fetch(`/api/design-request/${token}/design-meta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, label: labels[url] ?? "", sku: skus[url] ?? "" }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Could not save");
    } catch (e) {
      setApprovedMessage((e as Error).message);
    } finally {
      setSavingMeta(null);
    }
  }

  async function toggleApproved(url: string, next: boolean) {
    setSettingApproved(url);
    setApprovedMessage("");
    try {
      const res = await fetch(`/api/design-request/${token}/set-approved`, {
        // include the current label so the server can enforce naming on approve
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, approved: next, label: labels[url] ?? "" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update the approved designs.");
      setApproved(data.urls ?? []);
      setApprovedMessage(
        next
          ? "Added to approved designs. The Discord thread was pinged with this exact image."
          : "Removed from approved designs. The Discord thread was updated.",
      );
    } catch (e) {
      setApprovedMessage((e as Error).message);
    } finally {
      setSettingApproved(null);
    }
  }

  async function copyStatus() {
    await navigator.clipboard.writeText(statusUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const neededStr = neededBy
    ? new Date(neededBy).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "long", day: "numeric", year: "numeric" })
    : null;
  return (
    <div className="space-y-8">
      {showOverview && rush && (
        <div className="border-2 border-red-500 bg-red-500/10 p-5">
          <p className="display text-2xl sm:text-3xl text-red-400">{priorityReview ? "PRIORITY REVIEW" : "2-WEEK RUSH"}{neededStr ? ` - NEEDED BY ${neededStr.toUpperCase()}` : ""}</p>
          <p className="mt-2 text-sm text-foreground">
            {priorityReview
              ? "This deadline is inside the two-week rush window. Quote the internal one-week priority upgrade manually and get approval before promising any date."
              : "Two-week rush production is a flat $100 fee. Shipping time is additional. "}
            {!priorityReview && (rushOk ? "Rush service is confirmed." : <strong>Do NOT promise the requested in-hand date until the full timeline is reviewed.</strong>)}
          </p>
          {priorityReview ? (
            <p className="mt-3 display text-amber-300">Manual premium price + owner approval required</p>
          ) : rushOk ? (
            <p className="mt-3 display text-green-400">Timeline approved by {rushOk.by}</p>
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <select
                value={rushName}
                onChange={(e) => setRushName(e.target.value)}
                className="bg-ink border border-line px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none"
              >
                <option value="">Who&apos;s approving?</option>
                {["Gary", "Justin", "Bonans"].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <button
                type="button"
                onClick={approveRush}
                disabled={!rushName || rushBusy}
                className="clip-slant bg-red-500 hover:bg-red-600 text-white display text-sm px-5 py-2 disabled:opacity-50"
              >
                {rushBusy ? "Approving..." : "Approve 2-week rush service"}
              </button>
              {rushError && <span className="text-sm text-red-400">{rushError}</span>}
            </div>
          )}
        </div>
      )}
      {showOverview && (
      <>
      {showRequestHeader && <header>
        <span className="display text-brand text-sm">{reference} · {status.replace(/_/g, " ")}</span>
        <h1 className="display text-3xl sm:text-4xl text-foreground mt-1">{teamName}</h1>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {rush && (
            <span className="inline-block clip-slant bg-brand text-on-brand display px-3 py-1">
              RUSH {neededBy ? `· needed by ${new Date(neededBy).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" })}` : ""}
            </span>
          )}
          {!rush && neededBy && (
            <span className="inline-block border border-line text-muted display px-3 py-1">
              Needed by {new Date(neededBy).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" })}
            </span>
          )}
          <span className="inline-block border border-line text-muted display px-3 py-1">
            Revisions: {revisionsUsed} / {maxRevisions}
          </span>
        </div>
      </header>}

      <section className="bg-steel border border-line p-5 grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <div>
          <div className="display text-foreground text-xs">Contact</div>
          <div className="text-muted">{contact.name}</div>
          <div className="text-muted">{contact.email}</div>
          {contact.phone && <div className="text-muted">{contact.phone}</div>}
          {source && (
            <div className="mt-1 text-xs text-muted">
              <span className="text-foreground">Source:</span> {source}
            </div>
          )}
        </div>
        {products && (
          <div className="sm:col-span-2">
            <div className="display text-foreground text-xs">Mock up</div>
            <div className="text-foreground">{products}</div>
          </div>
        )}
        {estimatedPieces && (
          <div>
            <div className="display text-foreground text-xs">Approx. pieces</div>
            <div className="text-foreground">{estimatedPieces}</div>
          </div>
        )}
        {(colors || colorHexes.length > 0) && (
          <div>
            <div className="display text-foreground text-xs">Colors</div>
            {colorHexes.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-2">
                {colorHexes.map((hex) => (
                  <span key={hex} className="inline-flex items-center gap-1.5 border border-line px-1.5 py-1">
                    <span className="h-4 w-4 border border-line" style={{ backgroundColor: hex }} />
                    <span className="text-muted text-xs font-mono">{hex}</span>
                  </span>
                ))}
              </div>
            )}
            {colors && <div className="text-muted mt-1">{colors}</div>}
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
              {copied ? "Copied " : "Copy"}
            </button>
          </div>
        </div>
      </section>
      </>
      )}

      {showProofs && inspirationImages.length > 0 && (
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

      {showProofs && changeRequests.length > 0 && (
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
                    <span className="text-xs text-muted">{new Date(cr.at).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
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

      {showProofs && approved.length > 0 && (
        <section>
          <h2 className="display text-xl text-green-400">Approved designs ({approved.length})</h2>
          <p className="text-sm text-muted mt-1">
            Name each one - the <strong className="text-foreground">name + SKU</strong> is what players see when picking a design and what a team store uses, so there&apos;s no confusion which jersey is which. Edit anytime, like inventory.
          </p>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {approved.map((u, i) => (
              <div key={u} className="border border-green-500 bg-steel">
                <a href={u} target="_blank" rel="noopener noreferrer" className="relative aspect-[4/3] bg-white overflow-hidden block">
                  <Image src={u} alt={labels[u] || `Approved design ${i + 1}`} fill sizes="33vw" className="object-contain p-1" unoptimized />
                  <span className="absolute top-1 left-1 bg-green-600 text-white display text-[10px] px-1.5 py-0.5">APPROVED</span>
                </a>
                <div className="p-2 space-y-2">
                  <div>
                    <label className="text-[10px] display text-muted">Name</label>
                    <input
                      value={labels[u] ?? ""}
                      onChange={(e) => setLabels((l) => ({ ...l, [u]: e.target.value }))}
                      placeholder={`e.g. Home Black`}
                      maxLength={60}
                      className="mt-0.5 w-full bg-ink border border-line px-2 py-1.5 text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] display text-muted">SKU / item #</label>
                    <input
                      value={skus[u] ?? ""}
                      onChange={(e) => setSkus((s) => ({ ...s, [u]: e.target.value }))}
                      placeholder="auto-assigned"
                      maxLength={40}
                      className="mt-0.5 w-full bg-ink border border-line px-2 py-1.5 text-sm font-mono text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => saveMeta(u)} disabled={savingMeta !== null}
                      className="flex-1 text-xs display text-on-brand bg-brand hover:bg-brand-dark px-2 py-1.5 rounded disabled:opacity-50">
                      {savingMeta === u ? "Saving…" : "Save"}
                    </button>
                    <button type="button" onClick={() => toggleApproved(u, false)} disabled={settingApproved !== null}
                      className="text-xs display text-muted border border-line px-2 py-1.5 hover:text-red-400 disabled:opacity-50">
                      {settingApproved === u ? "…" : "Unapprove"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {approvedMessage && <p className="mt-2 text-sm text-brand">{approvedMessage}</p>}
        </section>
      )}

      {showProofs && proofs.length > 0 && (
        <section>
          <h2 className="display text-xl text-foreground">Sent proofs</h2>
          <p className="text-sm text-muted mt-1">
            Mark each final mockup the client approved - it moves up into the Approved designs
            section and pings the Discord thread with that exact image.
          </p>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {proofs.filter((u) => !approved.includes(u)).map((u, i) => (
              <div key={u} className="border border-line">
                <a href={u} target="_blank" rel="noopener noreferrer" className="relative aspect-square bg-white overflow-hidden block">
                  <Image src={u} alt={labels[u] || `Proof ${i + 1}`} fill sizes="25vw" className="object-contain p-1" unoptimized />
                </a>
                <input
                  value={labels[u] ?? ""}
                  onChange={(e) => setLabels((l) => ({ ...l, [u]: e.target.value }))}
                  placeholder="Name this design (optional - only if multiple)"
                  maxLength={60}
                  className="w-full bg-ink border-t border-line px-2 py-1.5 text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
                />
                <div className="flex border-t border-line">
                  <button
                    type="button"
                    onClick={() => toggleApproved(u, true)}
                    disabled={settingApproved !== null || removing !== null}
                    className="flex-1 text-[11px] display text-muted px-1 py-1.5 hover:text-foreground hover:bg-steel disabled:opacity-50"
                    title="Approve this design"
                  >
                    {settingApproved === u ? "Saving..." : "Mark approved"}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeProof(u)}
                    disabled={removing !== null || settingApproved !== null}
                    className="text-[11px] display text-muted border-l border-line px-2 py-1.5 hover:text-red-400 hover:bg-steel disabled:opacity-50"
                    title="Remove this proof"
                  >
                    {removing === u ? "…" : "Remove"}
                  </button>
                </div>
              </div>
            ))}
          </div>
          {proofs.length > 0 && proofs.every((u) => approved.includes(u)) && (
            <p className="mt-2 text-sm text-muted">All sent proofs are marked approved.</p>
          )}
          {approvedMessage && <p className="mt-2 text-sm text-brand">{approvedMessage}</p>}
        </section>
      )}

      {showProofs && (
      <section>
        <h2 className="display text-xl text-foreground">Upload a proof</h2>
        <p className="text-sm text-muted mt-1">Add one or more proof images. When you click &quot;Send to Client,&quot; they&apos;re emailed a link to approve.</p>

        <label
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
          className={`mt-3 block cursor-pointer border-2 border-dashed transition-colors p-8 text-center ${dragOver ? "border-brand bg-brand/10" : "border-line hover:border-brand/50 bg-steel"}`}
        >
          <input type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
          <span className="display text-foreground">{uploading ? "Uploading..." : dragOver ? "Drop to upload" : "Drag & drop proof files here, or click to browse"}</span>
        </label>

        {pending.length > 0 && (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {pending.map((u, i) => (
              <div key={i}>
                <div className="relative aspect-square bg-white border border-line overflow-hidden">
                  <Image src={u} alt={`Pending proof ${i + 1}`} fill sizes="20vw" className="object-contain p-1" unoptimized />
                </div>
                <input
                  value={pendingLabels[i] ?? ""}
                  onChange={(e) => setPendingLabels((l) => l.map((v, j) => (j === i ? e.target.value : v)))}
                  placeholder={`Label (e.g. Practice Jersey ${i + 1})`}
                  maxLength={60}
                  className="mt-1.5 w-full bg-steel border border-line px-2 py-1.5 text-sm text-foreground placeholder:text-muted/60 focus:border-brand focus:outline-none"
                />
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
      )}
    </div>
  );
}
