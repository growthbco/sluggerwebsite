import { NextResponse } from "next/server";
import { dbEnabled } from "@/db";
import {
  isValidDesignerToken,
  createDesignerInvoice,
  updateDesignerInvoice,
  reconcileInvoice,
  setInvoiceThreadId,
  type DesignerInvoiceLineInput,
} from "@/lib/designer-invoices";
import { postInvoiceToDiscord } from "@/lib/discord";
import { designerInvoices } from "@/db/schema";

export const runtime = "nodejs";

// Ping the invoice channel so someone can pay it (or see an edit). Flags surface
// in the post. Non-fatal - a Discord hiccup never blocks the submit/edit.
async function pingInvoiceDiscord(inv: typeof designerInvoices.$inferSelect, edited = false) {
  try {
    const recon = reconcileInvoice(inv);
    const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const res = await postInvoiceToDiscord({
      reference: inv.reference + (edited ? " (edited)" : ""),
      designerName: inv.designerName,
      subtotalCents: inv.subtotalCents,
      dutyCents: inv.dutyCents,
      previousBalanceCents: inv.previousBalanceCents,
      totalCents: inv.totalCents,
      dutyBps: recon.dutyBps,
      dutyFlag: recon.dutyFlag,
      anyQtyMismatch: recon.anyQtyMismatch,
      anyDoubleBill: recon.anyDoubleBill,
      lineCount: inv.lines.length,
      adminUrl: `${SITE}/admin/invoices`,
    });
    // First submit: remember the thread so the PAID note nests in it later.
    if (!edited && res.threadId && !inv.discordThreadId) {
      await setInvoiceThreadId(inv.id, res.threadId);
    }
  } catch (e) {
    console.error("invoice Discord ping failed:", e);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!dbEnabled()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }
  const { token } = await params;
  if (!isValidDesignerToken(token)) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  let body: {
    designerName?: string;
    lines?: DesignerInvoiceLineInput[];
    dutyCents?: number;
    previousBalanceCents?: number;
    notes?: string;
    vendorRef?: string;
    attachmentUrls?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const lines = Array.isArray(body.lines) ? body.lines.slice(0, 100) : [];
  if (!lines.length) {
    return NextResponse.json({ error: "Add at least one line." }, { status: 400 });
  }

  try {
    const inv = await createDesignerInvoice({
      designerName: body.designerName,
      lines,
      dutyCents: body.dutyCents ?? 0,
      previousBalanceCents: body.previousBalanceCents ?? 0,
      notes: body.notes,
      vendorRef: body.vendorRef,
      attachmentUrls: body.attachmentUrls,
    });

    await pingInvoiceDiscord(inv);
    return NextResponse.json({ ok: true, reference: inv.reference });
  } catch (e) {
    console.error("createDesignerInvoice failed:", e);
    return NextResponse.json({ error: "Could not submit the invoice" }, { status: 500 });
  }
}

// Edit an existing (still-unpaid) invoice from the designer's link.
export async function PATCH(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const { token } = await params;
  if (!isValidDesignerToken(token)) return NextResponse.json({ error: "Link not found" }, { status: 404 });

  let body: {
    invoiceId?: string;
    designerName?: string;
    lines?: DesignerInvoiceLineInput[];
    dutyCents?: number;
    previousBalanceCents?: number;
    notes?: string;
    vendorRef?: string;
    attachmentUrls?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!body.invoiceId) return NextResponse.json({ error: "Missing invoice id." }, { status: 400 });
  const lines = Array.isArray(body.lines) ? body.lines.slice(0, 100) : [];
  if (!lines.length) return NextResponse.json({ error: "Add at least one line." }, { status: 400 });

  try {
    const result = await updateDesignerInvoice(body.invoiceId, {
      designerName: body.designerName,
      lines,
      dutyCents: body.dutyCents ?? 0,
      previousBalanceCents: body.previousBalanceCents ?? 0,
      notes: body.notes,
      vendorRef: body.vendorRef,
      attachmentUrls: body.attachmentUrls,
    });
    if (!result) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
    if ("locked" in result) {
      return NextResponse.json({ error: `This invoice is ${result.status} and can no longer be edited. Contact Slugger.` }, { status: 409 });
    }
    await pingInvoiceDiscord(result, true);
    return NextResponse.json({ ok: true, reference: result.reference });
  } catch (e) {
    console.error("updateDesignerInvoice failed:", e);
    return NextResponse.json({ error: "Could not update the invoice" }, { status: 500 });
  }
}
