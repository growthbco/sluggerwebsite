import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { getByManageToken } from "@/lib/team-orders";
import { teamOrders } from "@/db/schema";

export const runtime = "nodejs";

// Customer updates the shipping address for THIS order, authed by the private
// manage token. Shipping is re-quoted from the zip on the final invoice, so a
// mid-production change is safe; a shipped order is locked.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!dbEnabled()) return NextResponse.json({ error: "Not available" }, { status: 503 });
  const { token } = await params;
  const order = await getByManageToken(token);
  if (!order) return NextResponse.json({ error: "Link not found" }, { status: 404 });
  if (order.shippedAt) {
    return NextResponse.json({ error: "This order already shipped, so the address is locked. Text us and we'll help." }, { status: 409 });
  }

  let body: { address?: Record<string, unknown> } = {};
  try { body = await req.json(); } catch {}
  const a = (body.address ?? body) as Record<string, unknown>;
  const address = {
    line1: String(a.line1 ?? "").trim().slice(0, 120),
    line2: String(a.line2 ?? "").trim().slice(0, 120),
    city: String(a.city ?? "").trim().slice(0, 80),
    state: String(a.state ?? "").trim().slice(0, 40),
    postalCode: String(a.postalCode ?? "").trim().slice(0, 20),
    country: "US",
  };
  if (!address.line1 || !address.city || !address.state || !address.postalCode) {
    return NextResponse.json({ error: "Please fill in street, city, state, and ZIP." }, { status: 400 });
  }

  await getDb().update(teamOrders).set({ shippingAddress: address, updatedAt: new Date() }).where(eq(teamOrders.id, order.id));
  return NextResponse.json({ ok: true, address });
}
