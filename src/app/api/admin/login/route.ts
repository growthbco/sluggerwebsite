import { NextResponse } from "next/server";
import { adminEnabled, checkPassword, makeSessionValue, ADMIN_COOKIE } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!adminEnabled()) {
    return NextResponse.json({ error: "Admin login isn't configured (ADMIN_PASSWORD not set)." }, { status: 503 });
  }
  let body: { password?: string } = {};
  try {
    body = await req.json();
  } catch {}
  if (!body.password || !checkPassword(body.password)) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, makeSessionValue(), {
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
