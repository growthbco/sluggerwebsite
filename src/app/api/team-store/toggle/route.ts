import { NextResponse } from "next/server";
import { dbEnabled } from "@/db";
import { getByManageToken } from "@/lib/design-requests";
import { getStoreByDesignRequestId, setStoreActive } from "@/lib/team-stores";

export const runtime = "nodejs";

// Staff opens/closes a team store, authed by the design's manage token.
export async function POST(req: Request) {
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  let body: { manageToken?: string; active?: boolean } = {};
  try {
    body = await req.json();
  } catch {}
  if (!body.manageToken || typeof body.active !== "boolean") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const request = await getByManageToken(body.manageToken);
  if (!request) return NextResponse.json({ error: "Link not found" }, { status: 404 });
  const store = await getStoreByDesignRequestId(request.id);
  if (!store) return NextResponse.json({ error: "No store for this design" }, { status: 404 });

  await setStoreActive(store.id, body.active);
  return NextResponse.json({ ok: true, active: body.active });
}
