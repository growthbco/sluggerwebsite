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

  // If the order is fully paid, show a RECEIPT (verify payment without Stripe)
  // instead of an invoice with pay buttons.
  if (order.invoicePaidAt) {
    const money = (c: number) => `$${(c / 100).toFixed(2)}`;
    const tax = order.taxExempt ? 0 : taxCents(totalCents);
    const ship = order.shippingChargedCents ?? 0;
    const grand = totalCents + tax + ship;
    const paidInFull = Boolean(order.depositPaidAt && Math.abs(+order.invoicePaidAt - +order.depositPaidAt) < 60000);
    const paidDate = order.invoicePaidAt.toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" });
    const itemRows = (quote?.lines ?? [])
      .map((l) => `<tr><td style="padding:6px 14px;">${l.label}${l.quantity > 1 ? ` &times; ${l.quantity}` : ""}</td><td style="padding:6px 14px;text-align:right;">${money(l.totalCents)}</td></tr>`)
      .join("");
    const line = (label: string, val: string, strong = false) =>
      `<tr><td style="padding:6px 14px;border-top:1px solid #eee;${strong ? "font-weight:bold;" : ""}">${label}</td><td style="padding:6px 14px;text-align:right;border-top:1px solid #eee;${strong ? "font-weight:bold;" : ""}">${val}</td></tr>`;
    const receipt = `
      <div style="max-width:640px;margin:24px auto;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;border:1px solid #e5e5e5;">
        <div style="background:#13160b;color:#e8e2d0;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;">
          <div><div style="font-weight:bold;font-size:18px;">Slugger Athletics</div><div style="font-size:12px;opacity:.8;">Receipt · ${order.reference}</div></div>
          <span style="background:#1f8a4c;color:#fff;font-weight:bold;padding:6px 12px;border-radius:4px;font-size:13px;">PAID</span>
        </div>
        <div style="padding:16px 20px;font-size:14px;">
          <p style="margin:0 0 4px;"><strong>${order.teamName}</strong></p>
          <p style="margin:0;color:#666;font-size:13px;">${paidInFull ? "Paid in full" : "Deposit + balance paid"} on ${paidDate}</p>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          ${itemRows}
          ${line("Subtotal", money(totalCents))}
          ${order.taxExempt ? line("Sales tax", "Exempt") : line("FL Sales Tax (7%)", money(tax))}
          ${line("Shipping", ship > 0 ? money(ship) : order.localPickup ? "Local pickup" : "$0.00")}
          ${line("Total paid", money(grand), true)}
        </table>
        <p style="padding:14px 20px;color:#888;font-size:12px;margin:0;">Charged via Stripe to the card on file. This receipt reflects your system's record - no Stripe login needed.</p>
      </div>`;
    const banner = `ADMIN RECEIPT - ${order.teamName} (${order.reference}) is PAID (${money(grand)} total). Emailed contact: ${order.contactEmail}.`;
    return new Response(
      `<div style="background:#123a22;color:#d6f5e2;font-family:sans-serif;font-size:13px;padding:10px 16px;text-align:center;">${banner}</div>${receipt}`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  // Mirror the send route: line items appear on the deposit invoice only.
  let lines = stage === "deposit" && quote ? [...quote.lines] : [];
  if (stage === "deposit" && quote && quote.rushFeeCents > 0) {
    lines.push({ label: "Rush Order Fee (priority production + direct shipping)", quantity: 1, unitPriceCents: quote.rushFeeCents, totalCents: quote.rushFeeCents });
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
    localPickup: order.localPickup,
  });

  const banner = sentUrl
    ? `ADMIN VIEW - copy of the ${stage} invoice emailed to ${order.contactEmail}. Subject: "${subject}"`
    : `ADMIN PREVIEW - this ${stage} invoice has NOT been sent yet; this is what the customer will receive. Numbers reflect the current roster.`;

  return new Response(
    `<div style="background:#1a1a14;color:#e8e2d0;font-family:sans-serif;font-size:13px;padding:10px 16px;text-align:center;">${banner}</div>${html}`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}
