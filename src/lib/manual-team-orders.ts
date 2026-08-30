import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { teamOrders } from "@/db/schema";
import { createTeamOrder } from "@/lib/team-orders";
import { buildDeliveryTimeline } from "@/lib/delivery-timeline";
import { emailOrderTimelineConfirmation } from "@/lib/email";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export const manualTeamOrderSchema = z
  .object({
    teamName: z.string().trim().min(1, "Team name is required."),
    contactName: z.string().trim().min(1, "Contact name is required."),
    contactEmail: z.string().trim().email("Enter a valid contact email."),
    contactPhone: z.string().trim().optional().default(""),
    sport: z.string().trim().optional().default(""),
    items: z.array(z.string().trim().min(1)).min(1, "Select at least one item."),
    localPickup: z.boolean().default(false),
    specialInstructions: z.string().trim().max(4000).optional().default(""),
    productionStartDate: z.string().regex(DATE_ONLY, "Production start date is required."),
    serviceLevel: z.enum(["standard", "rush", "priority"]),
    requestedInHandDate: z.string().regex(DATE_ONLY, "Requested in-hand date is required."),
    customerDatePromised: z.boolean(),
    promisedInHandDate: z.string().optional().default(""),
    priorityFeeCents: z.number().int().min(0).default(0),
  })
  .superRefine((value, ctx) => {
    if (value.customerDatePromised && !DATE_ONLY.test(value.promisedInHandDate)) {
      ctx.addIssue({ code: "custom", path: ["promisedInHandDate"], message: "Enter the date you promised the customer." });
    }
    if (!value.customerDatePromised && value.promisedInHandDate) {
      ctx.addIssue({ code: "custom", path: ["promisedInHandDate"], message: "Remove the promised date or mark that a date was promised." });
    }
    if (value.serviceLevel === "priority" && value.priorityFeeCents <= 0) {
      ctx.addIssue({ code: "custom", path: ["priorityFeeCents"], message: "Enter the one-week Priority premium." });
    }
    if (value.serviceLevel !== "priority" && value.priorityFeeCents !== 0) {
      ctx.addIssue({ code: "custom", path: ["priorityFeeCents"], message: "A custom premium applies only to Priority orders." });
    }
  });

export type ManualTeamOrderInput = z.infer<typeof manualTeamOrderSchema>;

/** Preserve an HTML date field as a calendar day instead of UTC midnight,
 * which would display as the previous date in Eastern time. */
function calendarDate(value: string): Date {
  return new Date(`${value}T12:00:00-04:00`);
}

export async function createManualTeamOrder(raw: unknown) {
  const parsed = manualTeamOrderSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false as const,
      fieldErrors: parsed.error.flatten().fieldErrors,
      error: parsed.error.issues[0]?.message ?? "Check the required manual-order fields.",
    };
  }

  const input = parsed.data;
  const created = await createTeamOrder({
    teamName: input.teamName,
    contactName: input.contactName,
    contactEmail: input.contactEmail,
    contactPhone: input.contactPhone || undefined,
    sport: input.sport || undefined,
    items: input.items,
    rushShipping: input.serviceLevel === "rush",
    manualTimeline: {
      startAt: calendarDate(input.productionStartDate),
      tier: input.serviceLevel,
      requestedInHandAt: calendarDate(input.requestedInHandDate),
      customerDatePromised: input.customerDatePromised,
      promisedInHandAt: input.customerDatePromised ? calendarDate(input.promisedInHandDate) : undefined,
      priorityFeeCents: input.serviceLevel === "priority" ? input.priorityFeeCents : 0,
    },
  });

  await getDb()
    .update(teamOrders)
    .set({
      status: "in_production",
      localPickup: input.localPickup,
      specialInstructions: input.specialInstructions || null,
      source: "Manual entry",
      updatedAt: new Date(),
    })
    .where(eq(teamOrders.id, created.id));

  const timeline = buildDeliveryTimeline({
    timelineStartAt: calendarDate(input.productionStartDate),
    requestedInHandAt: calendarDate(input.requestedInHandDate),
    promisedInHandAt: input.customerDatePromised ? calendarDate(input.promisedInHandDate) : null,
    tier: input.serviceLevel,
    localPickup: input.localPickup,
  });
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://sluggerathletics.com";
  const emailed = await emailOrderTimelineConfirmation({
    to: input.contactEmail,
    teamName: input.teamName,
    reference: created.reference,
    timeline,
    localPickup: input.localPickup,
    manageUrl: `${site}/team-order/manage/${created.manageToken}`,
  });

  return { ok: true as const, ...created, emailed };
}
