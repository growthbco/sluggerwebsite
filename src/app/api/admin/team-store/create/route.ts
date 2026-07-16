import { NextResponse } from "next/server";
import { dbEnabled } from "@/db";
import { createTeamStore, STORE_ITEM_PRESETS } from "@/lib/team-stores";
import { isAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

// Admin-only: open a STANDALONE team store (no design request needed) - for
// repeat customers and simple orders like hats where a link is all they need.
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  let body: { name?: string; itemKeys?: string[]; localPricing?: boolean; taxExempt?: boolean; imageUrl?: string } = {};
  try {
    body = await req.json();
  } catch {}
  const name = (body.name ?? "").trim().slice(0, 80);
  if (name.length < 2) return NextResponse.json({ error: "Enter the team name." }, { status: 400 });

  const validKeys = new Set(STORE_ITEM_PRESETS.map((p) => p.key));
  const itemKeys = (body.itemKeys ?? []).filter((k) => validKeys.has(k));
  if (itemKeys.length === 0) return NextResponse.json({ error: "Pick at least one item." }, { status: 400 });

  const imageUrl = (body.imageUrl ?? "").trim();
  if (imageUrl && !/^https:\/\//.test(imageUrl)) {
    return NextResponse.json({ error: "Bad image URL." }, { status: 400 });
  }

  try {
    const store = await createTeamStore({
      name,
      itemKeys,
      localPricing: body.localPricing === true,
      taxExempt: body.taxExempt === true,
      approvedDesignUrl: imageUrl || null,
    });
    const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://sluggerathletics.com";
    return NextResponse.json({
      ok: true,
      storeUrl: `${SITE}/store/${store.slug ?? store.storeToken}`,
      slug: store.slug,
    });
  } catch (e) {
    console.error("standalone store create failed:", e);
    return NextResponse.json({ error: "Could not create the store" }, { status: 500 });
  }
}
