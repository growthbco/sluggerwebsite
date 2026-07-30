import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { sql, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { customers, orders, teamOrders, designRequests, customInvoices } from "@/db/schema";

export type Customer = typeof customers.$inferSelect;

// Referral codes are shared out loud and typed by hand, so we drop the
// ambiguous glyphs (0/O, 1/I/L) entirely.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomCode(len = 6): string {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

/** Generate a referral code not already taken. */
async function uniqueReferralCode(): Promise<string> {
  const db = getDb();
  for (let i = 0; i < 8; i++) {
    const code = randomCode();
    const [hit] = await db.select({ id: customers.id }).from(customers).where(eq(customers.referralCode, code));
    if (!hit) return code;
  }
  // Vanishingly unlikely; widen to avoid an infinite loop.
  return randomCode(9);
}

/**
 * Fetch the customer profile for an email, creating it lazily if missing.
 * Backfills name/phone from the passed values when the row has none.
 */
export async function getOrCreateCustomer(email: string, seed?: { name?: string | null; phone?: string | null }): Promise<Customer> {
  const db = getDb();
  const e = email.trim().toLowerCase();
  const [existing] = await db.select().from(customers).where(eq(customers.email, e));
  if (existing) {
    // Backfill contact if we learned it and the profile is blank.
    const patch: Partial<Customer> = {};
    if (!existing.name && seed?.name) patch.name = seed.name;
    if (!existing.phone && seed?.phone) patch.phone = seed.phone;
    if (Object.keys(patch).length) {
      const [updated] = await db.update(customers).set({ ...patch, updatedAt: new Date() }).where(eq(customers.id, existing.id)).returning();
      return updated;
    }
    return existing;
  }
  const referralCode = await uniqueReferralCode();
  // Guard against a race creating the same email twice: on conflict, re-read.
  const inserted = await db
    .insert(customers)
    .values({ email: e, name: seed?.name ?? null, phone: seed?.phone ?? null, referralCode })
    .onConflictDoNothing({ target: customers.email })
    .returning();
  if (inserted[0]) return inserted[0];
  const [row] = await db.select().from(customers).where(eq(customers.email, e));
  return row;
}

/** Look up a profile without creating one. */
export async function getCustomer(email: string): Promise<Customer | null> {
  const db = getDb();
  const [row] = await db.select().from(customers).where(eq(customers.email, email.trim().toLowerCase()));
  return row ?? null;
}

/**
 * Update editable contact fields and propagate name/phone across the buyer's
 * existing order records so staff and confirmations stay in sync. Email is the
 * portal key, so it is NOT changed here.
 */
export async function updateContact(email: string, patch: { name?: string; phone?: string }): Promise<Customer> {
  const db = getDb();
  const e = email.trim().toLowerCase();
  const c = await getOrCreateCustomer(e);
  const name = patch.name?.trim();
  const phone = patch.phone?.trim();
  const [updated] = await db
    .update(customers)
    .set({ name: name || c.name, phone: phone || c.phone, updatedAt: new Date() })
    .where(eq(customers.id, c.id))
    .returning();
  // Propagate the display name / phone onto existing orders (denormalized copies).
  if (name) {
    await Promise.all([
      db.update(orders).set({ customerName: name }).where(sql`lower(${orders.customerEmail}) = ${e}`),
      db.update(teamOrders).set({ contactName: name }).where(sql`lower(${teamOrders.contactEmail}) = ${e}`),
      db.update(designRequests).set({ contactName: name }).where(sql`lower(${designRequests.contactEmail}) = ${e}`),
      db.update(customInvoices).set({ customerName: name }).where(sql`lower(${customInvoices.customerEmail}) = ${e}`),
    ]);
  }
  if (phone) {
    // Phone lives under different column names per table; update where present.
    await Promise.all([
      db.update(teamOrders).set({ contactPhone: phone }).where(sql`lower(${teamOrders.contactEmail}) = ${e}`).catch(() => {}),
      db.update(designRequests).set({ contactPhone: phone }).where(sql`lower(${designRequests.contactEmail}) = ${e}`).catch(() => {}),
    ]);
  }
  return updated;
}

/* ------------------------------- Passwords ------------------------------ */

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, 64);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export async function setPassword(email: string, password: string): Promise<void> {
  const db = getDb();
  const c = await getOrCreateCustomer(email);
  await db.update(customers).set({ passwordHash: hashPassword(password), updatedAt: new Date() }).where(eq(customers.id, c.id));
}

