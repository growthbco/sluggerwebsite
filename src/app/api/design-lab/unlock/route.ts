import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, dbEnabled } from "@/db";
import { designLabVisitors } from "@/db/schema";
import { getOrCreateVisitor, LAB_COOKIE } from "@/lib/design-lab";

export const runtime = "nodejs";

// Email gate: unlocks generations 4-8 and records the lead.
export async function POST(req: Request) {
  if (!dbEnabled()) return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  let body: { email?: string; firstName?: string; lastName?: string; phone?: string } = {};
  try { body = await req.json(); } catch {}
  const email = (body.email ?? "").trim().toLowerCase();
  const firstName = (body.firstName ?? "").trim().slice(0, 40);
  const lastName = (body.lastName ?? "").trim().slice(0, 40);
  const phone = (body.phone ?? "").replace(/[^\d+()\-\s]/g, "").trim().slice(0, 20);
  if (!firstName || !lastName) return NextResponse.json({ error: "Enter your first and last name" }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email" }, { status: 400 });
  }
  if (phone.replace(/\D/g, "").length < 10) {
    return NextResponse.json({ error: "Enter a valid phone number" }, { status: 400 });
  }
  const ctx = await getOrCreateVisitor();
  if (!ctx) return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  await getDb().update(designLabVisitors).set({ email, firstName, lastName, phone }).where(eq(designLabVisitors.id, ctx.visitor.id));

  // Lead ping to the design Discord (best effort).
  const hook = process.env.DISCORD_DESIGN_REQUESTS_WEBHOOK_URL;
  if (hook) {
    void fetch(hook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Slugger AI Design Lab",
        content: `🧪 **Jersey Maker lead**: ${firstName} ${lastName} · ${email} · ${phone} (used ${ctx.visitor.generations} generations so far)`,
      }),
    }).catch(() => {});
  }

  const res = NextResponse.json({ ok: true });
  if (ctx.setCookie) res.cookies.set(LAB_COOKIE, ctx.setCookie, { httpOnly: true, maxAge: 60 * 60 * 24 * 365, path: "/" });
  return res;
}
