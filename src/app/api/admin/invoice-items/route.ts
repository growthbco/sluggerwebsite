import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { invoiceItems } from "@/db/schema";
import { isAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

// The invoice item library for the admin picker. Small list - return it all,
// the client filters as you type.
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const items = await getDb()
    .select({ id: invoiceItems.id, name: invoiceItems.name, description: invoiceItems.description, unitPriceCents: invoiceItems.unitPriceCents, weightOz: invoiceItems.weightOz })
    .from(invoiceItems)
    .orderBy(desc(invoiceItems.updatedAt))
    .limit(200);
  return NextResponse.json({ items });
}
