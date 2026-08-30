"use server";

import { redirect } from "next/navigation";
import { dbEnabled } from "@/db";
import { requireApiRole } from "@/lib/admin-auth";
import { createManualTeamOrder } from "@/lib/manual-team-orders";

export type ManualOrderActionState = {
  error?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export async function createManualOrderAction(
  _previous: ManualOrderActionState,
  formData: FormData,
): Promise<ManualOrderActionState> {
  const gate = await requireApiRole("money");
  if (!gate.ok) return { error: gate.status === 403 ? "You cannot create manual orders." : "Sign in again." };
  if (!dbEnabled()) return { error: "Database not configured." };

  const priorityDollars = Number(formData.get("priorityFeeDollars") || 0);
  let result;
  try {
    result = await createManualTeamOrder({
      teamName: String(formData.get("teamName") ?? ""),
      contactName: String(formData.get("contactName") ?? ""),
      contactEmail: String(formData.get("contactEmail") ?? ""),
      contactPhone: String(formData.get("contactPhone") ?? ""),
      sport: String(formData.get("sport") ?? ""),
      items: formData.getAll("items").map(String),
      localPickup: formData.get("localPickup") === "on",
      specialInstructions: String(formData.get("specialInstructions") ?? ""),
      productionStartDate: String(formData.get("productionStartDate") ?? ""),
      serviceLevel: String(formData.get("serviceLevel") ?? ""),
      requestedInHandDate: String(formData.get("requestedInHandDate") ?? ""),
      customerDatePromised: formData.get("customerDatePromised") === "yes",
      promisedInHandDate: String(formData.get("promisedInHandDate") ?? ""),
      priorityFeeCents: Number.isFinite(priorityDollars) ? Math.round(priorityDollars * 100) : 0,
    });
  } catch (error) {
    console.error("Manual order action failed:", error);
    return { error: "Could not create the manual order." };
  }

  if (!result.ok) return { error: result.error, fieldErrors: result.fieldErrors };
  redirect(`/admin/team-order/${result.id}`);
}
