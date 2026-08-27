"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { operationalEvents } from "@/db/schema";
import { requireApiRole } from "@/lib/admin-auth";

export async function resolveOperationalEvent(formData: FormData): Promise<void> {
  const gate = await requireApiRole("money");
  if (!gate.ok) throw new Error(gate.status === 401 ? "Unauthorized" : "Forbidden");

  const id = formData.get("id");
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid alert");

  await getDb()
    .update(operationalEvents)
    .set({ resolvedAt: new Date(), resolvedBy: gate.session.name })
    .where(eq(operationalEvents.id, id));

  revalidatePath("/admin");
}
