import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { teamOrders } from "@/db/schema";
import { getRoster } from "@/lib/team-orders";
import { computeTeamOrderQuote } from "@/lib/team-order-pricing";
import { taxCents } from "@/lib/pricing";
import { renderTeamOrderInvoice } from "@/lib/email";
import { isAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

// Admin-only: render a copy of the invoice email the customer received (or,
// before anything is sent, a preview of what the deposit invoice will say).
// Numbers are rebuilt with the same logic as the send route; the pay links
// are the stored Stripe links, so this page mirrors the customer's email.
export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const db = getDb();
  const [order] = await db.select().from(teamOrders).where(eq(teamOrders.id, id)).limit(1);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Latest stage by default: balance once that invoice exists, else deposit.
  const stageParam = url.searchParams.get("stage");
  const stage: "deposit" | "balance" =
    stageParam === "deposit" || stageParam === "balance"
      ? stageParam
      : order.balanceInvoiceUrl
        ? "balance"
        : "deposit";

  const roster = await getRoster(order.id);
  const quote = roster.length ? computeTeamOrderQuote(order, roster) : null;

  const totalCents = order.quotedTotalCents ?? quote?.totalCents ?? 0;
  if (totalCents <= 0) {
    return new Response("<p style='font-family:sans-serif;padding:2rem;'>No roster / nothing to invoice yet for this order.</p>", {
      headers: { "Content-Type": "text/html" },
    });
  }
  const depositCents = order.depositCents ?? Math.round(totalCents / 2);
  const dueCents = stage === "deposit" ? depositCents : totalCents - depositCents;

  // Mirror the send route: line items appear on the deposit invoice only.
  let lines = stage === "deposit" && quote ? [...quote.lines] : [];
  if (stage === "deposit" && quote && quote.rushFeeCents > 0) {
    lines.push({ label: "Rush production ($5/item)", quantity: 1, unitPriceCents: quote.rushFeeCents, totalCents: quote.rushFeeCents });
  }

  const sentUrl = stage === "deposit" ? order.invoiceUrl : order.balanceInvoiceUrl;
  const { subject, html } = renderTeamOrderInvoice({
    teamName: order.teamName,
    reference: order.reference,
    stage,
    lines,
    totalCents,
    dueCents,
    taxDueCents: order.taxExempt ? 0 : taxCents(dueCents),
    taxExempt: order.taxExempt,
    shipCents: stage === "balance" ? order.shippingChargedCents ?? 0 : 0,
    roster: roster.map((r) => ({
      name: (r.playerName ?? "").trim(),
      number: (r.playerNumber ?? "").trim(),
      size: (r.sizes?.jersey ?? r.size ?? "").trim(),
    })),
    payUrl: sentUrl ?? "#",
    payFullUrl: stage === "deposit" ? order.fullInvoiceUrl ?? undefined : undefined,
  });

  const banner = sentUrl
    ? `ADMIN VIEW - copy of the ${stage} invoice emailed to ${order.contactEmail}. Subject: "${subject}"`
    : `ADMIN PREVIEW - this ${stage} invoice has NOT been sent yet; this is what the customer will receive. Numbers reflect the current roster.`;

  return new Response(
    `<div style="background:#1a1a14;color:#e8e2d0;font-family:sans-serif;font-size:13px;padding:10px 16px;text-align:center;">${banner}</div>${html}`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}
