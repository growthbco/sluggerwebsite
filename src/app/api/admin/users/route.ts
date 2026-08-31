import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { dbEnabled, getDb } from "@/db";
import { adminUsers } from "@/db/schema";
import { getAdminSession, hashPassword } from "@/lib/admin-auth";

export const runtime = "nodejs";

// Owner-only user management for the Settings page.
async function requireOwner() {
  const s = await getAdminSession();
  return s?.role === "owner" ? s : null;
}

export async function GET() {
  if (!(await requireOwner())) return NextResponse.json({ error: "Owner only" }, { status: 403 });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const users = await getDb()
    .select({ id: adminUsers.id, name: adminUsers.name, role: adminUsers.role, active: adminUsers.active, createdAt: adminUsers.createdAt })
    .from(adminUsers)
    .orderBy(adminUsers.createdAt);
  return NextResponse.json({ users });
}

// POST {name, role, password} -> create a user with their own password.
export async function POST(req: Request) {
  if (!(await requireOwner())) return NextResponse.json({ error: "Owner only" }, { status: 403 });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  let body: { name?: string; role?: string; password?: string } = {};
  try { body = await req.json(); } catch {}
  const name = (body.name ?? "").trim().slice(0, 40);
  const role = ["owner", "staff", "designer", "follow_up"].includes(body.role ?? "") ? body.role! : "staff";
  const password = body.password ?? "";
  if (!name) return NextResponse.json({ error: "Enter a name." }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  if (password === process.env.ADMIN_PASSWORD) return NextResponse.json({ error: "That password is taken." }, { status: 400 });

  const [row] = await getDb()
    .insert(adminUsers)
    .values({ name, role, passwordHash: hashPassword(password) })
    .returning({ id: adminUsers.id, name: adminUsers.name, role: adminUsers.role, active: adminUsers.active });
  return NextResponse.json({ ok: true, user: row });
}

// PUT {id, role?, active?, password?} -> update a user.
export async function PUT(req: Request) {
  if (!(await requireOwner())) return NextResponse.json({ error: "Owner only" }, { status: 403 });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  let body: { id?: string; role?: string; active?: boolean; password?: string } = {};
  try { body = await req.json(); } catch {}
  if (!body.id) return NextResponse.json({ error: "Missing user id" }, { status: 400 });

  const set: Record<string, unknown> = {};
  if (body.role && ["owner", "staff", "designer", "follow_up"].includes(body.role)) set.role = body.role;
  if (typeof body.active === "boolean") set.active = body.active;
  if (body.password) {
    if (body.password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    set.passwordHash = hashPassword(body.password);
  }
  if (Object.keys(set).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  await getDb().update(adminUsers).set(set).where(eq(adminUsers.id, body.id));
  return NextResponse.json({ ok: true });
}

// DELETE {id} -> remove a user entirely.
export async function DELETE(req: Request) {
  if (!(await requireOwner())) return NextResponse.json({ error: "Owner only" }, { status: 403 });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  let body: { id?: string } = {};
  try { body = await req.json(); } catch {}
  if (!body.id) return NextResponse.json({ error: "Missing user id" }, { status: 400 });
  await getDb().delete(adminUsers).where(eq(adminUsers.id, body.id));
  return NextResponse.json({ ok: true });
}
