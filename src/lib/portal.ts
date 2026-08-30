// Customer portal: a stateless, email magic-link view of everything a
// customer has with Slugger (team orders, store purchases, design requests,
// custom invoices). No passwords - the link IS the auth, and it's short-lived.
import { cache } from "react";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { sql, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { teamOrders, teamOrderRoster, designRequests, customInvoices, orders, orderItems, teams } from "@/db/schema";
import { getOrCreateCustomer } from "@/lib/customers";
import { itemKeyForSizeField, itemLabel } from "@/lib/order-items";

const TTL_MS = 45 * 60 * 1000; // 45 minutes

function key(): Buffer {
  const secret = process.env.PORTAL_SECRET || process.env.STRIPE_SECRET_KEY || process.env.GEMINI_API_KEY || "dev";
  return createHash("sha256").update(`slugger-portal:${secret}`).digest();
}

/** Encrypt {email, expiry} into a URL-safe token (AES-256-GCM). */
export function makePortalToken(email: string): string {
  const payload = JSON.stringify({ e: email.trim().toLowerCase(), x: Date.now() + TTL_MS });
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

/** Decrypt + validate a portal token. Returns the email, or null if invalid/expired. */
export function readPortalToken(token: string): string | null {
  try {
    const raw = Buffer.from(token, "base64url");
    if (raw.length < 29) return null;
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const enc = raw.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    const out = Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
    const { e, x } = JSON.parse(out) as { e?: string; x?: number };
    if (!e || typeof x !== "number" || Date.now() > x) return null;
    return e;
  } catch {
    return null;
  }
}

export type PortalData = {
  teamOrders: {
    reference: string; teamName: string; status: string; manageToken: string | null; trackingNumber: string | null; createdAt: Date;
    totalCents: number; shippingCents: number; depositCents: number | null; invoiceUrl: string | null; fullInvoiceUrl: string | null; balanceInvoiceUrl: string | null; depositPaidAt: Date | null; invoicePaidAt: Date | null; pieceLabel: string;
    deliveryTargetAt: Date | null; deliveryTargetKind: "ship" | "pickup" | null;
  }[];
  designs: { reference: string; teamName: string; status: string; statusToken: string | null; createdAt: Date; mockups: string[] }[];
  invoices: { reference: string; status: string; totalCents: number; payUrl: string | null; createdAt: Date }[];
  shop: { reference: string; type: string; status: string; totalCents: number; subtotalCents: number; shippingCents: number; items: { name: string; quantity: number; unitPriceCents: number }[]; trackingNumber: string | null; shippedAt: Date | null; addUrl: string | null; createdAt: Date }[];
  name: string | null;
  profile: { name: string | null; phone: string | null; referralCode: string; referralCreditCents: number; hasPassword: boolean };
  shippingAddress: { line1: string; line2: string; city: string; state: string; postalCode: string } | null;
  empty: boolean;
};

/** Request-scoped cache so the portal shell layout and its section pages share
 *  ONE query per render instead of each re-fetching everything. */
export const getCustomerOrdersCached = cache((email: string) => getCustomerOrders(email));

/** Everything on file for a given email address. */
export async function getCustomerOrders(email: string): Promise<PortalData> {
  const db = getDb();
  const e = email.trim().toLowerCase();
  const [team, designs, invoices, shop] = await Promise.all([
    db.select().from(teamOrders).where(sql`lower(${teamOrders.contactEmail}) = ${e}`),
    db.select().from(designRequests).where(sql`lower(${designRequests.contactEmail}) = ${e}`),
    db.select().from(customInvoices).where(sql`lower(${customInvoices.customerEmail}) = ${e}`),
    db.select().from(orders).where(sql`lower(${orders.customerEmail}) = ${e}`),
  ]);
  // What each order actually is, from the roster: count every item type (jerseys
  // with their style, hats, pants, etc.) into a plain-English summary like
  // "12 Full Button jerseys + 12 Fitted Hats".
  const teamIds = team.map((o) => o.id);
  const comp = new Map<string, Map<string, number>>();
  if (teamIds.length) {
    const rr = await db
      .select({ to: teamOrderRoster.teamOrderId, sizes: teamOrderRoster.sizes, size: teamOrderRoster.size })
      .from(teamOrderRoster)
      .where(inArray(teamOrderRoster.teamOrderId, teamIds));
    for (const r of rr) {
      const m = comp.get(r.to) ?? new Map<string, number>();
      const sized = Object.entries(r.sizes ?? {}).filter(([, v]) => (v ?? "").trim());
      if (sized.length) {
        const itemKeys = new Set(sized.map(([key]) => itemKeyForSizeField(key)));
        for (const k of itemKeys) m.set(k, (m.get(k) ?? 0) + 1);
      }
      else if ((r.size ?? "").trim()) m.set("jersey", (m.get("jersey") ?? 0) + 1);
      comp.set(r.to, m);
    }
  }
  const summarize = (o: (typeof team)[number]): string => {
    const m = comp.get(o.id);
    if (!m || m.size === 0) return "";
    const st = (o.jerseyStyle ?? "").trim();
    // Jerseys first, then the rest.
    const keys = [...m.keys()].sort((a, b) => (a === "jersey" ? -1 : b === "jersey" ? 1 : 0));
    return keys
      .map((k) => {
        const n = m.get(k)!;
        if (k === "jersey") return `${n} ${st ? st + " " : ""}${n === 1 ? "jersey" : "jerseys"}`;
        const lbl = itemLabel(k);
        return `${n} ${lbl}${n === 1 ? "" : "s"}`;
      })
      .join(" + ");
  };
  const designsById = new Map(designs.map((d) => [d.id, d]));
  const teamOrdersV = team.map((o) => {
    const linkedDesign = o.designRequestId ? designsById.get(o.designRequestId) : undefined;
    const timeline = buildDeliveryTimeline({
      approvedAt: linkedDesign?.approvedAt,
      rosterSubmittedAt: o.submittedAt,
      depositPaidAt: o.depositPaidAt ?? o.invoicePaidAt,
      timelineStartAt: o.timelineStartAt,
      fallbackStartAt: (["in_production", "paid", "shipped"] as string[]).includes(o.status)
        ? (o.depositPaidAt ?? o.invoicePaidAt)
        : null,
      requestedInHandAt: o.requestedInHandAt ?? linkedDesign?.neededBy,
      promisedInHandAt: o.promisedInHandAt,
      tier: (o.turnaroundTier as DeliveryTier | null) ?? undefined,
      rush: o.rushShipping,
      localPickup: o.localPickup,
    });
    return {
      reference: o.reference,
      teamName: o.teamName,
      status: o.status,
      manageToken: o.manageToken,
      trackingNumber: o.trackingNumber,
      createdAt: o.createdAt,
      totalCents: o.quotedTotalCents ?? 0,
      shippingCents: o.shippingChargedCents ?? 0,
      depositCents: o.depositCents,
      invoiceUrl: o.invoiceUrl,
      fullInvoiceUrl: o.fullInvoiceUrl,
      balanceInvoiceUrl: o.balanceInvoiceUrl,
      depositPaidAt: o.depositPaidAt,
      invoicePaidAt: o.invoicePaidAt,
      pieceLabel: summarize(o),
      deliveryTargetAt: o.status === "shipped" ? null : timeline.selectedTargetAt,
      deliveryTargetKind: timeline.selectedTargetAt ? (o.localPickup ? "pickup" as const : "ship" as const) : null,
    };
  });
  const designsV = designs.map((d) => {
    // Show ALL approved designs (e.g. the player jersey AND the coach quarter-zip),
    // so a single unrepresentative image never confuses the customer.
    const approved = d.approvedDesignUrls?.length
      ? d.approvedDesignUrls
      : d.approvedDesignUrl
      ? [d.approvedDesignUrl]
      : d.proofReviewUrls?.length
        ? d.proofReviewUrls
        : d.proofImages ?? [];
    return {
      reference: d.reference,
      teamName: d.teamName,
      status: d.status,
      statusToken: d.statusToken,
      createdAt: d.createdAt,
      mockups: [...new Set(approved.filter(Boolean))].slice(0, 6),
    };
  });
  const invoicesV = invoices.map((i) => ({ reference: i.reference, status: i.status, totalCents: i.totalCents, payUrl: i.payUrl, createdAt: i.createdAt }));
  // For unshipped team-store orders, offer a self-serve "add items" link that
  // reopens the team's store in add-to-order mode (only when the store is live).
  const storeTeamIds = [...new Set(shop.filter((s) => s.type === "team_store" && !s.shippedAt && s.teamId).map((s) => s.teamId as string))];
  const storeMap = new Map<string, { token: string | null; active: boolean }>();
  if (storeTeamIds.length) {
    const rows = await db.select({ id: teams.id, token: teams.storeToken, active: teams.storeActive }).from(teams).where(inArray(teams.id, storeTeamIds));
    for (const r of rows) storeMap.set(r.id, { token: r.token, active: Boolean(r.active) });
  }
  // Line items for the shop/store orders, so the portal can show a real receipt.
  const shopIds = shop.map((s) => s.id);
  const itemsByOrder = new Map<string, { name: string; quantity: number; unitPriceCents: number }[]>();
  if (shopIds.length) {
    const its = await db.select().from(orderItems).where(inArray(orderItems.orderId, shopIds));
    for (const it of its) {
      const list = itemsByOrder.get(it.orderId) ?? [];
      list.push({ name: it.name, quantity: it.quantity, unitPriceCents: it.unitPriceCents });
      itemsByOrder.set(it.orderId, list);
    }
  }
  const shopV = shop.map((s) => {
    const store = s.teamId ? storeMap.get(s.teamId) : undefined;
    const addUrl = s.type === "team_store" && !s.shippedAt && store?.active && store.token ? `/store/${store.token}?addTo=${s.reference}` : null;
    return { reference: s.reference, type: s.type, status: s.status, totalCents: s.totalCents, subtotalCents: s.subtotalCents, shippingCents: s.shippingCents, items: itemsByOrder.get(s.id) ?? [], trackingNumber: s.trackingNumber, shippedAt: s.shippedAt, addUrl, createdAt: s.createdAt };
  });

  // Display name: the most recent order that carries one.
  const named =
    [...shop].sort((a, b) => +b.createdAt - +a.createdAt).find((s) => s.customerName)?.customerName ||
    [...team].sort((a, b) => +b.createdAt - +a.createdAt).find((t) => t.contactName)?.contactName ||
    invoices.find((i) => i.customerName)?.customerName ||
    null;
  const phoneSeed =
    [...team].sort((a, b) => +b.createdAt - +a.createdAt).find((t) => t.contactPhone)?.contactPhone || null;
  // Ensure a profile exists (gives them a referral code on first portal visit).
  const customer = await getOrCreateCustomer(e, { name: named, phone: phoneSeed });
  return {
    profile: {
      name: customer.name,
      phone: customer.phone,
      referralCode: customer.referralCode,
      referralCreditCents: customer.referralCreditCents,
      hasPassword: Boolean(customer.passwordHash),
    },
    teamOrders: teamOrdersV,
    designs: designsV,
    invoices: invoicesV,
    shop: shopV,
    name: customer.name || named,
    shippingAddress: (() => {
      const a = [...team].sort((x, y) => +y.createdAt - +x.createdAt).find((t) => t.shippingAddress?.line1)?.shippingAddress;
      return a ? { line1: a.line1 ?? "", line2: a.line2 ?? "", city: a.city ?? "", state: a.state ?? "", postalCode: a.postalCode ?? "" } : null;
    })(),
    empty: teamOrdersV.length + designsV.length + invoicesV.length + shopV.length === 0,
  };
}
