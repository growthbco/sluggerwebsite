import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { teamOrders } from "@/db/schema";
import { isAdmin } from "@/lib/admin-auth";
import { getRoster } from "@/lib/team-orders";
import { itemLabel, formatSize } from "@/lib/order-items";

export const runtime = "nodejs";

const esc = (s: string) => s.replace(/[&<>]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[m]!));

type RosterRow = Awaited<ReturnType<typeof getRoster>>[number];

// The color/design a row belongs to, used to group the sheet so all the gray
// jerseys sit together, all the white together, etc. - the way you'd pack them.
function groupOf(r: RosterRow): string {
  return (r.design || r.notes || "Set").toString().trim() || "Set";
}
function sizeOf(r: RosterRow): string {
  const sizes = r.sizes ? Object.entries(r.sizes).filter(([, v]) => (v ?? "").toString().trim()) : [];
  if (sizes.length) return sizes.map(([k, v]) => `${itemLabel(k)}: ${formatSize(v)}`).join(", ");
  return formatSize(r.size) || "-";
}

// Admin-only printable PACKING sheet for a team order: every piece as a
// checkbox row, grouped by color/design, so staff can cross each off as they
// pack. No prices - this is a pack list, not a receipt.
export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const db = getDb();
  const [o] = await db.select().from(teamOrders).where(eq(teamOrders.id, id)).limit(1);
  if (!o) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const roster = await getRoster(o.id);

  const a = o.shippingAddress ?? ({} as NonNullable<typeof o.shippingAddress>);
  const shipTo = [a.line1, a.line2, `${a.city ?? ""}, ${a.state ?? ""} ${a.postalCode ?? ""}`.trim(), a.country]
    .filter((x) => x && x !== ",")
    .map((x) => esc(String(x)))
    .join("<br>");

  // Group rows by color/design, preserving first-seen order.
  const groups = new Map<string, RosterRow[]>();
  for (const r of roster) {
    const g = groupOf(r);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(r);
  }

  const sections = Array.from(groups.entries())
    .map(([label, rows]) => {
      const body = rows
        .map(
          (r) => `<tr>
            <td class="chk"><span class="box"></span></td>
            <td class="name">${esc((r.playerName || "-").toString().toUpperCase())}</td>
            <td class="num">${r.playerNumber ? "#" + esc(String(r.playerNumber)) : ""}</td>
            <td class="size">${esc(sizeOf(r))}${r.quantity && r.quantity > 1 ? ` <b>×${r.quantity}</b>` : ""}</td>
          </tr>`,
        )
        .join("");
      return `<section class="grp">
        <h2>${esc(label)} <span class="count">${rows.length}</span></h2>
        <table><tbody>${body}</tbody></table>
      </section>`;
    })
    .join("");

  const title = `${o.teamName || o.contactName} - ${o.reference}`;
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
    .num { width: 54px; color: #444; }
    .size { color: #333; text-align: right; }
    .printbtn { position: fixed; top: 16px; right: 16px; background: #111; color: #fff; border: 0; padding: 10px 16px; border-radius: 6px; font-size: 14px; cursor: pointer; }
    @media print {
      .printbtn { display: none; }
      body { padding: 0; max-width: none; }
      td { border-bottom: 1px solid #ccc; }
    }
  </style></head>
  <body>
    <button class="printbtn" onclick="window.print()">🖨️ Print</button>
    <header>
      <div class="total">pieces<b>${roster.length}</b></div>
      <h1>${esc(title)}</h1>
      <p class="sub">${esc(o.teamName || "")}${o.contactName ? ` · ${esc(o.contactName)}` : ""} · Status: ${esc(o.status)}</p>
      ${shipTo ? `<p class="ship"><b>Ship to</b><br>${shipTo}</p>` : `<p class="ship"><b>Ship to</b><br>No address on file</p>`}
    </header>
    ${sections || "<p>No roster on this order.</p>"}
  </body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
