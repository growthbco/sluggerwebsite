import { NextResponse } from "next/server";
import { dbEnabled } from "@/db";
import { getByManageToken } from "@/lib/design-requests";
import { createTeamStore, STORE_ITEM_PRESETS } from "@/lib/team-stores";
import { postDesignThreadUpdate } from "@/lib/discord";

export const runtime = "nodejs";

// Staff opens a per-person team store from a design's manage page.
export async function POST(req: Request) {
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  let body: { manageToken?: string; itemKeys?: string[] } = {};
  try {
    body = await req.json();
  } catch {}
  if (!body.manageToken) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const request = await getByManageToken(body.manageToken);
  if (!request) return NextResponse.json({ error: "Link not found" }, { status: 404 });
  if (request.status !== "approved" && request.status !== "ordered") {
    return NextResponse.json({ error: "The design needs to be approved before opening a store." }, { status: 409 });
  }

  const validKeys = new Set(STORE_ITEM_PRESETS.map((p) => p.key));
  const itemKeys = (body.itemKeys ?? []).filter((k) => validKeys.has(k));
  if (itemKeys.length === 0) {
    return NextResponse.json({ error: "Pick at least one item to sell." }, { status: 400 });
  }

  try {
    const store = await createTeamStore({
      name: request.teamName,
      sport: request.sport,
      contactEmail: request.contactEmail,
      approvedDesignUrl: request.approvedDesignUrl ?? request.proofImages?.[request.proofImages.length - 1] ?? null,
      designRequestId: request.id,
      itemKeys,
    });
    const SITE = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const storeUrl = `${SITE}/store/${store.storeToken}`;
    await postDesignThreadUpdate({
      threadId: request.discordThreadId ?? undefined,
      title: `🛒 Team store opened — ${request.teamName} (${request.reference})`,
      description: `Players and parents can now buy their own gear:\n${storeUrl}`,
      username: "Slugger Design Requests",
    });
    return NextResponse.json({ ok: true, storeUrl, active: store.storeActive, items: store.storeItems });
  } catch (e) {
    console.error("createTeamStore failed:", e);
    return NextResponse.json({ error: "Could not create the store" }, { status: 500 });
  }
}
