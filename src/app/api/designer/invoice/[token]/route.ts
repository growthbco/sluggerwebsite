import { NextResponse } from "next/server";
import { dbEnabled } from "@/db";
import {
  isValidDesignerToken,
  createDesignerInvoice,
  reconcileInvoice,
  type DesignerInvoiceLineInput,
} from "@/lib/designer-invoices";
import { postInvoiceToDiscord } from "@/lib/discord";

export const runtime = "nodejs";

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
    });

    // Ping the invoice channel so someone can pay it. Flags surface in the post.
    try {
      const recon = reconcileInvoice(inv);
      const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
      await postInvoiceToDiscord({
        reference: inv.reference,
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
    } catch (e) {
      console.error("invoice Discord ping failed:", e);
    }

    return NextResponse.json({ ok: true, reference: inv.reference });
  } catch (e) {
    console.error("createDesignerInvoice failed:", e);
    return NextResponse.json({ error: "Could not submit the invoice" }, { status: 500 });
  }
}
