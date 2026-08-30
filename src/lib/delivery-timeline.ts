import {
  PRIORITY_PRODUCTION_DAYS,
  RUSH_PRODUCTION_DAYS,
  SHIPPING_BUFFER_DAYS,
  STANDARD_PRODUCTION_DAYS,
} from "@/lib/customer-policy";

export {
  PRIORITY_PRODUCTION_DAYS,
  RUSH_PRODUCTION_DAYS,
  SHIPPING_BUFFER_DAYS,
  STANDARD_PRODUCTION_DAYS,
} from "@/lib/customer-policy";

export type DeliveryTier = "standard" | "rush" | "priority";
export type DeliveryRisk = "no_date" | "waiting" | "on_track" | "tight" | "rush_needed" | "priority_review" | "not_feasible";

export type DeliveryTimelineInput = {
  approvedAt?: Date | string | null;
  rosterSubmittedAt?: Date | string | null;
  depositPaidAt?: Date | string | null;
  requestedInHandAt?: Date | string | null;
  promisedInHandAt?: Date | string | null;
  /** Authoritative start explicitly recorded for a manual order. */
  timelineStartAt?: Date | string | null;
  tier?: DeliveryTier | null;
  /** Legacy-only evidence that production is already underway when an old
   * order is missing one of the prerequisite timestamps. */
  fallbackStartAt?: Date | string | null;
  rush?: boolean | null;
  localPickup?: boolean | null;
};

export type DeliveryTimeline = {
  tier: DeliveryTier;
  tierLabel: string;
  productionDays: number;
  startAt: Date | null;
  startEstimated: boolean;
  startManual: boolean;
  missing: string[];
  standardTargetAt: Date | null;
  rushTargetAt: Date | null;
  priorityTargetAt: Date | null;
  selectedTargetAt: Date | null;
  safeInHandAt: Date | null;
  requestedInHandAt: Date | null;
  promisedInHandAt: Date | null;
  risk: DeliveryRisk;
  riskLabel: string;
  riskDetail: string;
};

const DAY_MS = 86_400_000;

function validDate(value?: Date | string | null): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? new Date(value) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * DAY_MS);
}

function endOfDateOnly(value: Date | null): Date | null {
  if (!value) return null;
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 23, 59, 59, 999));
}

/**
 * One source of truth for custom-order timing.
 *
 * The production clock starts only after all three commitments are complete:
 * final design approval, final roster submission, and deposit payment. Targets
 * are calendar-day production targets; carrier transit is additional.
 */
