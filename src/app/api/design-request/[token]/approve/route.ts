import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { dbEnabled } from "@/db";
import { getByStatusToken, approveDesign } from "@/lib/design-requests";
import { createTeamOrder, getByDesignRequestId } from "@/lib/team-orders";
import { itemKeysFromDesignProducts, fabricFor } from "@/lib/order-items";
import { generateAssetSheets, hasAssetSheets } from "@/lib/design-lab-assets";
import { postDesignThreadUpdate } from "@/lib/discord";
import { setThreadStageTag } from "@/lib/discord-bot";

// The order's item types come from the DESIGN itself, so the auto-created order
// is priced and sized for what was actually approved - a cheer set, hoodie, or
// hats - instead of silently defaulting everything to a plain jersey. Uses the
// shared, product-aware mapping; for cheer we upgrade to the rhinestone item
// (a different price) when the design is a rhinestone / bling set.
function itemsForDesign(request: { productTypes?: string[] | null; vision?: string | null; sport?: string | null; aiDesignState?: unknown }): string[] {
  let items = itemKeysFromDesignProducts(request.productTypes);
  if (!items.length) items = ["jersey"];
  const style = (request.aiDesignState as { style?: string; sport?: string } | null)?.style ?? "";
  const studioSport = (request.aiDesignState as { sport?: string } | null)?.sport ?? "";
  const hint = `${request.vision ?? ""} ${style} ${studioSport} ${request.sport ?? ""} ${(request.productTypes ?? []).join(" ")}`.toLowerCase();
  if (items.includes("cheer_uniform") && /rhinestone|bling|crystal/.test(hint)) {
    items = items.map((k) => (k === "cheer_uniform" ? "cheer_uniform_rhinestone" : k));
  }
  // Hockey jersey is a distinct, pricier garment - upgrade a plain jersey to it
  // when the design is a hockey design (its own price + designer cost).
  if (/hockey/.test(hint)) {
    items = items.map((k) => (k === "jersey" ? "hockey_jersey" : k));
  }
  // Flag football = sleeveless compression game shirt with its own size chart.
  if (/flag football|flag-football/.test(hint)) {
    items = items.map((k) => (k === "jersey" ? "flag_football_jersey" : k));
  }
  return items;
}

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!dbEnabled()) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const { token } = await params;

  const request = await getByStatusToken(token);
  if (!request) return NextResponse.json({ error: "Link not found" }, { status: 404 });
  if (request.status === "approved" || request.status === "ordered") {
    return NextResponse.json({ ok: true, alreadyApproved: true });
  }
  if (!request.proofImages?.length) {
    return NextResponse.json({ error: "There's no proof to approve yet." }, { status: 400 });
  }

  let body: { approvedUrl?: string; approvedUrls?: string[] } = {};
  try {
    body = await req.json();
  } catch {}

  // Accept one or many selected proofs; keep only URLs that are real proofs.
  const requested = body.approvedUrls?.length ? body.approvedUrls : body.approvedUrl ? [body.approvedUrl] : [];
  const valid = requested.filter((u) => request.proofImages!.includes(u));
  // Default to the most recent proof image if none specified/valid.
  const approvedUrls = valid.length ? valid : [request.proofImages[request.proofImages.length - 1]];

  try {
    await approveDesign(request.id, approvedUrls);

    // Individual trace-ready asset sheets (pattern / wordmark / emblem) from the
    // approved artwork, same as the AI lab produces. Guarded + backgrounded so a
    // design that already has them (e.g. an AI-lab submission) isn't redone.
    if (!hasAssetSheets(request.inspirationImages)) {
      waitUntil(
        generateAssetSheets({
          designId: request.id,
          reference: request.reference,
          teamName: request.teamName,
          sport: request.sport,
          style: request.jerseyStyle,
          threadId: request.discordThreadId,
          currentImages: request.inspirationImages ?? [],
          sourceImageUrl: approvedUrls[0],
        }).catch((e) => console.error("generateAssetSheets (approve) failed:", e)),
      );
    }

    // Provision the team order right here so the customer's SAME link
    // (/design/status) rolls straight into roster entry - no separate
    // team-order form or link to hand out. Idempotent: skip if one already
    // exists for this design. Defaults: recommended Mesh material, items from
    // the intake, SMS consent + rush carried over from the design.
    let provisionedOrder = await getByDesignRequestId(request.id);
    if (!provisionedOrder) {
      await createTeamOrder({
        teamName: request.teamName,
        contactName: request.contactName,
        contactEmail: request.contactEmail,
        contactPhone: request.contactPhone ?? undefined,
        jerseyStyle: request.jerseyStyle ?? undefined,
        // Fabric follows the style (Full/Two Button + Quarter-Zip = polyester),
        // never a blanket Mesh default that mislabels button-front jerseys.
        // Bowling is the exception: it is cut in microfiber regardless of style.
        jerseyMaterial: fabricFor(
          request.jerseyStyle,
          request.sport,
          (request.aiDesignState as { sport?: string; style?: string } | null)?.sport,
          (request.aiDesignState as { sport?: string; style?: string } | null)?.style,
          request.vision,
          ...(request.productTypes ?? []),
        ),
        items: itemsForDesign(request),
        designRequestId: request.id,
        rushShipping: Boolean(request.rush),
        smsOptIn: Boolean(request.smsOptInAt),
      });
      provisionedOrder = await getByDesignRequestId(request.id);
    }

    // Post into the same Discord thread so the team sees the approval inline.
    await postDesignThreadUpdate({
      threadId: request.discordThreadId ?? undefined,
      title: `✅ Approved - ${request.teamName} (${request.reference})`,
      description: `Client approved ${approvedUrls.length === 1 ? "the design" : `${approvedUrls.length} designs`}. Their order (${provisionedOrder?.reference ?? "team order"}) is set up and they're filling their roster on the same link.\n\n⚠️ DO NOT START PRODUCTION YET. Approval is not payment - production starts only after the customer pays their 50% deposit.`,
      imageUrl: approvedUrls[0],
      username: "Slugger Design Requests",
    });
    await setThreadStageTag(request.discordThreadId, "✅ Approved");
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("approveDesign failed:", e);
    return NextResponse.json({ error: "Could not approve" }, { status: 500 });
  }
}
