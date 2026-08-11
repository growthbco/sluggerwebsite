import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { adminUsers } from "@/db/schema";
import { adminEnabled, checkPassword, verifyPassword, makeSessionValue, ADMIN_COOKIE, type AdminRole } from "@/lib/admin-auth";

export const runtime = "nodejs";

// One password box, many people: the owner's ADMIN_PASSWORD or any active
// admin_users password logs its person in with their role attached.
export async function POST(req: Request) {
  if (!adminEnabled()) {
    return NextResponse.json({ error: "Admin login isn't configured (ADMIN_PASSWORD not set)." }, { status: 503 });
  }
  let body: { password?: string } = {};
  try {
    body = await req.json();
  } catch {}
  const password = body.password ?? "";
  if (!password) return NextResponse.json({ error: "Wrong password" }, { status: 401 });

  let session: { role: AdminRole; name: string } | null = null;
  if (checkPassword(password)) {
    session = { role: "owner", name: "Gary" };
  } else if (dbEnabled()) {
    const users = await getDb().select().from(adminUsers).where(eq(adminUsers.active, true));
    for (const u of users) {
      if (verifyPassword(password, u.passwordHash)) {
        session = { role: (u.role as AdminRole) ?? "staff", name: u.name };
        break;
      }
    }
  }
  if (!session) return NextResponse.json({ error: "Wrong password" }, { status: 401 });

  const res = NextResponse.json({ ok: true, name: session.name, role: session.role });
  res.cookies.set(ADMIN_COOKIE, makeSessionValue(session.role, session.name), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
  return res;
}

// Logout: clear the session cookie.
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