export function buildDeliveryTimeline(input: DeliveryTimelineInput): DeliveryTimeline {
  const approvedAt = validDate(input.approvedAt);
  const rosterSubmittedAt = validDate(input.rosterSubmittedAt);
  const depositPaidAt = validDate(input.depositPaidAt);
  const requestedInHandAt = endOfDateOnly(validDate(input.requestedInHandAt));
  const promisedInHandAt = endOfDateOnly(validDate(input.promisedInHandAt));
  const prerequisites = [
    { label: "final design approval", at: approvedAt },
    { label: "final roster", at: rosterSubmittedAt },
    { label: "deposit", at: depositPaidAt },
  ];
  const missing = prerequisites.filter((item) => !item.at).map((item) => item.label);
  const completeStartAt = missing.length === 0
    ? new Date(Math.max(...prerequisites.map((item) => item.at!.getTime())))
    : null;
  const fallbackStartAt = validDate(input.fallbackStartAt);
  const manualStartAt = validDate(input.timelineStartAt);
  const startAt = manualStartAt ?? completeStartAt ?? fallbackStartAt;
  const startManual = Boolean(manualStartAt);
  const startEstimated = !manualStartAt && !completeStartAt && Boolean(fallbackStartAt);
  const tier: DeliveryTier = input.tier ?? (input.rush ? "rush" : "standard");
  const productionDays = tier === "priority"
    ? PRIORITY_PRODUCTION_DAYS
    : tier === "rush"
      ? RUSH_PRODUCTION_DAYS
      : STANDARD_PRODUCTION_DAYS;
  const standardTargetAt = startAt ? addDays(startAt, STANDARD_PRODUCTION_DAYS) : null;
  const rushTargetAt = startAt ? addDays(startAt, RUSH_PRODUCTION_DAYS) : null;
  const priorityTargetAt = startAt ? addDays(startAt, PRIORITY_PRODUCTION_DAYS) : null;
  const selectedTargetAt = startAt ? addDays(startAt, productionDays) : null;
  const safeInHandAt = selectedTargetAt
    ? addDays(selectedTargetAt, input.localPickup ? 0 : SHIPPING_BUFFER_DAYS)
    : null;

  let risk: DeliveryRisk = "no_date";
  let riskLabel = "No requested date";
  let riskDetail = "No customer in-hand date is on file.";

  const evaluatedInHandAt = promisedInHandAt ?? requestedInHandAt;
  if (evaluatedInHandAt && !startAt) {
    risk = "waiting";
    riskLabel = "Clock has not started";
    riskDetail = `Waiting on ${missing.join(", ")}. Do not promise the requested date yet.`;
  } else if (evaluatedInHandAt && startAt && priorityTargetAt && rushTargetAt && standardTargetAt && safeInHandAt) {
    if (evaluatedInHandAt < priorityTargetAt) {
      risk = "not_feasible";
      riskLabel = promisedInHandAt ? "Promised date is inside one week" : "Inside one week";
      riskDetail = "This date is earlier than the one-week Priority target. Escalate immediately; the recorded service level cannot meet it.";
    } else {
      const requiredTier: DeliveryTier = evaluatedInHandAt < rushTargetAt
        ? "priority"
        : evaluatedInHandAt < standardTargetAt
          ? "rush"
          : "standard";
      const rank: Record<DeliveryTier, number> = { standard: 1, rush: 2, priority: 3 };
      if (rank[tier] < rank[requiredTier]) {
        risk = requiredTier === "priority" ? "priority_review" : "rush_needed";
        riskLabel = requiredTier === "priority" ? "Priority review" : "Rush needed";
        riskDetail = requiredTier === "priority"
          ? "Only the internal one-week Priority option may fit. Price and approve it before promising the date."
          : "The date is inside the standard three-week window. A confirmed two-week Rush is required.";
      } else if (evaluatedInHandAt < safeInHandAt) {
        risk = "tight";
        riskLabel = promisedInHandAt ? "Promised date is tight" : `${tier === "priority" ? "Priority" : tier === "rush" ? "Rush" : "Standard"} window is tight`;
        riskDetail = input.localPickup
          ? "The date matches the production target with no recovery buffer."
          : "The production target may fit, but the in-hand date does not leave the recommended carrier buffer.";
      } else {
        risk = "on_track";
        riskLabel = promisedInHandAt ? "Promised date fits" : "Window fits";
        riskDetail = "The selected production target plus the planning buffer fits before the date. Carrier delivery is still an estimate.";
      }
    }
  }

  return {
    tier,
    tierLabel: tier === "priority" ? "Priority · 1 week" : tier === "rush" ? "Rush · 2 weeks" : "Standard · 3 weeks",
    productionDays,
    startAt,
    startEstimated,
    startManual,
    missing,
    standardTargetAt,
    rushTargetAt,
    priorityTargetAt,
    selectedTargetAt,
    safeInHandAt,
    requestedInHandAt,
    promisedInHandAt,
    risk,
    riskLabel,
    riskDetail,
  };
}

export function formatTimelineDate(value: Date | null): string {
  return value
    ? value.toLocaleDateString("en-US", {
        timeZone: "America/New_York",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Not started";
}

/** Needed-by values come from an HTML date field and represent a calendar day,
 * not an instant. UTC formatting prevents the date from moving back one day in
 * Eastern time when the stored value is midnight UTC. */
export function formatRequestedDate(value: Date | null): string {
  return value
    ? value.toLocaleDateString("en-US", {
        timeZone: "UTC",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Not requested";
}

export function customerTimelineMessage(args: {
  firstName?: string | null;
  localPickup?: boolean | null;
  timeline: DeliveryTimeline;
}): string {
  const firstName = args.firstName?.trim().split(/\s+/)[0] || "there";
  const { timeline } = args;
  if (!timeline.startAt) {
    return `Hi ${firstName}, your production clock has not started yet. It begins once your final design is approved, your final roster is submitted, and your deposit is paid. We are still waiting on ${timeline.missing.join(", ")}. Standard production is three weeks from that start date, and shipping time is additional. We have not confirmed your requested date yet.`;
  }

  const handoff = args.localPickup ? "ready for pickup" : "ready to ship";
  const requested = timeline.requestedInHandAt
    ? ` You requested the order in hand by ${formatRequestedDate(timeline.requestedInHandAt)}.`
    : "";
  const promised = timeline.promisedInHandAt
    ? ` We committed to ${formatRequestedDate(timeline.promisedInHandAt)} in writing.`
    : "";
  const started = timeline.startManual
    ? `your recorded production start is ${formatTimelineDate(timeline.startAt)}`
    : timeline.startEstimated
    ? `our records show production began around ${formatTimelineDate(timeline.startAt)}`
    : `your order timeline started ${formatTimelineDate(timeline.startAt)}, when the final design, final roster, and deposit were all complete`;
  const close = args.localPickup
    ? "That is a pickup target, and we will let you know promptly if the timeline changes or the order becomes ready sooner."
    : "Shipping time and carrier delivery dates are additional estimates. We will let you know promptly if the timeline changes and send tracking once the final package is on its way.";
  return `Hi ${firstName}, ${started}. Your current ${timeline.tierLabel.toLowerCase()} production target is ${handoff} by ${formatTimelineDate(timeline.selectedTargetAt)}.${requested}${promised} ${close}`;
}
