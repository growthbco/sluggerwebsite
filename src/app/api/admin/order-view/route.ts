import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { orders, orderItems } from "@/db/schema";
import { isAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";
const money = (c: number) => `$${(c / 100).toFixed(2)}`;
const esc = (s: string) => s.replace(/[&<>]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[m]!));

// Admin-only itemized receipt for a shop/store order (the "view invoice"
// equivalent - store orders are already paid via Stripe, so this is a record).
export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const db = getDb();
  const [o] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!o) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const items = await db.select().from(orderItems).where(inArray(orderItems.orderId, [o.id]));
  const taxLines = items.filter((it) => /\btax\b/i.test(it.name));
  const productLines = items.filter((it) => !/\btax\b/i.test(it.name));
  const merchandiseSubtotalCents = productLines.reduce((sum, it) => sum + it.unitPriceCents * it.quantity, 0);
  const taxCents = taxLines.reduce((sum, it) => sum + it.unitPriceCents * it.quantity, 0);

  const a = o.shippingAddress ?? {};
  const shipTo = [a.line1, a.line2, `${a.city ?? ""}, ${a.state ?? ""} ${a.postalCode ?? ""}`, a.country].filter(Boolean).join("<br>");
  const rows = productLines.map((it) => `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee">${esc(it.name)}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:center">${it.quantity}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">${money(it.unitPriceCents * it.quantity)}</td></tr>`).join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(o.reference)}</title></head>
  <body style="font-family:-apple-system,Segoe UI,sans-serif;max-width:640px;margin:24px auto;padding:0 16px;color:#111">
    <h1 style="margin:0">Slugger Athletics</h1>
    <p style="color:#666;margin:4px 0 20px">Order ${esc(o.reference)} · ${o.type === "team_store" ? "Team Store" : o.type} · PAID</p>
    <p><strong>Customer:</strong> ${esc(o.customerName ?? "-")}${o.customerEmail ? ` · ${esc(o.customerEmail)}` : ""}<br>
    ${shipTo ? `<strong>Ship to:</strong><br>${shipTo}` : ""}</p>
    <table style="width:100%;border-collapse:collapse;margin-top:16px">
      <thead><tr><th style="text-align:left;padding:6px 10px;border-bottom:2px solid #111">Item</th><th style="padding:6px 10px;border-bottom:2px solid #111">Qty</th><th style="text-align:right;padding:6px 10px;border-bottom:2px solid #111">Amount</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <table style="width:100%;margin-top:12px">
      <tr><td style="text-align:right;padding:2px 10px;color:#666">Merchandise</td><td style="text-align:right;padding:2px 10px;width:110px">${money(merchandiseSubtotalCents)}</td></tr>
      ${taxCents > 0 ? `<tr><td style="text-align:right;padding:2px 10px;color:#666">Sales tax</td><td style="text-align:right;padding:2px 10px">${money(taxCents)}</td></tr>` : ""}
      <tr><td style="text-align:right;padding:2px 10px;color:#666">Shipping</td><td style="text-align:right;padding:2px 10px">${o.shippingCents > 0 ? money(o.shippingCents) : "Free / pickup"}</td></tr>
      ${o.shippingProtectionCents > 0 ? `<tr><td style="text-align:right;padding:2px 10px;color:#16803c">Package protection (XCover)</td><td style="text-align:right;padding:2px 10px;color:#16803c">${money(o.shippingProtectionCents)}</td></tr>` : ""}
      <tr><td style="text-align:right;padding:2px 10px;font-weight:700">Total paid</td><td style="text-align:right;padding:2px 10px;font-weight:700">${money(o.totalCents)}</td></tr>
    </table>
  </body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html" } });
}
