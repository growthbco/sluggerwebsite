import { NextResponse } from "next/server";
import { dbEnabled } from "@/db";
import { requireApiRole } from "@/lib/admin-auth";
import { updateStoreItemDesigns } from "@/lib/team-stores";

export const runtime = "nodejs";

// Staff manages the colorway photos parents choose from on a store item.
// Body: { teamId, itemKey, designs: [{label, image}], itemImage? }.
export async function POST(req: Request) {
  const gate = await requireApiRole("money");
  if (!gate.ok) return NextResponse.json({ error: gate.status === 401 ? "Not signed in" : "Not allowed" }, { status: gate.status });
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  let body: { teamId?: string; itemKey?: string; designs?: { label?: string; image?: string }[]; itemImage?: string | null } = {};
  try {
    body = await req.json();
  } catch {}
  if (!body.teamId || !body.itemKey) return NextResponse.json({ error: "Missing teamId or itemKey" }, { status: 400 });
  if (!Array.isArray(body.designs)) return NextResponse.json({ error: "designs must be an array" }, { status: 400 });

  const designs: { label: string; image: string }[] = [];
  for (const d of body.designs) {
    const label = (d.label ?? "").trim();
    const image = (d.image ?? "").trim();
    if (!label) return NextResponse.json({ error: "Every color option needs a name." }, { status: 400 });
    if (!/^https:\/\//.test(image)) return NextResponse.json({ error: `"${label}" is missing a photo.` }, { status: 400 });
    designs.push({ label, image });
  }
  if (designs.length > 24) return NextResponse.json({ error: "Too many color options (max 24)." }, { status: 400 });

  let itemImage: string | null | undefined;
  if (body.itemImage !== undefined) {
    const u = (body.itemImage ?? "").trim();
    if (u && !/^https:\/\//.test(u)) return NextResponse.json({ error: "Bad item image URL." }, { status: 400 });
    itemImage = u || null;
  }

  const result = await updateStoreItemDesigns(body.teamId, body.itemKey, designs, itemImage);
  if (!result.ok) return NextResponse.json({ error: result.error ?? "Failed" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
