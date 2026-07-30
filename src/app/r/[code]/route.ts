import { NextResponse } from "next/server";

export const runtime = "nodejs";

// A referral link. We stash the code in a cookie (read later at checkout) and
// send the visitor to the team-order page - the main conversion path. We do NOT
// look the code up here; validation happens when an order is actually placed.
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const clean = (code || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
  const res = NextResponse.redirect(new URL("/team-order", process.env.NEXT_PUBLIC_SITE_URL || "https://sluggerathletics.com"));
  if (clean) {
    res.cookies.set("slugger_ref", clean, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
  }
  return res;
}
