import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { designRequests } from "@/db/schema";
import { getByManageToken } from "@/lib/design-requests";
import { emailRushConfirmed } from "@/lib/email";
import { postDesignThreadUpdate } from "@/lib/discord";
import { requireApiRole } from "@/lib/admin-auth";

export const runtime = "nodejs";

// Staff approve a rush request's timeline (manage token = staff/designer side).
// Records who signed off, tells the client by email, and logs it in the
// design's Discord thread so nobody promises a date we can't hit.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const gate = await requireApiRole("money");
  if (!gate.ok) return NextResponse.json({ error: gate.status === 403 ? "Forbidden" : "Unauthorized" }, { status: gate.status });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const { token } = await params;
  const request = await getByManageToken(token);
  if (!request) return NextResponse.json({ error: "Link not found" }, { status: 404 });
  if (!request.rush) return NextResponse.json({ error: "This isn't a rush request." }, { status: 400 });
  if (request.rushApprovedAt) return NextResponse.json({ error: "Rush already approved." }, { status: 409 });

  let body: { name?: string } = {};
  try {
    body = await req.json();
  } catch {}
  const name = (body.name ?? "").trim().slice(0, 40);
  if (!name) return NextResponse.json({ error: "Pick who's approving first." }, { status: 400 });

  const db = getDb();
  const approvedAt = new Date();
  await db
    .update(designRequests)
    .set({ rushApprovedAt: approvedAt, rushApprovedBy: name, updatedAt: new Date() })
    .where(eq(designRequests.id, request.id));

  const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://sluggerathletics.com";
  const neededStr = request.neededBy
    ? request.neededBy.toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" })
    : "requested date";
  await Promise.allSettled([
    emailRushConfirmed({
      to: request.contactEmail,
      teamName: request.teamName,
      reference: request.reference,
      neededBy: request.neededBy,
      approvedBy: name,
      statusUrl: `${SITE}/design/status/${request.statusToken}`,
    }),
    postDesignThreadUpdate({
      threadId: request.discordThreadId ?? undefined,
      title: `✅ RUSH approved by ${name} - ${request.teamName} (${request.reference})`,
      description: `Timeline confirmed for **${neededStr}**. Rush is a flat $100 fee and ships direct. Client has been emailed.`,
    }),
  ]);

  return NextResponse.json({ ok: true, rushApprovedAt: approvedAt.toISOString(), rushApprovedBy: name });
}
