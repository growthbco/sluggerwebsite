import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { designRequests } from "@/db/schema";
import { getByManageToken } from "@/lib/design-requests";

export const runtime = "nodejs";

// Staff/designer edits a design's NAME and/or SKU (item number). Like editing an
// inventory item - the name + SKU are the single naming convention used across
// the roster picker and the team store.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const { token } = await params;
  const request = await getByManageToken(token);
  if (!request) return NextResponse.json({ error: "Link not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url : "";
  if (!request.proofImages?.includes(url)) {
    return NextResponse.json({ error: "Unknown design image." }, { status: 400 });
  }
  const label = typeof body?.label === "string" ? body.label.trim().slice(0, 60) : "";
  const sku = typeof body?.sku === "string" ? body.sku.trim().slice(0, 40) : "";

  const db = getDb();
  const proofLabels = { ...(request.proofLabels ?? {}) };
  const designSkus = { ...(request.designSkus ?? {}) };
  if (label) proofLabels[url] = label; else delete proofLabels[url];
  if (sku) designSkus[url] = sku; else delete designSkus[url];
  await db.update(designRequests).set({ proofLabels, designSkus, updatedAt: new Date() }).where(eq(designRequests.id, request.id));

  return NextResponse.json({ ok: true, label: label || null, sku: sku || null });
}
