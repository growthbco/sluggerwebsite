import { NextResponse } from "next/server";
import { readPortalToken } from "@/lib/portal";
import { updateContact } from "@/lib/customers";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : "";
  const email = readPortalToken(token);
  if (!email) return NextResponse.json({ error: "Your session expired. Request a fresh link." }, { status: 401 });

  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 120) : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim().slice(0, 40) : "";
  if (!name && !phone) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  const c = await updateContact(email, { name, phone });
  return NextResponse.json({ ok: true, name: c.name, phone: c.phone });
}
