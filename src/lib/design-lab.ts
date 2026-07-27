import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { designLabVisitors } from "@/db/schema";

// The monetization ladder for the AI design lab:
//   0-2  generations: free, anonymous
//   3-7  generations: requires an email (lead capture)
//   8+   generations: requires the $10 credited "design session"
export const FREE_GENS = 3;
export const EMAIL_GENS = 8;
export const PAID_GENS = 100; // sanity ceiling even for paid sessions

export const LAB_COOKIE = "sa_lab";

export type LabVisitor = typeof designLabVisitors.$inferSelect;

export async function getOrCreateVisitor(): Promise<{ visitor: LabVisitor; setCookie?: string } | null> {
  if (!dbEnabled()) return null;
  const db = getDb();
  const jar = await cookies();
  const existingKey = jar.get(LAB_COOKIE)?.value;
  if (existingKey) {
    const [row] = await db.select().from(designLabVisitors).where(eq(designLabVisitors.visitorKey, existingKey)).limit(1);
    if (row) return { visitor: row };
  }
  const key = crypto.randomUUID();
  const [row] = await db.insert(designLabVisitors).values({ visitorKey: key }).returning();
  return { visitor: row, setCookie: key };
}

/** What this visitor is allowed to do next. */
export function tierFor(v: LabVisitor): { allowed: boolean; need?: "email" | "upgrade" } {
  if (v.paidAt) return { allowed: v.generations < PAID_GENS };
  if (v.generations < FREE_GENS) return { allowed: true };
  if (!v.email) return { allowed: false, need: "email" };
  if (v.generations < EMAIL_GENS) return { allowed: true };
  return { allowed: false, need: "upgrade" };
}
