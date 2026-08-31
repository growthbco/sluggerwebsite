// Role-based admin auth. The ADMIN_PASSWORD env var is the built-in OWNER
// login; additional users (staff / designer) live in admin_users with their
// own scrypt-hashed passwords. There are no usernames - each person's unique
// password identifies them at login. A signed, expiring httpOnly cookie
// carries {version, expiry, role, name}, HMAC'd with ADMIN_PASSWORD.

import { createHmac, timingSafeEqual, scryptSync, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "sa_admin";
const SESSION_DAYS = 30;
// Bump this to revoke every existing admin session after a permission leak or
// shared-device incident. Old formats are intentionally rejected below.
const SESSION_VERSION = "v2";

export type AdminRole = "owner" | "staff" | "designer" | "follow_up";
export type AdminSession = { role: AdminRole; name: string };

export function adminEnabled(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

function hmac(payload: string): string {
  return createHmac("sha256", process.env.ADMIN_PASSWORD ?? "").update(payload).digest("hex");
}

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const unb64 = (s: string) => Buffer.from(s, "base64url").toString("utf8");

/** Cookie value: "<version>.<expiryMs>.<role>.<b64 name>.<hmac>" - stateless
 *  and tamper-proof. Older formats are rejected so sessions can be revoked. */
export function makeSessionValue(role: AdminRole = "owner", name = "Owner"): string {
  const exp = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const nameB = b64(name.slice(0, 40));
  const payload = `${SESSION_VERSION}.${exp}.${role}.${nameB}`;
  return `${payload}.${hmac(payload)}`;
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
  if (parts.length !== 5) return null;
  const [version, exp, role, nameB, sig] = parts;
  if (version !== SESSION_VERSION) return null;
  if (Number(exp) < Date.now()) return null;
  if (!safeEqual(sig, hmac(`${version}.${exp}.${role}.${nameB}`))) return null;
  if (role !== "owner" && role !== "staff" && role !== "designer" && role !== "follow_up") return null;
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
  "/admin/texts",
  "/admin/design-requests",
  "/admin/team-orders", // the list (read-only production view)
  "/admin/designer-tracking",
  "/admin/designer-invoices",
];
const FOLLOW_UP_ALLOWED_PREFIXES = ["/admin/follow-ups"];

// Order-detail pages are money pages (pricing, invoices, payments), so the
// bare /admin/team-order/ prefix is NOT allowed for designers - only the hat
// production sheet under it is.
function designerAllowsOrderPath(pathname: string): boolean {
  return pathname.startsWith("/admin/team-order/") && pathname.endsWith("/hat-sheet");
}

export function canAccess(role: AdminRole, pathname: string): boolean {
  if (role === "owner") return true;
  if (pathname.startsWith("/admin/settings")) return false;
  if (role === "staff") return true;
  if (pathname === "/admin" || pathname === "/admin/login") return true;
  if (role === "follow_up") {
    return FOLLOW_UP_ALLOWED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  }
  if (designerAllowsOrderPath(pathname)) return true;
  return DESIGNER_ALLOWED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
}

/* ── API-layer role gate ────────────────────────────────────────── */
// Page redirects (canAccess) are NOT enough: an authenticated designer can
// call admin APIs directly with their cookie. These helpers enforce role at
// the API layer. "production" = shared designer/staff workflow;
// "conversations" = the shared customer message inbox; "customer" = broader
// contact details, calls, addresses, and CRM records; "money" = pricing,
// invoicing, payment, shipping, and store mutations; "settings" = user
// management. Designers can work conversations without gaining the broader
// customer/money/settings permissions. Follow-up users get only their queue
// and the browser softphone.
export type AdminApiArea = "production" | "conversations" | "follow_up" | "voice" | "customer" | "money" | "settings";

export function canAccessApi(role: AdminRole, area: AdminApiArea): boolean {
  if (role === "owner") return true;
  if (role === "staff") return area !== "settings";
  if (role === "designer") return area === "production" || area === "conversations";
  return area === "follow_up" || area === "voice";
}

export async function requireApiRole(area: AdminApiArea): Promise<{ ok: true; session: AdminSession } | { ok: false; status: 401 | 403 }> {
  const session = await getAdminSession();
  if (!session) return { ok: false, status: 401 };
  if (!canAccessApi(session.role, area)) return { ok: false, status: 403 };
  return { ok: true, session };
}
