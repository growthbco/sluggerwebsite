export const MAX_PROOF_FOLLOW_UPS = 3;
export const PROOF_FOLLOW_UP_WAIT_DAYS = [2, 3, 5] as const;
export const PROOF_CLOSEOUT_AFTER_DAYS = 4;
export const UNRESPONSIVE_ARCHIVE_NOTE = "Unresponsive - no reply";

const DAY_MS = 24 * 60 * 60 * 1000;

export type ProofFollowUpState =
  | "none"
  | "waiting"
  | "due"
  | "final_due"
  | "closeout_due"
  | "snoozed"
  | "unresponsive";

export type ProofFollowUpStateInput = {
  status: string;
  archivedAt?: Date | string | null;
  archivedNote?: string | null;
  proofSentAt?: Date | string | null;
  followUpsSent?: number | null;
  lastFollowUpAt?: Date | string | null;
  followUpSnoozedUntil?: Date | string | null;
  lastMessageAt?: Date | string | null;
  lastMessageFrom?: string | null;
};

function timestamp(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

export function isUnresponsiveArchiveNote(note: string | null | undefined): boolean {
  return (note ?? "").trim().toLowerCase().startsWith(UNRESPONSIVE_ARCHIVE_NOTE.toLowerCase());
}

/** Pure shared policy used by the cron and admin queue, so the page always
 *  agrees with the automation about who is due, final, or closed out. */
export function proofFollowUpState(input: ProofFollowUpStateInput, now: Date | string = new Date()): ProofFollowUpState {
  if (input.archivedAt) return isUnresponsiveArchiveNote(input.archivedNote) ? "unresponsive" : "none";
  if (input.status !== "proof_sent") return "none";

  const nowAt = timestamp(now);
  const proofAt = timestamp(input.proofSentAt);
  if (nowAt == null || proofAt == null) return "none";

  const snoozedUntil = timestamp(input.followUpSnoozedUntil);
  if (snoozedUntil != null && snoozedUntil > nowAt) return "snoozed";

  const sent = Math.max(0, input.followUpsSent ?? 0);
  let baseAt = sent === 0 ? proofAt : timestamp(input.lastFollowUpAt) ?? proofAt;
  const lastMessageAt = timestamp(input.lastMessageAt);
  if (lastMessageAt != null && lastMessageAt > baseAt) {
    // An unanswered customer message belongs in "Needs our action," never an
    // automated chase or closeout. A staff/AI answer restarts the quiet clock.
    if (input.lastMessageFrom === "client") return "none";
    baseAt = lastMessageAt;
  }

  if (sent >= MAX_PROOF_FOLLOW_UPS) {
    return nowAt - baseAt >= PROOF_CLOSEOUT_AFTER_DAYS * DAY_MS ? "closeout_due" : "waiting";
  }

  const waitDays = PROOF_FOLLOW_UP_WAIT_DAYS[sent];
  if (nowAt - baseAt < waitDays * DAY_MS) return "waiting";
  return sent === MAX_PROOF_FOLLOW_UPS - 1 ? "final_due" : "due";
}
