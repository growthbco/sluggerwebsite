import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { dbEnabled } from "@/db";
import { requireApiRole } from "@/lib/admin-auth";
import { settleAllBillable } from "@/lib/designer-invoices";

export const runtime = "nodejs";

// Mark every currently-produced-but-unbilled order as settled outside the tool
// (the designer was paid directly / fully paid up). Money-area action, so the
// designer role can't self-clear.
export async function POST() {
  const gate = await requireApiRole("money");
  if (!gate.ok) return NextResponse.json({ error: "Unauthorized" }, { status: gate.status });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const n = await settleAllBillable();
  revalidatePath("/admin/invoices");
  return NextResponse.json({ ok: true, settled: n });
}
