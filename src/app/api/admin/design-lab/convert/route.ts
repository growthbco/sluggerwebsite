import { NextResponse } from "next/server";
import { dbEnabled } from "@/db";
import { requireApiRole } from "@/lib/admin-auth";
import { convertLeadToDesignRequest } from "@/lib/design-requests";

export const runtime = "nodejs";

// Turn an AI Jersey Maker lead into a design request seeded with their saved
// designs, so staff can keep editing in the AI studio. Admin-only.
export async function POST(req: Request) {
  const gate = await requireApiRole("customer");
  if (!gate.ok) return NextResponse.json({ error: gate.status === 403 ? "Forbidden" : "Unauthorized" }, { status: gate.status });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  let body: { visitorId?: string } = {};
  try {
    body = await req.json();
  } catch {}
  if (!body.visitorId) return NextResponse.json({ error: "Missing visitorId" }, { status: 400 });

  const r = await convertLeadToDesignRequest(body.visitorId);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });

  const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://sluggerathletics.com";
  return NextResponse.json({ ok: true, manageUrl: `${SITE}/design/manage/${r.manageToken}`, reference: r.reference });
}
