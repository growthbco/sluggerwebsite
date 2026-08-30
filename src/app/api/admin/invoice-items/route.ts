import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { invoiceItems } from "@/db/schema";
import { requireApiRole } from "@/lib/admin-auth";

export const runtime = "nodejs";

// The invoice item library for the admin picker. Small list - return it all,
// the client filters as you type.
export async function GET() {
  const gate = await requireApiRole("money");
  if (!gate.ok) return NextResponse.json({ error: gate.status === 403 ? "Forbidden" : "Unauthorized" }, { status: gate.status });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const items = await getDb()
    .select({ id: invoiceItems.id, name: invoiceItems.name, description: invoiceItems.description, aliases: invoiceItems.aliases, unitPriceCents: invoiceItems.unitPriceCents, weightOz: invoiceItems.weightOz })
    .from(invoiceItems)
    .orderBy(desc(invoiceItems.updatedAt))
    .limit(200);
  return NextResponse.json({ items });
}
