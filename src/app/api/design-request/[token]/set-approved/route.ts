import { NextResponse } from "next/server";
import { dbEnabled } from "@/db";
import { getByManageToken, setApprovedDesign } from "@/lib/design-requests";
import { postDesignThreadUpdate } from "@/lib/discord";

export const runtime = "nodejs";

// Staff/designer manually marks which proof is THE approved design (manage
// token = staff-only, same as proof upload). Used when the client approves a
// file and then changes their mind, or when it's unclear which version was
// approved. Posts the exact image into the Discord thread so the designer
// builds the print file from the right one.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!dbEnabled()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }
  const { token } = await params;
  const request = await getByManageToken(token);
  if (!request) return NextResponse.json({ error: "Link not found" }, { status: 404 });

  let body: { url?: string } = {};
  try { body = await req.json(); } catch {}

  const url = body.url ?? "";
  if (!request.proofImages?.includes(url)) {
    return NextResponse.json({ error: "Pick one of the sent proofs." }, { status: 400 });
  }

  const changed = request.approvedDesignUrl && request.approvedDesignUrl !== url;
  try {
    await setApprovedDesign(request.id, url);
    await postDesignThreadUpdate({
      threadId: request.discordThreadId ?? undefined,
      title: changed
        ? `✅ Approved design CORRECTED - ${request.teamName} (${request.reference})`
        : `✅ Approved design confirmed - ${request.teamName} (${request.reference})`,
      description: changed
        ? "The client changed their mind. THIS image below is the final approved design - build the print file from this exact version, not the one posted earlier."
        : "The shop confirmed this exact image as the approved design. Build the print file from this version.",
      imageUrl: url,
      username: "Slugger Design Requests",
      mention: true,
    });
    return NextResponse.json({ ok: true, url });
  } catch (e) {
    console.error("setApprovedDesign failed:", e);
    return NextResponse.json({ error: "Could not set the approved design" }, { status: 500 });
  }
}
