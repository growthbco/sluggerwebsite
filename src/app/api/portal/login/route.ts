import { NextResponse } from "next/server";
import { dbEnabled } from "@/db";
import { makePortalToken } from "@/lib/portal";
import { getCustomer, verifyPassword } from "@/lib/customers";

export const runtime = "nodejs";

// Optional password login. Returns a portal token on success. Generic error on
// failure so we never reveal whether an email or password was the mismatch.
export async function POST(req: Request) {
  if (!dbEnabled()) return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email || !password) return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });

  const customer = await getCustomer(email);
  if (!customer || !verifyPassword(password, customer.passwordHash)) {
    return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  }
  return NextResponse.json({ ok: true, token: makePortalToken(email) });
}
