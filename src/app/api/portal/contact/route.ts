import { NextResponse } from "next/server";
import { readPortalToken } from "@/lib/portal";
import { updateContact } from "@/lib/customers";
import { getDb } from "@/db";
import { teamOrders } from "@/db/schema";
import { sql, and, isNull, ne } from "drizzle-orm";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : "";
  const email = readPortalToken(token);
  if (!email) return NextResponse.json({ error: "Your session expired. Request a fresh link." }, { status: 401 });

  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 120) : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim().slice(0, 40) : "";
  const a = body?.address && typeof body.address === "object" ? body.address : null;
  const address = a
    ? {
        line1: String(a.line1 ?? "").trim().slice(0, 120),
        line2: String(a.line2 ?? "").trim().slice(0, 120),
        city: String(a.city ?? "").trim().slice(0, 80),
        state: String(a.state ?? "").trim().slice(0, 40),
        postalCode: String(a.postalCode ?? "").trim().slice(0, 20),
        country: "US",
      }
    : null;
  const hasAddress = Boolean(address?.line1 && address?.city && address?.state && address?.postalCode);

  if (!name && !phone && !hasAddress) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  if (name || phone) await updateContact(email, { name, phone });

  if (hasAddress) {
    // Apply the new address to every in-progress order (not shipped, not
    // cancelled) so they go to the right place. Shipping is re-quoted from the
    // zip on the final invoice, so a mid-flight change is safe.
    await getDb()
      .update(teamOrders)
      .set({ shippingAddress: address, updatedAt: new Date() })
      .where(and(sql`lower(${teamOrders.contactEmail}) = ${email}`, isNull(teamOrders.shippedAt), ne(teamOrders.status, "cancelled")));
  }

  return NextResponse.json({ ok: true });
}
