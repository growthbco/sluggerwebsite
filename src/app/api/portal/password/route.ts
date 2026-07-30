import { NextResponse } from "next/server";
import { readPortalToken } from "@/lib/portal";
import { setPassword } from "@/lib/customers";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : "";
  const email = readPortalToken(token);
  if (!email) return NextResponse.json({ error: "Your session expired. Request a fresh link." }, { status: 401 });

  const password = typeof body?.password === "string" ? body.password : "";
  if (password.length < 8) return NextResponse.json({ error: "Use at least 8 characters." }, { status: 400 });
  if (password.length > 200) return NextResponse.json({ error: "That password is too long." }, { status: 400 });

  await setPassword(email, password);
  return NextResponse.json({ ok: true });
}
