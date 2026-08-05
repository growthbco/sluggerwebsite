import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { quoteShippingCents } from "@/lib/ship-quote";

export const runtime = "nodejs";

// Shipping preview for the custom-invoice form.
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: { zip?: string; weightOz?: number } = {};
  try { body = await req.json(); } catch {}
  const zip = (body.zip ?? "").trim();
  if (!/^\d{5}$/.test(zip)) return NextResponse.json({ error: "Enter a 5-digit ZIP." }, { status: 400 });
  const quote = await quoteShippingCents(zip, Number(body.weightOz) || 16);
  return NextResponse.json(quote);
}
