import type { FollowUpCandidate } from "@/lib/follow-ups";
import { MAX_FOLLOW_UPS, recordFollowUp } from "@/lib/follow-ups";
import { emailProofFollowUp } from "@/lib/email";
import { sendFollowUpSms } from "@/lib/sms";
import { postDesignThreadUpdate } from "@/lib/discord";

function proofText(first: string, team: string, url: string, round: number): string {
  const messages = [
    `Hi ${first}, this is Slugger Athletics. Your ${team} design proof is ready to review. Approve it or request changes here: ${url}. Happy to answer questions.`,
    `Hi ${first}, just checking in on your ${team} proof. When you have a minute, please approve it or tell us what to adjust: ${url}`,
    `Hi ${first}, this is our final reminder about the ${team} proof. We will move the request out of our active queue in four days if we do not hear back, but your design will stay saved: ${url}`,
  ];
  return `${messages[Math.min(MAX_FOLLOW_UPS, Math.max(1, round)) - 1]}\nReply STOP to opt out.`;
}

/** Send one proof reminder through the same path for cron and staff buttons.
 *  The DB advances only when at least one channel succeeds. */
export async function sendProofFollowUp(
  candidate: FollowUpCandidate,
  requestedRound = candidate.followUpsSent + 1,
): Promise<{ sent: boolean; emailSent: boolean; textSent: boolean; round: number }> {
  const round = Math.min(MAX_FOLLOW_UPS, Math.max(1, requestedRound));
  if (!candidate.statusToken) return { sent: false, emailSent: false, textSent: false, round };

  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://sluggerathletics.com";
  const statusUrl = `${site}/design/status/${candidate.statusToken}`;
  const first = (candidate.contactName || "").trim().split(/\s+/)[0] || "there";

  const [textSent, emailSent] = await Promise.all([
    sendFollowUpSms({ phone: candidate.contactPhone, body: proofText(first, candidate.teamName, statusUrl, round) }),
    emailProofFollowUp({
      to: candidate.contactEmail,
      teamName: candidate.teamName,
      reference: candidate.reference,
      statusUrl,
      round,
      neededBy: candidate.neededBy,
    }),
  ]);
  const sent = textSent || emailSent;
  if (sent) {
    await recordFollowUp(candidate.id, new Date(), round);
    await postDesignThreadUpdate({
      threadId: candidate.discordThreadId,
      title: `Follow-up ${round}/${MAX_FOLLOW_UPS} - ${candidate.teamName} (${candidate.reference})`,
      description: `${round === MAX_FOLLOW_UPS ? "Final" : "Scheduled"} proof reminder sent by ${[textSent && "text", emailSent && "email"].filter(Boolean).join(" + ")}. The proof was originally sent ${candidate.proofSentAt.toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" })}.`,
      username: "Slugger Design Requests",
    });
  }
  return { sent, emailSent, textSent, round };
}
