import { NextResponse } from "next/server";
import { dbEnabled } from "@/db";
import { getByManageToken } from "@/lib/design-requests";
import { getStoreByDesignRequestId, updateStoreAppearance, sanitizeSlug } from "@/lib/team-stores";

export const runtime = "nodejs";

// Staff customizes a store's URL, color, and logo (authed by the design's
// manage token, same as store creation).
export async function POST(req: Request) {
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

  let body: { manageToken?: string; slug?: string; color?: string; logoUrl?: string | null } = {};
  try {
    body = await req.json();
  } catch {}
  if (!body.manageToken) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const request = await getByManageToken(body.manageToken);
  if (!request) return NextResponse.json({ error: "Link not found" }, { status: 404 });
  const store = await getStoreByDesignRequestId(request.id);
  if (!store) return NextResponse.json({ error: "No store for this design yet" }, { status: 404 });

  const patch: { slug?: string; primaryColor?: string | null; logoUrl?: string | null } = {};
  if (body.slug !== undefined) {
    const slug = sanitizeSlug(body.slug);
    if (slug.length < 3) return NextResponse.json({ error: "URL must be at least 3 characters (letters/numbers)." }, { status: 400 });
    patch.slug = slug;
  }
  if (body.color !== undefined) {
    if (body.color && !/^#[0-9a-fA-F]{6}$/.test(body.color)) {
      return NextResponse.json({ error: "Color must be a hex value like #1a2b3c." }, { status: 400 });
    }
    patch.primaryColor = body.color || null;
  }
  if (body.logoUrl !== undefined) {
    const u = (body.logoUrl ?? "").trim();
    if (u && !/^https:\/\//.test(u)) return NextResponse.json({ error: "Bad logo URL." }, { status: 400 });
    patch.logoUrl = u || null;
  }

  const result = await updateStoreAppearance(store.id, patch);
  if (!result.ok) {
    return NextResponse.json({ error: "That URL is already taken by another team - try a different one." }, { status: 409 });
  }
  const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://sluggerathletics.com";
  return NextResponse.json({ ok: true, storeUrl: `${SITE}/store/${patch.slug ?? store.slug}` });
}