/* ------------------------------- Referrals ------------------------------ */

// Both sides earn this much store credit when a referred customer's first
// order is paid.
export const REFERRAL_REWARD_CENTS = 2500;

/**
 * Attribute a new customer to a referrer's code. No-op if the customer was
 * already attributed, if the code is unknown, or if they'd refer themselves.
 * Returns the referrer's email when a fresh attribution is recorded.
 */
export async function attributeReferral(email: string, code: string): Promise<string | null> {
  const db = getDb();
  const clean = code.trim().toUpperCase();
  if (!clean) return null;
  const [referrer] = await db.select().from(customers).where(eq(customers.referralCode, clean));
  if (!referrer) return null;
  const customer = await getOrCreateCustomer(email);
  if (customer.referredByCode || referrer.id === customer.id) return null;
  await db.update(customers).set({ referredByCode: clean, updatedAt: new Date() }).where(eq(customers.id, customer.id));
  return referrer.email;
}

/** Add store credit to the referrer identified by a referral code. */
export async function creditReferrer(code: string, cents: number): Promise<void> {
  if (cents <= 0) return;
  const db = getDb();
  const clean = code.trim().toUpperCase();
  await db
    .update(customers)
    .set({ referralCreditCents: sql`${customers.referralCreditCents} + ${cents}`, updatedAt: new Date() })
    .where(eq(customers.referralCode, clean));
}

/**
 * Redeem (subtract) store credit from a customer, bounded at zero so we never
 * go negative even if the balance changed since an invoice was generated.
 * Returns the amount actually redeemed.
 */
export async function redeemCredit(email: string, cents: number): Promise<number> {
  if (cents <= 0) return 0;
  const db = getDb();
  const c = await getCustomer(email);
  if (!c) return 0;
  const take = Math.min(cents, c.referralCreditCents);
  if (take <= 0) return 0;
  await db
    .update(customers)
    .set({ referralCreditCents: sql`${customers.referralCreditCents} - ${take}`, updatedAt: new Date() })
    .where(eq(customers.id, c.id));
  return take;
}

/** Add store credit to a customer by email (creates the profile if needed). */
export async function creditCustomer(email: string, cents: number): Promise<void> {
  if (cents <= 0) return;
  const db = getDb();
  const c = await getOrCreateCustomer(email);
  await db
    .update(customers)
    .set({ referralCreditCents: sql`${customers.referralCreditCents} + ${cents}`, updatedAt: new Date() })
    .where(eq(customers.id, c.id));
}

/**
 * Grant the referral reward for a customer's first paid order, exactly once.
 * No-op unless they were referred (referredByCode set) and haven't been
 * rewarded yet. Idempotent via referralRewardedAt, so it's safe to call on
 * every paid order. Returns the referrer's email when a reward is granted.
 */
export async function grantReferralRewardIfDue(email: string): Promise<string | null> {
  const db = getDb();
  const c = await getOrCreateCustomer(email);
  if (!c.referredByCode || c.referralRewardedAt) return null;
  // Claim the reward slot atomically so concurrent webhooks can't double-pay.
  const [claimed] = await db
    .update(customers)
    .set({ referralRewardedAt: new Date(), updatedAt: new Date() })
    .where(sql`${customers.id} = ${c.id} AND ${customers.referralRewardedAt} IS NULL AND ${customers.referredByCode} IS NOT NULL`)
    .returning({ code: customers.referredByCode });
  if (!claimed?.code) return null;
  const [referrer] = await db.select({ email: customers.email }).from(customers).where(eq(customers.referralCode, claimed.code));
  await Promise.all([creditReferrer(claimed.code, REFERRAL_REWARD_CENTS), creditCustomer(email, REFERRAL_REWARD_CENTS)]);
  return referrer?.email ?? null;
}

/**
 * Settle referrals for a paid order. First records attribution when a code is
 * supplied (from the /r/<code> cookie), then grants the one-time reward if the
 * customer is attributed. Safe to call on every paid session; the code is
 * optional so staff-generated invoices (no cookie) still settle a prior
 * attribution. Returns the referrer's email when a reward is granted.
 */
export async function settleReferral(email: string | null | undefined, code?: string | null): Promise<string | null> {
  if (!email) return null;
  if (code) await attributeReferral(email, code);
  return grantReferralRewardIfDue(email);
}
