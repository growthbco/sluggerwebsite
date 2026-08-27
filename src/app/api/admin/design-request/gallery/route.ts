import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { designRequests } from "@/db/schema";
import { isAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

// Admin-only: show/hide a single approved design in the public "Recent Designs"
// showcase. Does not touch the order or anything else - purely a visibility
// flag. `hidden: true` pulls it from the gallery; `false` puts it back.
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  let body: { id?: string; hidden?: boolean } = {};
  try {
    body = await req.json();
  } catch {}
  if (!body.id || typeof body.hidden !== "boolean") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const db = getDb();
  const [row] = await db
    .update(designRequests)
    .set({ galleryHidden: body.hidden, updatedAt: new Date() })
    .where(eq(designRequests.id, body.id))
    .returning({ id: designRequests.id });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Reflect the change on the homepage showcase without waiting for ISR.
  revalidatePath("/");

  return NextResponse.json({ ok: true });
}
