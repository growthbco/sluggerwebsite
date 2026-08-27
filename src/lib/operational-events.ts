import { sql } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { operationalEvents } from "@/db/schema";

type OperationalFailure = {
  fingerprint: string;
  kind: "checkout_failed" | "webhook_failed";
  title: string;
  error?: unknown;
  href?: string;
  context?: Record<string, string | number | boolean | null | undefined>;
};

function errorDetail(error: unknown): string | null {
  const value = error instanceof Error ? error.message : typeof error === "string" ? error : null;
  return value?.trim().slice(0, 500) || null;
}

/** Best-effort only: recording an alert must never break the customer flow. */
export async function recordOperationalFailure(input: OperationalFailure): Promise<void> {
  if (!dbEnabled()) return;

  const now = new Date();
  const context = input.context
    ? Object.fromEntries(Object.entries(input.context).filter((entry): entry is [string, string | number | boolean | null] => entry[1] !== undefined))
    : undefined;

  try {
    await getDb()
      .insert(operationalEvents)
      .values({
        fingerprint: input.fingerprint.slice(0, 180),
        kind: input.kind,
        title: input.title.slice(0, 180),
        detail: errorDetail(input.error),
        href: input.href?.slice(0, 300),
        context,
        firstSeenAt: now,
        lastSeenAt: now,
      })
      .onConflictDoUpdate({
        target: operationalEvents.fingerprint,
        set: {
          kind: input.kind,
          title: input.title.slice(0, 180),
          detail: errorDetail(input.error),
          href: input.href?.slice(0, 300),
          context,
          occurrences: sql`${operationalEvents.occurrences} + 1`,
          lastSeenAt: now,
          resolvedAt: null,
          resolvedBy: null,
        },
      });
  } catch (recordingError) {
    console.error("Could not record operational alert:", recordingError);
  }
}
