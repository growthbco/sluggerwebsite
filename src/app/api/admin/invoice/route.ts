import { NextResponse } from "next/server";
import { dbEnabled } from "@/db";
import { requireApiRole } from "@/lib/admin-auth";
import { markInvoicePaid, voidInvoice } from "@/lib/designer-invoices";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const auth = await requireApiRole("money");
  if (!auth.ok) return NextResponse.json({ error: "Not allowed" }, { status: auth.status });

  let body: { id?: string; action?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ error: "Missing invoice id" }, { status: 400 });

  if (body.action === "paid") {
    const row = await markInvoicePaid(body.id, auth.session.name, body.note);
    if (!row) return NextResponse.json({ error: "Already paid or not found" }, { status: 409 });
    return NextResponse.json({ ok: true });
  }
  if (body.action === "void") {
    const row = await voidInvoice(body.id);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
