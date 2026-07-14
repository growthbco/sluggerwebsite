// Single-password admin auth. ADMIN_PASSWORD (env) gates /admin; a signed,
// expiring httpOnly cookie keeps the session. No user table needed - there is
// one admin login shared by staff.

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "sa_admin";
const SESSION_DAYS = 30;

export function adminEnabled(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

function hmac(payload: string): string {
  return createHmac("sha256", process.env.ADMIN_PASSWORD ?? "").update(payload).digest("hex");
}

/** Cookie value: "<expiryMs>.<hmac(expiryMs)>" - stateless and tamper-proof. */
export function makeSessionValue(): string {
  const exp = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  return `${exp}.${hmac(String(exp))}`;
}

export function verifySessionValue(value: string | undefined): boolean {
  if (!value || !adminEnabled()) return false;
  const [exp, sig] = value.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const expected = hmac(exp);
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function checkPassword(password: string): boolean {
  const real = process.env.ADMIN_PASSWORD;
  if (!real) return false;
  try {
    return password.length === real.length && timingSafeEqual(Buffer.from(password), Buffer.from(real));
  } catch {
    return false;
  }
}

/** For server components: is the current request an authed admin? */
export async function isAdmin(): Promise<boolean> {
  const jar = await cookies();
  return verifySessionValue(jar.get(ADMIN_COOKIE)?.value);
}
