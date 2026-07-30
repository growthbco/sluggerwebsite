import { NextResponse } from "next/server";
import { dbEnabled } from "@/db";
import { getCustomerOrders, makePortalToken } from "@/lib/portal";
import { sendEmail } from "@/lib/email";

export const runtime = "nodejs";

// Email a customer a magic link to their order portal. Always responds ok
// (never reveals whether an email has orders) to avoid account enumeration.
export async function POST(req: Request) {
  if (!dbEnabled()) return NextResponse.json({ ok: true });
  let body: { email?: string } = {};
  try { body = await req.json(); } catch {}
  const email = (body.email ?? "").trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  try {
    const data = await getCustomerOrders(email);
    // Only actually send if there's something to see - but always return ok.
    if (!data.empty) {
      const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://sluggerathletics.com";
      const link = `${SITE}/portal/${makePortalToken(email)}`;
      await sendEmail({
        to: email,
        subject: "Your Slugger Athletics orders",
        html: `
          <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a;">
            <h2 style="color:#13160b;">Your Slugger Athletics orders</h2>
            <p>Tap the button below to view all your orders, designs, and invoices in one place. This link works for the next 45 minutes.</p>
            <p style="text-align:center;margin:28px 0;">
              <a href="${link}" style="background:#b8a36c;color:#13160b;font-weight:bold;text-decoration:none;padding:14px 28px;border-radius:4px;display:inline-block;">View my orders &rarr;</a>
            </p>
            <p style="font-size:12px;color:#777;">If you didn't request this, you can ignore this email - no one can see your orders without this link.</p>
          </div>`,
      });
    }
  } catch (e) {
    console.error("portal request failed:", e);
  }
  return NextResponse.json({ ok: true });
}
