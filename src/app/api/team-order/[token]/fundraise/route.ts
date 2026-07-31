import { NextResponse } from "next/server";
import { dbEnabled } from "@/db";
import { getByManageToken } from "@/lib/team-orders";
import { getStoreByDesignRequestId, setFundraisePercent } from "@/lib/team-stores";

export const runtime = "nodejs";

// Coach-facing (manage-token auth): set the fundraising % on the team's linked
// store. Buyers then pay base + this % and the team keeps the difference.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!dbEnabled()) return NextResponse.json({ error: "Not available" }, { status: 503 });
  const { token } = await params;
  const order = await getByManageToken(token);
  if (!order) return NextResponse.json({ error: "Link not found" }, { status: 404 });
  if (!order.designRequestId) return NextResponse.json({ error: "This order has no team store yet." }, { status: 400 });

  const store = await getStoreByDesignRequestId(order.designRequestId);
  if (!store) return NextResponse.json({ error: "No team store found for this order." }, { status: 400 });

  const body = await req.json().catch(() => null);
  const percent = Number(body?.percent);
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    return NextResponse.json({ error: "Enter a percentage from 0 to 100." }, { status: 400 });
  }
  await setFundraisePercent(store.id, percent);
  return NextResponse.json({ ok: true, percent: Math.round(percent) });
}
