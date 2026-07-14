// Automated proof follow-ups. A design qualifies when a proof was sent, the
// client has gone quiet (no approval, no change request, no message since the
// proof), and we haven't exhausted the reminder cap.

import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { designRequests } from "@/db/schema";

export const MAX_FOLLOW_UPS = 2;
const FIRST_AFTER_DAYS = 2; // proof sent -> first nudge
const NEXT_AFTER_DAYS = 4; // first nudge -> second nudge
const STALE_AFTER_DAYS = 60; // too old to auto-nudge; needs a human

const DAY_MS = 24 * 60 * 60 * 1000;

export type FollowUpCandidate = {
  id: string;
  reference: string;
  teamName: string;
  contactEmail: string;
  statusToken: string | null;
  discordThreadId: string | null;
  followUpsSent: number;
  proofSentAt: Date;
  neededBy: Date | null;
};

export async function findProofFollowUpCandidates(now = new Date()): Promise<FollowUpCandidate[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(designRequests)
    .where(eq(designRequests.status, "proof_sent"));

  const due: FollowUpCandidate[] = [];
  for (const r of rows) {
    if (!r.proofSentAt || !r.contactEmail) continue;
    const sent = r.followUpsSent ?? 0;
    if (sent >= MAX_FOLLOW_UPS) continue;

    const ageDays = (now.getTime() - r.proofSentAt.getTime()) / DAY_MS;
    if (ageDays > STALE_AFTER_DAYS) continue;

    // A client message after the proof counts as a reply - a human should
    // answer it, not a robot.
    const lastClientMsg = [...(r.messages ?? [])].reverse().find((m) => m.from === "client");
    if (lastClientMsg && new Date(lastClientMsg.at) > r.proofSentAt) continue;

    const since = sent === 0 ? r.proofSentAt : r.lastFollowUpAt ?? r.proofSentAt;
    const waitDays = sent === 0 ? FIRST_AFTER_DAYS : NEXT_AFTER_DAYS;
    if (now.getTime() - since.getTime() < waitDays * DAY_MS) continue;

    due.push({
      id: r.id,
      reference: r.reference,
      teamName: r.teamName,
      contactEmail: r.contactEmail,
      statusToken: r.statusToken,
      discordThreadId: r.discordThreadId,
      followUpsSent: sent,
      proofSentAt: r.proofSentAt,
      neededBy: r.neededBy,
    });
  }
  return due;
}

export async function recordFollowUp(id: string, now = new Date()) {
  const db = getDb();
  const [row] = await db
    .select({ followUpsSent: designRequests.followUpsSent })
    .from(designRequests)
    .where(eq(designRequests.id, id))
    .limit(1);
  await db
    .update(designRequests)
    .set({ followUpsSent: (row?.followUpsSent ?? 0) + 1, lastFollowUpAt: now })
    .where(eq(designRequests.id, id));
}
