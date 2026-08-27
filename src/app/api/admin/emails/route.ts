import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { isAdmin } from "@/lib/admin-auth";
import { designRequests } from "@/db/schema";
import { designNeedsAction, getById, type DesignMessage } from "@/lib/design-requests";

export const runtime = "nodejs";

// Powers the Email view of the Conversations inbox. Two shapes:
//   GET                -> list every design thread that has messages, newest
//                         first, flagged when it's waiting on a staff reply.
//   GET ?id=<designId> -> the full message thread + the tokens/contact needed
//                         to read and reply from the inbox.
// Scopes columns and pulls only the LAST message per design for the list (jsonb
// `-> -1`) so the listing never drags whole threads across the wire.
export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!dbEnabled()) return NextResponse.json({ threads: [] });

  const db = getDb();
  const id = new URL(req.url).searchParams.get("id");

  // ── One thread: full messages + reply credentials ──────────────────────
  if (id) {
    const d = await getById(id);
    if (!d) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({
      id: d.id,
      reference: d.reference,
      teamName: d.teamName,
      contactEmail: d.contactEmail,
      contactPhone: d.contactPhone,
      status: d.status,
      manageToken: d.manageToken,
      statusToken: d.statusToken,
      messages: d.messages ?? [],
    });
  }

  // ── Listing: every design with a thread, most-recent message first ─────
  const rows = await db
    .select({
      id: designRequests.id,
      reference: designRequests.reference,
      teamName: designRequests.teamName,
      contactEmail: designRequests.contactEmail,
      status: designRequests.status,
      archivedAt: designRequests.archivedAt,
      followedUpAt: designRequests.followedUpAt,
      count: sql<number>`coalesce(jsonb_array_length(${designRequests.messages}), 0)`,
      lastMessage: sql<DesignMessage | null>`${designRequests.messages} -> -1`,
    })
    .from(designRequests)
    .where(sql`coalesce(jsonb_array_length(${designRequests.messages}), 0) > 0`);

  const threads = rows
    .map((r) => {
      const lm = r.lastMessage;
      return {
        id: r.id,
        reference: r.reference,
        teamName: r.teamName.trim(),
        contactEmail: r.contactEmail,
        status: r.status,
        archived: Boolean(r.archivedAt),
        count: r.count,
        lastAt: lm?.at ?? null,
        lastFrom: lm?.from ?? null,
        preview: (lm?.text ?? "").slice(0, 140),
        // "Needs reply" = last word was the client's and staff hasn't followed
        // up since (same rule the pipeline + notifier use).
        needsReply: designNeedsAction({
          status: r.status,
          archivedAt: r.archivedAt,
          followedUpAt: r.followedUpAt,
          lastMessage: lm ?? null,
        }),
      };
    })
    .filter((t) => t.lastAt)
    .sort((a, b) => new Date(b.lastAt!).getTime() - new Date(a.lastAt!).getTime());

  return NextResponse.json({ threads });
}
