import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { orders, orderItems } from "@/db/schema";
import { isAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

const esc = (s: string) => s.replace(/[&<>]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[m]!));

// Pull a color/design word out of a store line name so the sheet groups all the
// grays together, all the whites together - the way you pack them. Falls back
// to "Items" when no color is present.
const COLORS = ["White", "Gray", "Grey", "Black", "Navy", "Royal", "Red", "Gold", "Green", "Pink", "Orange", "Purple", "Maroon", "Charcoal", "Light Grey", "Light Gray"];
function colorOf(name: string): string {
  const hit = COLORS.find((c) => new RegExp(`\\b${c}\\b`, "i").test(name));
  return hit ? hit.replace(/grey/i, "Gray") : "Items";
}

// Admin-only printable PACKING sheet for a shop/team-store order: a checkbox
// per piece, grouped by color, so staff cross each off as they pack. No prices.
export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const db = getDb();
  const [o] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!o) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const items = (await db.select().from(orderItems).where(inArray(orderItems.orderId, [o.id]))).filter((it) => !/\btax\b/i.test(it.name));

  const a = o.shippingAddress ?? ({} as NonNullable<typeof o.shippingAddress>);
  const shipTo = [a.line1, a.line2, `${a.city ?? ""}, ${a.state ?? ""} ${a.postalCode ?? ""}`.trim(), a.country]
    .filter((x) => x && x !== ",")
    .map((x) => esc(String(x)))
    .join("<br>");

  const groups = new Map<string, typeof items>();
  for (const it of items) {
    const g = colorOf(it.name);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(it);
  }

  const totalPieces = items.reduce((s, it) => s + (it.quantity || 1), 0);
  const sections = Array.from(groups.entries())
    .map(([label, rows]) => {
      const body = rows
        .map(
          (it) => `<tr>
            <td class="chk"><span class="box"></span></td>
            <td class="name">${esc(it.name)}${it.quantity && it.quantity > 1 ? ` <b>×${it.quantity}</b>` : ""}</td>
          </tr>`,
        )
        .join("");
      return `<section class="grp"><h2>${esc(label)} <span class="count">${rows.reduce((s, it) => s + (it.quantity || 1), 0)}</span></h2><table><tbody>${body}</tbody></table></section>`;
    })
    .join("");

  const who = o.customerName ?? "Order";
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pack ${esc(o.reference)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, Segoe UI, Arial, sans-serif; color: #111; max-width: 720px; margin: 0 auto; padding: 24px 20px 60px; }
    header { border-bottom: 3px solid #111; padding-bottom: 12px; margin-bottom: 18px; }
    h1 { margin: 0; font-size: 22px; }
    .sub { color: #555; margin: 4px 0 0; font-size: 13px; }
    .ship { margin-top: 10px; font-size: 13px; line-height: 1.4; }
    .ship b { text-transform: uppercase; font-size: 11px; letter-spacing: .04em; color: #777; }
    .total { float: right; text-align: right; font-size: 13px; color: #555; }
    .total b { display: block; font-size: 28px; color: #111; }
    .grp { margin-top: 20px; break-inside: avoid; }
    .grp h2 { font-size: 15px; margin: 0 0 6px; padding-bottom: 4px; border-bottom: 1.5px solid #bbb; display: flex; justify-content: space-between; align-items: baseline; }
    .count { font-weight: 400; color: #888; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 7px 6px; border-bottom: 1px solid #eee; font-size: 14px; vertical-align: middle; }
    .chk { width: 30px; }
    .box { display: inline-block; width: 17px; height: 17px; border: 2px solid #333; border-radius: 3px; vertical-align: middle; }
    .name { font-weight: 600; }
    .printbtn { position: fixed; top: 16px; right: 16px; background: #111; color: #fff; border: 0; padding: 10px 16px; border-radius: 6px; font-size: 14px; cursor: pointer; }
    @media print { .printbtn { display: none; } body { padding: 0; max-width: none; } td { border-bottom: 1px solid #ccc; } }
  </style></head>
  <body>
    <button class="printbtn" onclick="window.print()">🖨️ Print</button>
    <header>
      <div class="total">pieces<b>${totalPieces}</b></div>
      <h1>${esc(who)} - ${esc(o.reference)}</h1>
      <p class="sub">${o.type === "team_store" ? "Team Store" : o.type === "buy_in" ? "Buy-In" : "Shop"} order · Status: ${esc(o.status)}</p>
      ${shipTo ? `<p class="ship"><b>Ship to</b><br>${shipTo}</p>` : `<p class="ship"><b>Ship to</b><br>No address on file</p>`}
    </header>
    ${sections || "<p>No items on this order.</p>"}
  </body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
