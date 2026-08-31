import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { teamOrders } from "@/db/schema";
import { getByManageToken } from "@/lib/team-orders";
import { sendTeamOrderInvoice } from "@/lib/team-order-invoicing";

export const runtime = "nodejs";

type Address = {
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: "US";
};

function cleanAddress(value: unknown): Address | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const address: Address = {
    line1: String(input.line1 ?? "").trim().slice(0, 120),
    line2: String(input.line2 ?? "").trim().slice(0, 120),
    city: String(input.city ?? "").trim().slice(0, 80),
    state: String(input.state ?? "").trim().slice(0, 40),
    postalCode: String(input.postalCode ?? "").trim().slice(0, 20),
    country: "US",
  };
  return address.line1 && address.city && address.state && address.postalCode ? address : null;
}

/** Customer changes this order between direct shipping and free Ocala pickup.
 * If an unpaid Stripe invoice already exists, replace it so checkout cannot
 * charge shipping or request an address that disagrees with the saved choice. */
export async function PATCH(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!dbEnabled()) return NextResponse.json({ error: "Not available" }, { status: 503 });

  const { token } = await params;
  const order = await getByManageToken(token);
  if (!order) return NextResponse.json({ error: "Link not found" }, { status: 404 });
  if (order.shippedAt || order.deliveredAt || order.status === "shipped") {
    return NextResponse.json({ error: "Fulfillment has started, so delivery is locked. Text us and we will help." }, { status: 409 });
  }
  let body: { localPickup?: boolean; address?: unknown } = {};
  try { body = await req.json(); } catch {}
  if (typeof body.localPickup !== "boolean") {
    return NextResponse.json({ error: "Choose shipping or local pickup." }, { status: 400 });
  }

  const deliveryChanged = body.localPickup !== order.localPickup;
  if (deliveryChanged && (order.depositPaidAt || order.invoicePaidAt)) {
    return NextResponse.json({ error: "Payment has already started this order. Text us before changing delivery so we can review the invoice and fulfillment plan." }, { status: 409 });
  }

  const address = body.localPickup ? null : cleanAddress(body.address) ?? order.shippingAddress;
  if (!body.localPickup && (!address?.line1 || !address.city || !address.state || !address.postalCode)) {
    return NextResponse.json({ error: "Please fill in street, city, state, and ZIP before selecting shipping." }, { status: 400 });
  }

  const db = getDb();
  await db
    .update(teamOrders)
    .set({
      localPickup: body.localPickup,
      ...(address ? { shippingAddress: address } : {}),
      ...(deliveryChanged ? { shippingChargedCents: null } : {}),
      updatedAt: new Date(),
    })
    .where(eq(teamOrders.id, order.id));

  let invoiceReissued = false;
  if (deliveryChanged) {
    const stage = order.depositPaidAt && order.balanceInvoiceUrl
      ? "balance"
      : !order.depositPaidAt && order.invoiceUrl
        ? "deposit"
        : null;
    if (stage) {
      const result = await sendTeamOrderInvoice({
        teamOrderId: order.id,
        stage,
        ...(stage === "balance" ? { ship: body.localPickup ? "pickup" as const : "auto" as const } : {}),
      });
      if (!result.ok) {
        await db
          .update(teamOrders)
          .set({
            localPickup: order.localPickup,
            shippingAddress: order.shippingAddress,
            shippingChargedCents: order.shippingChargedCents,
            updatedAt: new Date(),
          })
          .where(eq(teamOrders.id, order.id));
        return NextResponse.json({ error: `Delivery was not changed because the payment link could not be updated: ${result.error}` }, { status: result.status });
      }
      invoiceReissued = true;
    }
  }

  return NextResponse.json({ ok: true, localPickup: body.localPickup, address, invoiceReissued });
}
