// Role-based admin auth. The ADMIN_PASSWORD env var is the built-in OWNER
// login; additional users (staff / designer) live in admin_users with their
// own scrypt-hashed passwords. There are no usernames - each person's unique
// password identifies them at login. A signed, expiring httpOnly cookie
// carries {expiry, role, name}, HMAC'd with ADMIN_PASSWORD.

import { createHmac, timingSafeEqual, scryptSync, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "sa_admin";
const SESSION_DAYS = 30;

export type AdminRole = "owner" | "staff" | "designer";
export type AdminSession = { role: AdminRole; name: string };

export function adminEnabled(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

function hmac(payload: string): string {
  return createHmac("sha256", process.env.ADMIN_PASSWORD ?? "").update(payload).digest("hex");
}

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const unb64 = (s: string) => Buffer.from(s, "base64url").toString("utf8");

/** Cookie value: "<expiryMs>.<role>.<b64 name>.<hmac>" - stateless and
 *  tamper-proof. Legacy two-part cookies (pre-roles) still verify as owner. */
export function makeSessionValue(role: AdminRole = "owner", name = "Owner"): string {
  const exp = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const nameB = b64(name.slice(0, 40));
  return `${exp}.${role}.${nameB}.${hmac(`${exp}.${role}.${nameB}`)}`;
}

function safeEqual(a: string, b: string): boolean {
  try {
    return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

export function parseSessionValue(value: string | undefined): AdminSession | null {
  if (!value || !adminEnabled()) return null;
  const parts = value.split(".");
  if (parts.length === 2) {
    // Legacy cookie from before roles existed: treat as owner.
    const [exp, sig] = parts;
    if (Number(exp) < Date.now() || !safeEqual(sig, hmac(exp))) return null;
    return { role: "owner", name: "Owner" };
  }
  if (parts.length !== 4) return null;
  const [exp, role, nameB, sig] = parts;
  if (Number(exp) < Date.now()) return null;
  if (!safeEqual(sig, hmac(`${exp}.${role}.${nameB}`))) return null;
  if (role !== "owner" && role !== "staff" && role !== "designer") return null;
  try {
    return { role, name: unb64(nameB) || "Staff" };
  } catch {
    return null;
  }
}

export function verifySessionValue(value: string | undefined): boolean {
  return parseSessionValue(value) !== null;
}

/** The built-in owner password (ADMIN_PASSWORD). */
export function checkPassword(password: string): boolean {
  const real = process.env.ADMIN_PASSWORD;
  return Boolean(real) && safeEqual(password, real!);
}

/* ── User passwords (admin_users table) ─────────────────────────── */

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 32).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  try {
    return timingSafeEqual(scryptSync(password, salt, 32), Buffer.from(hash, "hex"));
  } catch {
    return false;
  }
}

/* ── Request helpers ────────────────────────────────────────────── */

export async function getAdminSession(): Promise<AdminSession | null> {
  const jar = await cookies();
  return parseSessionValue(jar.get(ADMIN_COOKIE)?.value);
}

/** For server components: is the current request any authed admin user? */
export async function isAdmin(): Promise<boolean> {
  return (await getAdminSession()) !== null;
}

/* ── Role permissions ───────────────────────────────────────────── */

// Everything a designer may open. Staff and owner see all pages; only the
// owner manages users in Settings.
const DESIGNER_ALLOWED_PREFIXES = [
  "/admin/design-requests",
  "/admin/team-orders",
  "/admin/team-order/", // order detail + hat sheets (production info)
  "/admin/texts",
  "/admin/design-lab",
];

export function canAccess(role: AdminRole, pathname: string): boolean {
  if (role === "owner") return true;
  if (pathname.startsWith("/admin/settings")) return false;
  if (role === "staff") return true;
  if (pathname === "/admin" || pathname === "/admin/login") return true;
  return DESIGNER_ALLOWED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
}
