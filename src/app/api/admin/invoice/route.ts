import { NextResponse } from "next/server";
import { dbEnabled } from "@/db";
import { requireApiRole } from "@/lib/admin-auth";
import { getDesignerInvoice, getInvoicePaymentReview, markInvoicePaid, voidInvoice } from "@/lib/designer-invoices";
import { postInvoicePaidToDiscord } from "@/lib/discord";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const auth = await requireApiRole("money");
  if (!auth.ok) return NextResponse.json({ error: "Not allowed" }, { status: auth.status });

  let body: { id?: string; action?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ error: "Missing invoice id" }, { status: 400 });

  if (body.action === "paid") {
    const invoice = await getDesignerInvoice(body.id);
    if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    const review = await getInvoicePaymentReview(invoice);
    if (!review.canPay) {
      return NextResponse.json(
        { error: `Payment blocked: ${review.blockers.join("; ")}.`, blockers: review.blockers },
        { status: 409 },
      );
    }
    const row = await markInvoicePaid(body.id, auth.session.name, body.note);
    if (!row) return NextResponse.json({ error: "Already paid or not found" }, { status: 409 });
    await postInvoicePaidToDiscord({ reference: row.reference, totalCents: row.totalCents, method: `manually by ${auth.session.name}`, threadId: row.discordThreadId }).catch(() => {});
    return NextResponse.json({ ok: true });
  }
  if (body.action === "void") {
    const row = await voidInvoice(body.id);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
