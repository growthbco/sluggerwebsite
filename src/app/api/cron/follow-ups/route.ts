import { NextResponse } from "next/server";
import { dbEnabled } from "@/db";
import { findProofFollowUpCandidates, recordFollowUp, MAX_FOLLOW_UPS } from "@/lib/follow-ups";
import { emailProofFollowUp } from "@/lib/email";
import { postDesignThreadUpdate } from "@/lib/discord";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Daily Vercel Cron (see vercel.json). Sends up to MAX_FOLLOW_UPS reminder
// emails to clients who haven't reviewed a sent proof. ?dryRun=1 lists who
// WOULD be nudged without sending anything.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  const dryRun = new URL(req.url).searchParams.get("dryRun") === "1";
  const candidates = await findProofFollowUpCandidates();
  const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://sluggerathletics.com";

  const results: { reference: string; team: string; round: number; sent?: boolean }[] = [];
  for (const c of candidates) {
    const round = c.followUpsSent + 1;
    if (dryRun) {
      results.push({ reference: c.reference, team: c.teamName, round });
      continue;
    }
    try {
      const sent = await emailProofFollowUp({
        to: c.contactEmail,
        teamName: c.teamName,
        reference: c.reference,
        statusUrl: `${SITE}/design/status/${c.statusToken}`,
        round,
        neededBy: c.neededBy,
      });
      if (sent) {
        await recordFollowUp(c.id);
        await postDesignThreadUpdate({
          threadId: c.discordThreadId ?? undefined,
          title: `⏰ Auto follow-up ${round}/${MAX_FOLLOW_UPS} emailed — ${c.teamName} (${c.reference})`,
          description: `Client hasn't reviewed the proof sent ${c.proofSentAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}. Reminder email sent automatically.`,
          username: "Slugger Design Requests",
        });
      }
      results.push({ reference: c.reference, team: c.teamName, round, sent });
    } catch (e) {
      console.error(`Follow-up failed for ${c.reference}:`, e);
      results.push({ reference: c.reference, team: c.teamName, round, sent: false });
    }
  }

  return NextResponse.json({ dryRun, count: results.length, results });
}
