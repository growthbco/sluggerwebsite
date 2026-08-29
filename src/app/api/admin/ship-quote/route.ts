import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/admin-auth";
import { quoteShippingCents } from "@/lib/ship-quote";

export const runtime = "nodejs";

// Shipping preview for the custom-invoice form.
export async function POST(req: Request) {
  const gate = await requireApiRole("money");
  if (!gate.ok) return NextResponse.json({ error: gate.status === 403 ? "Forbidden" : "Unauthorized" }, { status: gate.status });
  let body: { zip?: string; weightOz?: number } = {};
  try { body = await req.json(); } catch {}
  const zip = (body.zip ?? "").trim();
  if (!/^\d{5}$/.test(zip)) return NextResponse.json({ error: "Enter a 5-digit ZIP." }, { status: 400 });
  const quote = await quoteShippingCents(zip, Number(body.weightOz) || 16);
  return NextResponse.json(quote);
}
