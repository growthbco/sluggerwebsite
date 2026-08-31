import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { teamOrders } from "@/db/schema";
import { getRoster, ensureTeamOrderDiscordThread } from "@/lib/team-orders";
import { computeTeamOrderQuote } from "@/lib/team-order-pricing";
import { postTeamOrderPaidToDiscord } from "@/lib/discord";
import { setThreadStageTag, unarchiveDiscordThread } from "@/lib/discord-bot";
import { requireApiRole } from "@/lib/admin-auth";

export const runtime = "nodejs";

const METHODS = ["Zelle", "CashApp", "Cash", "Check", "Venmo", "Other"];

// Admin-only: record an OFFLINE payment (Zelle, CashApp, cash...) so the
// order moves through the same states a Stripe payment would - deposit
// starts production, full/balance marks it paid and unlocks shipping.
export async function POST(req: Request) {
  const gate = await requireApiRole("money");
  if (!gate.ok) return NextResponse.json({ error: gate.status === 403 ? "Forbidden" : "Unauthorized" }, { status: gate.status });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  let body: { teamOrderId?: string; stage?: string; method?: string; amountCents?: number } = {};
  try { body = await req.json(); } catch {}
  const stage = body.stage === "deposit" || body.stage === "full" || body.stage === "balance" ? body.stage : null;
  if (!body.teamOrderId || !stage) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const method = METHODS.includes(body.method ?? "") ? body.method! : "Other";

  const db = getDb();
  const [order] = await db.select().from(teamOrders).where(eq(teamOrders.id, body.teamOrderId)).limit(1);
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (order.invoicePaidAt) return NextResponse.json({ error: "Already paid in full." }, { status: 409 });
  if (stage === "deposit" && order.rushShipping && !order.depositPaidAt) {
    return NextResponse.json({ error: "Rush orders require full payment before production. Record this as paid in full." }, { status: 409 });
  }
  if (stage === "deposit" && order.depositPaidAt) {
    return NextResponse.json({ error: "Deposit already recorded - record the balance instead." }, { status: 409 });
  }
  if (stage === "balance" && !order.depositPaidAt) {
    return NextResponse.json({ error: "No deposit on record - record it as deposit or paid in full." }, { status: 409 });
  }

  // Lock in the quote like the invoice flow does, so later balance math works.
  const roster = await getRoster(order.id);
  const quotedTotalCents =
    order.quotedTotalCents ?? (roster.length ? computeTeamOrderQuote(order, roster).totalCents : 0);
  const depositCents = order.depositCents ?? (quotedTotalCents ? Math.round(quotedTotalCents / 2) : 0);
  const paidCents =
    body.amountCents && body.amountCents > 0
      ? Math.round(body.amountCents)
      : stage === "deposit"
        ? depositCents
        : stage === "balance"
          ? quotedTotalCents - depositCents
          : quotedTotalCents;

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" });
  const noteLine = `${stage} via ${method} - $${(paidCents / 100).toFixed(2)} (${dateStr})`;
  const paymentNote = [order.paymentNote, noteLine].filter(Boolean).join("; ");

  await db
    .update(teamOrders)
    .set(
      stage === "deposit"
        ? {
            status: "in_production",
            depositPaidAt: now,
            quotedTotalCents: quotedTotalCents || null,
            // The ACTUAL amount received - a custom partial payment must
            // reduce the balance by what was really paid, not by half.
            depositCents: paidCents || depositCents || null,
            paymentNote,
            invoiceRemindersSent: 0,
            archivedAt: null,
            archivedNote: null,
            updatedAt: now,
          }
        : {
            status: "paid",
            invoicePaidAt: now,
            ...(stage === "full" ? { depositPaidAt: now } : {}),
            quotedTotalCents: quotedTotalCents || null,
            paymentNote,
            invoiceRemindersSent: 0,
            archivedAt: null,
            archivedNote: null,
            updatedAt: now,
          },
    )
    .where(eq(teamOrders.id, order.id));

  // Same Discord moment a Stripe payment gets, plus a heads-up that any
  // previously emailed Stripe links are now stale.
  const discordThreadId = await ensureTeamOrderDiscordThread(order.id);
  await unarchiveDiscordThread(discordThreadId);
  await postTeamOrderPaidToDiscord({
    reference: order.reference,
    teamName: order.teamName,
    totalCents: paidCents,
    stage: stage === "deposit" ? "deposit" : "balance",
    designThreadId: discordThreadId,
    details: `Recorded manually by staff - paid via **${method}** (not Stripe).${
      order.invoiceUrl || order.balanceInvoiceUrl
        ? " A Stripe invoice link was previously sent - let the customer know to ignore it."
        : ""
    }`,
    finalRoster: stage === "deposit" || stage === "full"
      ? {
          items: order.items ?? ["jersey"],
          sport: order.sport ?? undefined,
          roster: roster.map((entry) => ({
            name: entry.playerName ?? undefined,
            number: entry.playerNumber ?? undefined,
            size: entry.size ?? undefined,
            sizes: entry.sizes ?? undefined,
            design: entry.design ?? undefined,
            notes: entry.notes ?? undefined,
            quantity: entry.quantity,
          })),
        }
      : undefined,
  });

  await setThreadStageTag(discordThreadId, stage === "deposit" ? "💰 Deposit Paid" : "💸 Paid in Full");

  return NextResponse.json({ ok: true, stage, method, paidCents, paymentNote });
}
