import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { designLabVisitors } from "@/db/schema";

// The monetization ladder for the AI design lab:
//   0    generation:  free, anonymous (one free design to hook them)
//   1-7  generations: requires an email/name/phone (lead capture)
//   8+   generations: requires the $10 credited "design session"
export const FREE_GENS = 1;
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

// Clean-master tokens: the unwatermarked render lives in Blob; its URL is
// returned to the browser only as an AES-encrypted token so customers can't
// fish the clean file out of dev tools, while submit can recover it.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

function tokenKey(): Buffer {
  return createHash("sha256").update(`slugger-lab:${process.env.GEMINI_API_KEY ?? "dev"}`).digest();
}

export function encryptCleanUrl(url: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", tokenKey(), iv);
  const enc = Buffer.concat([cipher.update(url, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64url");
}

export function decryptCleanUrl(token: string): string | null {
  try {
    const raw = Buffer.from(token, "base64url");
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const enc = raw.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", tokenKey(), iv);
    decipher.setAuthTag(tag);
    const url = Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
    return url.startsWith("https://") ? url : null;
  } catch {
    return null;
  }
}
