import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { isAdmin } from "@/lib/admin-auth";
import { designRequests } from "@/db/schema";
import { getByManageToken } from "@/lib/design-requests";

export const runtime = "nodejs";

// Add a texted (or otherwise hosted) image to a design request's inspiration
// set so the AI studio on the manage page can generate from it. Admin-only.
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  let body: { token?: string; url?: string } = {};
  try {
    body = await req.json();
  } catch {}
  if (!body.token || !body.url) return NextResponse.json({ error: "Missing token or url" }, { status: 400 });
  // Only accept our own hosted media (inbound texts are rehosted to Vercel Blob),
  // never an arbitrary URL.
  if (!/\.public\.blob\.vercel-storage\.com\//.test(body.url)) {
    return NextResponse.json({ error: "Only hosted images can be added." }, { status: 400 });
  }

  const request = await getByManageToken(body.token);
  if (!request) return NextResponse.json({ error: "Design request not found" }, { status: 404 });

  const current = request.inspirationImages ?? [];
  if (current.includes(body.url)) return NextResponse.json({ ok: true, already: true });

  await getDb()
    .update(designRequests)
    .set({ inspirationImages: [...current, body.url] })
    .where(eq(designRequests.id, request.id));

  return NextResponse.json({ ok: true });
}
