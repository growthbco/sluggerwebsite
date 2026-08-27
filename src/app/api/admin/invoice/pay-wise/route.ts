import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { designerInvoices } from "@/db/schema";
import { requireApiRole } from "@/lib/admin-auth";
import { payDesigner, wiseEnabled, wisePayoutCapCents } from "@/lib/wise";
import { postInvoicePaidToDiscord } from "@/lib/discord";

export const runtime = "nodejs";
export const maxDuration = 60;

// Admin-only: pay a submitted designer invoice via Wise (from our USD balance
// to the vendor's PKR account). Money moves inside payDesigner's funding step.
export async function POST(req: Request) {
  const gate = await requireApiRole("money");
  if (!gate.ok) return NextResponse.json({ error: gate.status === 403 ? "Forbidden" : "Unauthorized" }, { status: gate.status });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  if (!wiseEnabled()) return NextResponse.json({ error: "Wise is not configured yet." }, { status: 503 });

  let body: { invoiceId?: string } = {};
  try { body = await req.json(); } catch {}
  if (!body.invoiceId) return NextResponse.json({ error: "Missing invoice id." }, { status: 400 });

  const db = getDb();
  const [inv] = await db.select().from(designerInvoices).where(eq(designerInvoices.id, body.invoiceId)).limit(1);
  if (!inv) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  if (inv.status !== "submitted") return NextResponse.json({ error: `This invoice is ${inv.status} - it can't be paid.` }, { status: 409 });
  if (inv.totalCents > wisePayoutCapCents()) {
    return NextResponse.json({ error: `$${(inv.totalCents / 100).toFixed(2)} is over the $${(wisePayoutCapCents() / 100).toFixed(0)} Wise limit - pay this one manually in the Wise app.` }, { status: 422 });
  }

  // CLAIM the invoice atomically (submitted -> paid) BEFORE paying so a
  // double-click or concurrent request can't send twice. If the payout fails,
  // we revert it back to submitted below.
  const claimed = await db
    .update(designerInvoices)
    .set({ status: "paid", paidAt: new Date(), paidBy: "Wise", paymentNote: "Wise payout in progress" })
    .where(and(eq(designerInvoices.id, inv.id), eq(designerInvoices.status, "submitted")))
    .returning({ id: designerInvoices.id });
  if (!claimed.length) return NextResponse.json({ error: "This invoice is already paid or being paid." }, { status: 409 });

  const result = await payDesigner({ amountCents: inv.totalCents, reference: inv.reference });

  if (!result.ok) {
    // Roll the claim back so it can be retried or paid by hand.
    await db
      .update(designerInvoices)
      .set({ status: "submitted", paidAt: null, paidBy: null, paymentNote: null })
      .where(eq(designerInvoices.id, inv.id));
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  // Finalize the record with the Wise transfer id.
  await db
    .update(designerInvoices)
    .set({ paidBy: "Wise", paymentNote: `Paid via Wise - transfer ${result.transferId} (${result.targetAmount} ${result.targetCurrency})` })
    .where(eq(designerInvoices.id, inv.id));

  await postInvoicePaidToDiscord({
    reference: inv.reference,
    totalCents: inv.totalCents,
    method: "via Wise",
    detail: `transfer ${result.transferId} · ${result.targetAmount} ${result.targetCurrency}`,
    threadId: inv.discordThreadId, // nest in the invoice's original thread
  }).catch(() => {});

  return NextResponse.json({ ok: true, transferId: result.transferId, targetAmount: result.targetAmount, targetCurrency: result.targetCurrency });
}
