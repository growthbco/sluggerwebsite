import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { dbEnabled } from "@/db";
import { isAdmin } from "@/lib/admin-auth";
import { markFollowedUp } from "@/lib/design-requests";

export const runtime = "nodejs";

// Admin-only: mark a design as followed-up (we reached out by text/call outside
// the thread), clearing it from the "waiting on us" list until the customer
// messages again. Pass followedUp:false to un-mark.
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  let body: { id?: string; followedUp?: boolean } = {};
  try {
    body = await req.json();
  } catch {}
  if (!body.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await markFollowedUp(body.id, body.followedUp === false ? null : new Date());
  revalidatePath("/admin");
  revalidatePath("/admin/design-requests");
  return NextResponse.json({ ok: true });
}
