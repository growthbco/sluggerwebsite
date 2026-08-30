import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";
import { getDb } from "@/db";
import { designerInvoices, teamOrders, teamOrderRoster, orders as ordersTable, orderItems, teams, drops, designRequests } from "@/db/schema";

// Store / shop / buy-in orders the designer also produces. They're paid upfront
// via Stripe, so any paid/fulfilled one is billable (per individual order).
const BILLABLE_ORDER_TYPES = ["team_store", "buy_in", "shop"] as const;
const BILLABLE_ORDER_STATUSES = ["paid", "fulfilled"] as const;
const ORDER_TYPE_LABEL: Record<string, string> = { team_store: "Team Store", buy_in: "Drop", shop: "Shop" };

// A store/shop line item that's an in-house hat (never the designer's to bill),
// detected from the snapshot product name.
function isHatName(name: string): boolean {
  return /\b(hat|cap|snapback|trucker|beanie)\b/i.test(name || "");
}

// Non-garment store line items (tax, shipping, fees, discounts) - not something
// the designer produces, so they never belong on his invoice.
function isNonGarment(name: string): boolean {
  return /\b(tax|shipping|ship|fee|discount|credit|donation|fundrais)/i.test(name || "");
}

// Store item names carry the full customization
// ("Full-Button Jersey - Red Pinstripe - 2X-Large - SMITH - #32"). The designer
// bills by GARMENT TYPE, so collapse to the first segment ("Full-Button Jersey")
// - otherwise every player is a separate one-off line.
function garmentType(name: string): string {
  return (name.split(" - ")[0] || name || "").trim() || name;
}
import { itemKeyForSizeField, notDesignerMade, itemLabel } from "@/lib/order-items";

// The garments the DESIGNER actually produces for an order, counted straight
// from the roster: every piece INCLUDING paid add-ons (he makes those too),
// but EXCLUDING in-house items (hats - embroidered in Ocala, never his to bill).
function billableGarmentsFromRoster(
  order: { jerseyStyle: string | null },
  roster: { sizes: Record<string, string> | null; size: string | null; quantity: number | null }[],
): { garment: string; qty: number }[] {
  const counts = new Map<string, number>();
  for (const row of roster) {
    const qty = Math.max(1, row.quantity ?? 1);
    const sized = Object.entries(row.sizes ?? {}).filter(([, v]) => (v ?? "").trim());
    if (sized.length) {
      for (const key of new Set(sized.map(([key]) => itemKeyForSizeField(key)))) {
        counts.set(key, (counts.get(key) ?? 0) + qty);
      }
    } else if ((row.size ?? "").trim()) {
      counts.set("jersey", (counts.get("jersey") ?? 0) + qty);
    }
  }
  return Array.from(counts.keys())
    .filter((k) => !notDesignerMade(k)) // drop hats (in-house) + beanies (outsourced) - not the designer's
    .sort((a, b) => (a === "jersey" ? -1 : b === "jersey" ? 1 : a.localeCompare(b)))
    .map((key) => ({
      garment: key === "jersey" && order.jerseyStyle ? `${order.jerseyStyle} Jersey` : itemLabel(key),
      qty: counts.get(key)!,
    }));
}

/** Estimated designer/factory COGS for an order, from our cost list (pieces x
 *  per-garment cost). NOTE: duty (~15-19%) and inbound shipping are NOT in this
 *  - real landed cost runs higher, so prefer the RECORDED actual when set.
 *  Returns null if no garment cost is known. */
export function estimatedDesignerCostCents(
  order: { jerseyStyle: string | null; jerseyMaterial?: string | null; sport?: string | null },
  roster: { sizes: Record<string, string> | null; size: string | null; quantity: number | null }[],
): number | null {
  const garments = billableGarmentsFromRoster(order, roster);
  let total = 0;
  let known = false;
  for (const g of garments) {
    const c = designerCostCents(g.garment, order.jerseyMaterial, order.sport);
    if (c != null) { total += c * g.qty; known = true; }
  }
  return known ? total : null;
}

/* ------------------------------------------------------------------ */
/* Private link                                                        */
/* ------------------------------------------------------------------ */

// One stable, reusable link for the print vendor (no login). Set once in the
// environment; the admin Invoices page shows the full URL to copy to him.
export function designerLinkToken(): string | null {
  return process.env.DESIGNER_INVOICE_TOKEN || null;
}

export function isValidDesignerToken(token: string): boolean {
  const expected = designerLinkToken();
  return Boolean(expected) && token === expected;
}

/* ------------------------------------------------------------------ */
/* Duty ("Tex") band                                                   */
/* ------------------------------------------------------------------ */

// The designer enters duty himself (real customs charges move around), but a
// charge outside this band gets flagged for a human to double-check. History:
// ~17.8% on one invoice, ~19.9% on another — 18% is the norm.
export const DUTY_BAND_MIN_BPS = 1500; // 15%
export const DUTY_BAND_MAX_BPS = 1900; // 19%

/** Duty as a share of the goods subtotal, in basis points (1800 = 18.00%). */
export function dutyRateBps(subtotalCents: number, dutyCents: number): number {
  if (subtotalCents <= 0) return 0;
  return Math.round((dutyCents / subtotalCents) * 10000);
}

export function isDutyOutOfBand(subtotalCents: number, dutyCents: number): boolean {
  // No duty charged is never an overbilling concern. Only review a duty line
  // when the vendor actually adds one.
  if (dutyCents <= 0) return false;
  if (subtotalCents <= 0) return dutyCents > 0; // duty with no goods is always suspect
  const bps = dutyRateBps(subtotalCents, dutyCents);
  return bps < DUTY_BAND_MIN_BPS || bps > DUTY_BAND_MAX_BPS;
}

/* ------------------------------------------------------------------ */
/* Billable orders (what the designer should be billing us for)        */
/* ------------------------------------------------------------------ */

// Orders the customer has paid us for and the designer produces. "paid" (paid in
// full) is billable just like in_production/shipped - an order can sit in "paid"
// without ever flipping to in_production, and leaving it out hid fully-paid jobs
// (Vortex, Pin Me Daddy, ...) from the designer's picker. The payment gate below
// (deposit OR full paid) still guarantees we've been paid before he can bill.
const BILLABLE_STATUSES = ["paid", "in_production", "shipped"] as const;

export type BillableGarment = { garment: string; qty: number };
export type BillableOrder = {
  teamOrderId: string;
  /** Which table the id belongs to, so a "settle" action updates the right row. */
  kind: "team_order" | "order";
  reference: string;
  teamName: string;
  status: string;
  garments: BillableGarment[];
  pieces: number;
  /** Our known per-piece cost for this order (from the designer's price list),
   *  set when the order is a single garment type so the invoice line pre-fills.
   *  Undefined for mixed-garment orders - he prices those himself. */
  unitCostCents?: number;
  /** If this order is FULLY billed (billed pieces >= current pieces) on a
   *  non-void invoice, the ref it's on. The designer link disables re-adding it
   *  so we can't be billed twice. Left null when add-on pieces are still owed. */
  alreadyBilledOn?: string | null;
  /** ISO date it was billed (the invoice's paid/submitted date) - shown as
   *  "billed Aug 12" instead of a bare struck chip. */
  alreadyBilledDate?: string | null;
  /** Pieces already billed on prior non-void invoices. When 0 < billedPieces <
   *  pieces, add-on pieces were added after billing and are billable as a
   *  top-up: the chip stays active for just the (pieces - billedPieces) delta. */
  billedPieces?: number;
  /** When the order was created - for an "age" column on the admin nudge list. */
  since?: string | null;
  /** Section header for grouping the picker ("Team Orders", or a store's name
   *  like "Mamba Baseball · Team Store" so all its buyers nest under one header). */
  group: string;
  /** Compact chip text within the group (team name, or the buyer's name for a
   *  store order) - avoids repeating the store name on every chip. */
  chipLabel: string;
};

// The designer's (Bonans's) per-piece cost by garment, from his Aug 2026 price
// list, used to PRE-FILL invoice lines so he approves instead of typing. Matched
// against our garment labels by keyword; order matters (specific before
// generic). Edit here if his prices change. Returns null when unknown -> the
// line is left blank for him to fill.
export function designerCostCents(label: string, material?: string | null, sport?: string | null): number | null {
  const s = (label || "").toLowerCase();
  const microfiber = (material ?? "").toLowerCase() === "microfiber";
  const bowling = /bowling/i.test(sport ?? "");
  if (/quarter|1\/4|zip/.test(s)) return 2200; // quarter-zip (not on his list; the $22 he charged for Hammer Time)
  // Bowling full-button shirts use the $21 vendor rate. Sport is the source of
  // truth; microfiber remains a fallback for older/off-system bowling orders.
  if (/full[\s-]?button/.test(s)) return bowling || microfiber ? 2100 : 1400;
  if (/two[\s-]?button/.test(s)) return 1300;
  if (/long[\s-]?sleeve/.test(s)) return 1200;
  if (/dri[\s-]?fit|dry[\s-]?fit|practice/.test(s)) return 1100;
  if (/light.*hoodie|lightweight/.test(s)) return 1800; // lightweight hoodie (historical)
  if (/hoodie/.test(s)) return 2400; // heavyweight hoodie
  if (/pant|knicker/.test(s)) return 1800; // baseball/softball pants
  if (/short/.test(s)) return 1200;
  if (/sock/.test(s)) return 700;
  if (/snap[\s-]?back/.test(s)) return 1300; // hats normally in-house, covered just in case
  if (/fitted/.test(s)) return 1500;
  if (/soccer/.test(s)) return 1200;
  if (/legging/.test(s)) return 1700;
  if (/compression/.test(s)) return 1300;
  if (/hockey/.test(s)) return 2400; // hockey jersey (sweater) - Gary's cost Aug 2026
  if (/v[\s-]?neck/.test(s)) return 1200;
  if (/jersey|shirt|crew|round[\s-]?neck/.test(s)) return 1100; // standard round-neck jersey
  return null;
}

/** Team-order ids already billed on a submitted or paid invoice → the invoice
 *  ref they first appeared on. Void invoices don't count. Pass excludeInvoiceId
 *  when editing an invoice so its OWN lines don't flag as double-billed. */
export async function getBilledOrderRefs(excludeInvoiceId?: string): Promise<Map<string, string>> {
  const db = getDb();
  const rows = await db
    .select({
      id: designerInvoices.id,
      reference: designerInvoices.reference,
      status: designerInvoices.status,
      lines: designerInvoices.lines,
    })
    .from(designerInvoices);
  const map = new Map<string, string>();
  for (const r of rows) {
    if (r.status === "void") continue;
    if (excludeInvoiceId && r.id === excludeInvoiceId) continue;
    for (const l of r.lines ?? []) {
      if (l.teamOrderId && !map.has(l.teamOrderId)) map.set(l.teamOrderId, r.reference);
    }
  }
  return map;
}

/** Per order, the total pieces already billed across non-void invoices plus the
 *  first invoice ref it appeared on. Used to bill only the DELTA when add-on
 *  pieces are added to an order that was already partly billed. */
export async function getBilledPieceCounts(excludeInvoiceId?: string): Promise<Map<string, { ref: string; pieces: number; date: string | null }>> {
  const db = getDb();
  const rows = await db
    .select({ id: designerInvoices.id, reference: designerInvoices.reference, status: designerInvoices.status, lines: designerInvoices.lines, submittedAt: designerInvoices.submittedAt, paidAt: designerInvoices.paidAt })
    .from(designerInvoices);
  const map = new Map<string, { ref: string; pieces: number; date: string | null }>();
  for (const r of rows) {
    if (r.status === "void") continue;
    if (excludeInvoiceId && r.id === excludeInvoiceId) continue;
    const date = (r.paidAt ?? r.submittedAt)?.toISOString() ?? null;
    for (const l of r.lines ?? []) {
      if (!l.teamOrderId) continue;
      const qty = Math.max(0, l.qty ?? 0);
      const prev = map.get(l.teamOrderId);
      if (prev) prev.pieces += qty; // keep the first ref + date; accumulate pieces
      else map.set(l.teamOrderId, { ref: r.reference, pieces: qty, date });
    }
  }
  return map;
}

/** For each produced order, the per-garment piece counts WE have on record.
 *  This is the "what we actually ordered" side of the reconciliation and the
 *  pre-fill shown on the designer's link. */
export async function getBillableOrders(): Promise<BillableOrder[]> {
  const db = getDb();
  const orders = await db
    .select()
    .from(teamOrders)
    // Billable ONLY once the CUSTOMER has actually paid us (deposit or in full).
    // Approval / in-production is NOT enough - we never pay the designer for
    // work we haven't been paid for ourselves. NOTE: settled orders are NOT
    // excluded in SQL anymore - an order settled directly can still gain add-on
    // pieces afterward, which are billable. The delta is worked out per order
    // below (settled pieces + invoiced pieces = accounted; the rest is owed).
    .where(
      and(
        inArray(teamOrders.status, [...BILLABLE_STATUSES]),
        or(isNotNull(teamOrders.depositPaidAt), isNotNull(teamOrders.invoicePaidAt)),
      ),
    )
    .orderBy(desc(teamOrders.createdAt));

  if (!orders.length) return [];

  // Older team orders did not copy sport from the linked design request. Use
  // that design as the fallback so bowling is not priced like baseball.
  const designIds = [...new Set(orders.map((order) => order.designRequestId).filter((id): id is string => Boolean(id)))];
  const designSportById = new Map<string, string>();
  if (designIds.length) {
    const designs = await db
      .select({ id: designRequests.id, sport: designRequests.sport })
      .from(designRequests)
      .where(inArray(designRequests.id, designIds));
    for (const design of designs) {
      if (design.sport) designSportById.set(design.id, design.sport);
    }
  }

  const rosters = await db
    .select()
    .from(teamOrderRoster)
    .where(
      inArray(
        teamOrderRoster.teamOrderId,
        orders.map((o) => o.id),
      ),
    );

  const byOrder = new Map<string, typeof rosters>();
  for (const r of rosters) {
    const list = byOrder.get(r.teamOrderId) ?? [];
    list.push(r);
    byOrder.set(r.teamOrderId, list);
  }

  const billed = await getBilledPieceCounts();

  const teamResults: BillableOrder[] = orders
    .map((o) => {
      const roster = byOrder.get(o.id) ?? [];
      // Designer-billable garments straight from the roster: all pieces incl.
      // paid add-ons, minus in-house hats. (The customer quote excludes add-ons
      // and includes hats - the opposite of what the designer should bill.)
      const garments: BillableGarment[] = billableGarmentsFromRoster(o, roster);
      const pieces = garments.reduce((s, g) => s + g.qty, 0);
      // Pre-fill the cost only for single-garment orders (one unit price applies).
      // Mixed orders (jersey + shorts) stay blank - he prices those himself.
      const sport = o.sport ?? (o.designRequestId ? designSportById.get(o.designRequestId) : undefined);
      const unitCostCents = garments.length === 1 ? (designerCostCents(garments[0].garment, o.jerseyMaterial, sport) ?? undefined) : undefined;

      // Pieces already accounted for = billed on a non-void invoice PLUS pieces
      // that existed when the order was settled directly (paid the designer
      // outside the tool). Anything added AFTER a bill/settle - i.e. roster rows
      // created past the settle time - is the unbilled add-on delta still owed.
      const invoice = billed.get(o.id);
      const billedOnInvoice = invoice?.pieces ?? 0;
      const settledAt = o.designerSettledAt ? new Date(o.designerSettledAt).getTime() : null;
      const settledPieces = settledAt
        ? billableGarmentsFromRoster(
            o,
            roster.filter((r) => r.createdAt && new Date(r.createdAt).getTime() <= settledAt),
          ).reduce((s, g) => s + g.qty, 0)
        : 0;
      const accounted = Math.min(pieces, billedOnInvoice + settledPieces);
      const unbilled = pieces - accounted;

      return {
        teamOrderId: o.id,
        kind: "team_order" as const,
        reference: o.reference,
        teamName: o.teamName,
        status: o.status,
        garments,
        pieces,
        unitCostCents,
        billedPieces: accounted,
        // Struck "billed" only when fully billed ON AN INVOICE (so he still sees
        // the history). Fully-settled-direct orders with nothing new are dropped
        // below rather than shown struck.
        alreadyBilledOn: billedOnInvoice > 0 && billedOnInvoice >= pieces ? (invoice?.ref ?? null) : null,
        alreadyBilledDate: billedOnInvoice > 0 && billedOnInvoice >= pieces ? (invoice?.date ?? null) : null,
        since: o.createdAt ? new Date(o.createdAt).toISOString() : null,
        group: "Team Orders",
        chipLabel: o.teamName,
        _settled: settledAt != null,
        _archived: Boolean(o.archivedAt),
        _unbilled: unbilled,
      };
    })
    // Nothing left to bill -> drop: archived+done, or settled-direct with no
    // add-on pieces since. Invoice-billed-in-full stay (struck) so he sees it's
    // billed; add-on top-ups (unbilled > 0) stay active.
    .filter((r) => {
      if (r._archived && r._unbilled <= 0) return false;
      if (r._settled && r._unbilled <= 0 && !r.alreadyBilledOn) return false;
      return true;
    })
    .map(({ _settled, _archived, _unbilled, ...r }) => { void _settled; void _archived; void _unbilled; return r; });

  // Store / shop / buy-in orders: individual, pre-paid purchases the designer
  // also produces. One billable entry per order, garments from the line items,
  // minus in-house hats. Hat-only orders drop out (no garments left).
  const storeRows = await db
    .select()
    .from(ordersTable)
    .where(and(inArray(ordersTable.type, [...BILLABLE_ORDER_TYPES]), inArray(ordersTable.status, [...BILLABLE_ORDER_STATUSES]), isNull(ordersTable.designerSettledAt)))
    .orderBy(desc(ordersTable.createdAt));
  // Same rule for store orders: archived + already billed drops off.
  const activeStoreRows = storeRows.filter((o) => !(o.archivedAt && billed.get(o.id)));
  let storeResults: BillableOrder[] = [];
  if (activeStoreRows.length) {
    const items = await db.select().from(orderItems).where(inArray(orderItems.orderId, activeStoreRows.map((o) => o.id)));
    const itemsByOrder = new Map<string, typeof items>();
    for (const it of items) {
      const list = itemsByOrder.get(it.orderId) ?? [];
      list.push(it);
      itemsByOrder.set(it.orderId, list);
    }
    // Resolve WHO each order is for: the team/store name (team_store) or the
    // drop title (buy_in), so the designer sees "Mamba Baseball", not a bare ref.
    const teamIds = [...new Set(activeStoreRows.map((o) => o.teamId).filter((x): x is string => Boolean(x)))];
    const dropIds = [...new Set(activeStoreRows.map((o) => o.dropId).filter((x): x is string => Boolean(x)))];
    const teamNameById = new Map<string, string>();
    if (teamIds.length) for (const t of await db.select({ id: teams.id, name: teams.name }).from(teams).where(inArray(teams.id, teamIds))) teamNameById.set(t.id, t.name);
    const dropTitleById = new Map<string, string>();
    if (dropIds.length) for (const d of await db.select({ id: drops.id, title: drops.title }).from(drops).where(inArray(drops.id, dropIds))) dropTitleById.set(d.id, d.title);
    storeResults = activeStoreRows
      .map((o) => {
        const counts = new Map<string, number>();
        for (const it of itemsByOrder.get(o.id) ?? []) {
          if (isHatName(it.name) || isNonGarment(it.name)) continue; // hats in-house; tax/shipping/fees aren't his
          const type = garmentType(it.name);
          counts.set(type, (counts.get(type) ?? 0) + Math.max(1, it.quantity ?? 1));
        }
        const garments: BillableGarment[] = [...counts.entries()].map(([garment, qty]) => ({ garment, qty }));
        const pieces = garments.reduce((s, g) => s + g.qty, 0);
        const unitCostCents = garments.length === 1 ? (designerCostCents(garments[0].garment) ?? undefined) : undefined;
        // Lead with WHO it's for: team/store name or drop title, then the type,
        // then the buyer if we have one.
        const type = ORDER_TYPE_LABEL[o.type] ?? "Order";
        const who = o.type === "team_store" ? (o.teamId ? teamNameById.get(o.teamId) : null)
          : o.type === "buy_in" ? (o.dropId ? dropTitleById.get(o.dropId) : null)
          : null;
        // group = the store/drop header ("Mamba Baseball · Team Store"); chip =
        // just the buyer, so the header isn't repeated on every row.
        const group = [who, type].filter(Boolean).join(" · ") || type;
        const chipLabel = o.customerName?.trim() || `Order ${o.reference}`;
        const label = [who, type, o.customerName?.trim()].filter(Boolean).join(" · ") || `${type} ${o.reference}`;
        const b = billed.get(o.id);
        const billedPieces = b?.pieces ?? 0;
        return {
          teamOrderId: o.id,
          kind: "order" as const,
          reference: o.reference,
          teamName: label,
          status: o.status,
          garments,
          pieces,
          unitCostCents,
          billedPieces,
          alreadyBilledOn: billedPieces > 0 && billedPieces >= pieces ? (b?.ref ?? null) : null,
          alreadyBilledDate: billedPieces > 0 && billedPieces >= pieces ? (b?.date ?? null) : null,
          since: o.createdAt ? new Date(o.createdAt).toISOString() : null,
          group,
          chipLabel,
        };
      })
      .filter((r) => r.garments.length > 0);
  }

  return [...teamResults, ...storeResults];
}

/** Mark every currently-produced-but-unbilled order as settled outside the tool
 *  (paid the designer directly / fully paid up). They drop off the "not yet
 *  billed" list; future produced orders still accumulate. Returns how many were
 *  settled. Already-invoiced orders are left alone. */
/** The vendor marks ONE job as already paid by us (settled outside the tool) so
 *  it drops off their billable list - e.g. an older order we paid before the
 *  tool existed. Same mechanism as the admin bulk-settle, one order at a time.
 *  Returns the order's name + ref for the notification. */
export async function settleOneBillable(id: string, kind: "team_order" | "order"): Promise<{ ok: boolean; name?: string; reference?: string }> {
  const db = getDb();
  const now = new Date();
  if (kind === "order") {
    const [o] = await db.select({ ref: ordersTable.reference, name: ordersTable.customerName }).from(ordersTable).where(eq(ordersTable.id, id)).limit(1);
    if (!o) return { ok: false };
    await db.update(ordersTable).set({ designerSettledAt: now }).where(eq(ordersTable.id, id));
    return { ok: true, name: o.name ?? undefined, reference: o.ref };
  }
  const [o] = await db.select({ ref: teamOrders.reference, name: teamOrders.teamName }).from(teamOrders).where(eq(teamOrders.id, id)).limit(1);
  if (!o) return { ok: false };
  await db.update(teamOrders).set({ designerSettledAt: now }).where(eq(teamOrders.id, id));
  return { ok: true, name: o.name, reference: o.ref };
}

export async function settleAllBillable(): Promise<number> {
  const db = getDb();
  const now = new Date();
  const billable = await getBillableOrders();
  const unbilled = billable.filter((b) => !b.alreadyBilledOn);
  const teamIds = unbilled.filter((b) => b.kind === "team_order").map((b) => b.teamOrderId);
  const orderIds = unbilled.filter((b) => b.kind === "order").map((b) => b.teamOrderId);
  if (teamIds.length) {
    await db.update(teamOrders).set({ designerSettledAt: now }).where(inArray(teamOrders.id, teamIds));
  }
  if (orderIds.length) {
    await db.update(ordersTable).set({ designerSettledAt: now }).where(inArray(ordersTable.id, orderIds));
  }
  return teamIds.length + orderIds.length;
}

/* ------------------------------------------------------------------ */
/* Create / read / reconcile                                           */
/* ------------------------------------------------------------------ */

function invoiceRef(): string {
  return `INV-${randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

export type DesignerInvoiceLineInput = {
  team: string;
  garment: string;
  qty: number;
  unitCents: number;
  teamOrderId?: string;
  orderRef?: string;
};

export type CreateDesignerInvoiceInput = {
  designerName?: string;
  lines: DesignerInvoiceLineInput[];
  dutyCents: number;
  previousBalanceCents?: number;
  notes?: string;
  /** The vendor's own external invoice number, if they have one. */
  vendorRef?: string;
  /** Blob URLs of the vendor's own uploaded invoice file(s). */
  attachmentUrls?: string[];
};

/** Shared line processing for create + update: recompute money server-side,
 *  snapshot our piece counts, and tag double-bills. Pass excludeInvoiceId when
 *  editing so the invoice's own orders don't flag as already-billed. */
async function buildInvoiceLines(inputLines: DesignerInvoiceLineInput[], excludeInvoiceId?: string) {
  const billable = await getBillableOrders();
  const ourByOrder = new Map(billable.map((b) => [b.teamOrderId, b]));
  // Pieces billed on OTHER non-void invoices (delta-aware): a re-appearance is
  // only a real double-bill when the running total would exceed our own count -
  // legitimate add-on top-ups (order billed once, gained pieces since) are not.
  const billedBefore = await getBilledPieceCounts(excludeInvoiceId);
  const runningThisInvoice = new Map<string, number>(); // pieces added on THIS invoice so far

  return inputLines
    .map((l) => {
      const qty = Math.max(0, Math.round(Number(l.qty) || 0));
      const unitCents = Math.max(0, Math.round(Number(l.unitCents) || 0));
      const matched = l.teamOrderId ? ourByOrder.get(l.teamOrderId) : undefined;
      let alreadyBilledOn: string | undefined;
      // Default reconciliation target = our full current piece count.
      let ourQty = matched?.pieces;
      if (l.teamOrderId) {
        const prior = billedBefore.get(l.teamOrderId)?.pieces ?? 0;
        const soFar = runningThisInvoice.get(l.teamOrderId) ?? 0;
        if (matched?.pieces != null) {
          // What's still unbilled BEFORE this line - the honest target for it.
          const remaining = matched.pieces - prior - soFar;
          ourQty = Math.max(0, remaining);
          // Over-bill only when this line pushes cumulative billed past what we
          // actually ordered AND some was already billed (a fresh full bill is fine).
          if (qty > remaining && (prior > 0 || soFar > 0)) {
            alreadyBilledOn = billedBefore.get(l.teamOrderId)?.ref ?? "this invoice (over-billed)";
          }
        } else if (prior > 0) {
          // Not in the billable set anymore (settled/removed) but billed before.
          alreadyBilledOn = billedBefore.get(l.teamOrderId)?.ref;
        }
        runningThisInvoice.set(l.teamOrderId, soFar + qty);
      }
      return {
        // A linked line uses our canonical order identity. This prevents a
        // tampered request from attaching an unrelated team name to a paid id.
        team: String(matched?.teamName ?? l.team ?? "").slice(0, 120),
        garment: String(l.garment ?? "").slice(0, 120),
        qty,
        unitCents,
        teamOrderId: l.teamOrderId,
        orderRef: matched?.reference ?? l.orderRef,
        ourQty,
        ourUnitCents: matched?.unitCostCents,
        ...(alreadyBilledOn ? { alreadyBilledOn } : {}),
      };
    })
    .filter((l) => l.team || l.garment || l.qty || l.unitCents);
}

/** Persist a submitted invoice. Money is recomputed server-side from the lines
 *  so a tampered client can't inflate the total; `ourQty` is snapshotted now. */
export async function createDesignerInvoice(input: CreateDesignerInvoiceInput) {
  const db = getDb();
  const lines = await buildInvoiceLines(input.lines);
  const subtotalCents = lines.reduce((s, l) => s + l.qty * l.unitCents, 0);
  const dutyCents = Math.max(0, Math.round(Number(input.dutyCents) || 0));
  const previousBalanceCents = Math.max(0, Math.round(Number(input.previousBalanceCents) || 0));
  const totalCents = subtotalCents + dutyCents + previousBalanceCents;

  const [row] = await db
    .insert(designerInvoices)
    .values({
      reference: invoiceRef(),
      viewToken: randomUUID().replace(/-/g, ""),
      designerName: input.designerName?.slice(0, 120) || null,
      lines,
      subtotalCents,
      dutyCents,
      previousBalanceCents,
      totalCents,
      notes: input.notes?.slice(0, 2000) || null,
      vendorRef: input.vendorRef?.slice(0, 60) || null,
      attachmentUrls: (input.attachmentUrls ?? []).filter(Boolean).slice(0, 5),
    })
    .returning();

  return row;
}

/** Remember the Discord forum thread an invoice opened on submission, so its
 *  PAID confirmation nests in the same thread. */
export async function setInvoiceThreadId(id: string, threadId: string) {
  await getDb().update(designerInvoices).set({ discordThreadId: threadId }).where(eq(designerInvoices.id, id));
}

/** Fetch one invoice by its shareable view token (read-only public link). */
export async function getDesignerInvoiceByToken(token: string) {
  if (!token) return null;
  const db = getDb();
  const [row] = await db.select().from(designerInvoices).where(eq(designerInvoices.viewToken, token)).limit(1);
  return row ?? null;
}

/** Edit an invoice IN PLACE - allowed only while it's still "submitted" (a paid
 *  or void invoice is locked). Money is recomputed server-side, same as create.
 *  Returns { locked: true } if it can't be edited, or null if not found. */
export async function updateDesignerInvoice(id: string, input: CreateDesignerInvoiceInput) {
  const db = getDb();
  const [existing] = await db.select().from(designerInvoices).where(eq(designerInvoices.id, id)).limit(1);
  if (!existing) return null;
  if (existing.status !== "submitted") return { locked: true as const, status: existing.status };

  const lines = await buildInvoiceLines(input.lines, id);
  const subtotalCents = lines.reduce((s, l) => s + l.qty * l.unitCents, 0);
  const dutyCents = Math.max(0, Math.round(Number(input.dutyCents) || 0));
  const previousBalanceCents = Math.max(0, Math.round(Number(input.previousBalanceCents) || 0));
  const totalCents = subtotalCents + dutyCents + previousBalanceCents;

  const [row] = await db
    .update(designerInvoices)
    .set({
      designerName: input.designerName?.slice(0, 120) || null,
      lines,
      subtotalCents,
      dutyCents,
      previousBalanceCents,
      totalCents,
      notes: input.notes?.slice(0, 2000) || null,
      vendorRef: input.vendorRef?.slice(0, 60) || null,
      attachmentUrls: (input.attachmentUrls ?? []).filter(Boolean).slice(0, 5),
    })
    .where(and(eq(designerInvoices.id, id), eq(designerInvoices.status, "submitted")))
    .returning();

  return row ?? null;
}

/** Invoices the designer can still edit (unpaid). Returned to his private link
 *  so he can fix a submission before it's paid. */
export async function getEditableDesignerInvoices() {
  const db = getDb();
  return db
    .select()
    .from(designerInvoices)
    .where(eq(designerInvoices.status, "submitted"))
    .orderBy(desc(designerInvoices.submittedAt));
}

export async function listDesignerInvoices() {
  const db = getDb();
  return db.select().from(designerInvoices).orderBy(desc(designerInvoices.submittedAt));
}

/** Paid invoices, newest first - the vendor's own payment history for the
 *  billing tool (like a customer's order history in the portal). */
export async function getPaidDesignerInvoices() {
  const db = getDb();
  return db
    .select({
      id: designerInvoices.id,
      reference: designerInvoices.reference,
      totalCents: designerInvoices.totalCents,
      submittedAt: designerInvoices.submittedAt,
      paidAt: designerInvoices.paidAt,
      lines: designerInvoices.lines,
    })
    .from(designerInvoices)
    .where(eq(designerInvoices.status, "paid"))
    .orderBy(desc(designerInvoices.paidAt));
}

export async function getDesignerInvoice(id: string) {
  const db = getDb();
  const [row] = await db.select().from(designerInvoices).where(eq(designerInvoices.id, id)).limit(1);
  return row ?? null;
}

export async function markInvoicePaid(id: string, paidBy: string, note?: string) {
  const db = getDb();
  const [row] = await db
    .update(designerInvoices)
    .set({ status: "paid", paidAt: new Date(), paidBy, paymentNote: note?.slice(0, 500) || null })
    .where(and(eq(designerInvoices.id, id), eq(designerInvoices.status, "submitted")))
    .returning();
  return row ?? null;
}

export async function voidInvoice(id: string) {
  const db = getDb();
  const [row] = await db
    .update(designerInvoices)
    .set({ status: "void" })
    .where(eq(designerInvoices.id, id))
    .returning();
  return row ?? null;
}

/** Per-invoice checks for the admin view: duty band + per-line quantity match. */
export type InvoiceReconciliation = {
  dutyBps: number;
  dutyFlag: boolean;
  lineChecks: {
    team: string;
    garment: string;
    qty: number;
    unitCents: number;
    lineCents: number;
    orderRef?: string;
    ourQty?: number;
    ourUnitCents?: number;
    qtyMismatch: boolean;
    unitCostOverage: boolean;
    alreadyBilledOn?: string;
  }[];
  anyQtyMismatch: boolean;
  anyUnitCostOverage: boolean;
  anyDoubleBill: boolean;
};

export function reconcileInvoice(
  inv: typeof designerInvoices.$inferSelect,
  expectedUnitByOrder: ReadonlyMap<string, number> = new Map(),
): InvoiceReconciliation {
  const lineChecks = (inv.lines ?? []).map((l) => {
    const qtyMismatch = typeof l.ourQty === "number" && l.ourQty !== l.qty;
    // New invoices snapshot the rate. The map lets old submitted invoices use
    // the current matched-order rate without rewriting their history.
    const ourUnitCents = l.ourUnitCents ?? (l.teamOrderId ? expectedUnitByOrder.get(l.teamOrderId) : undefined);
    const unitCostOverage = typeof ourUnitCents === "number" && l.unitCents > ourUnitCents;
    return {
      team: l.team,
      garment: l.garment,
      qty: l.qty,
      unitCents: l.unitCents,
      lineCents: l.qty * l.unitCents,
      orderRef: l.orderRef,
      ourQty: l.ourQty,
      ourUnitCents,
      qtyMismatch,
      unitCostOverage,
      alreadyBilledOn: l.alreadyBilledOn,
    };
  });
  return {
    dutyBps: dutyRateBps(inv.subtotalCents, inv.dutyCents),
    dutyFlag: isDutyOutOfBand(inv.subtotalCents, inv.dutyCents),
    lineChecks,
    anyQtyMismatch: lineChecks.some((l) => l.qtyMismatch),
    anyUnitCostOverage: lineChecks.some((l) => l.unitCostOverage),
    anyDoubleBill: lineChecks.some((l) => Boolean(l.alreadyBilledOn)),
  };
}

/* ------------------------------------------------------------------ */
/* Paid-order cross-reference                                          */
/* ------------------------------------------------------------------ */

export type OrderPaymentIndex = { paidById: Set<string> };

/** Exact ids for orders backed by customer payment. Powers the invoice
 *  cross-reference (have we been paid for what the vendor billed?). */
export async function getOrderPaymentIndex(): Promise<OrderPaymentIndex> {
  const db = getDb();
  const rows = await db
    .select({ id: teamOrders.id, dep: teamOrders.depositPaidAt, inv: teamOrders.invoicePaidAt })
    .from(teamOrders);
  const paidById = new Set<string>();
  for (const r of rows) {
    const paid = Boolean(r.dep || r.inv);
    if (paid) paidById.add(r.id);
  }
  // Store / shop / buy-in orders are paid upfront via Stripe, so any paid or
  // fulfilled one counts as paid for the "did we get paid before paying him"
  // check - otherwise a legit store line would wrongly flag as unpaid.
  const storeRows = await db
    .select({ id: ordersTable.id })
    .from(ordersTable)
    .where(and(inArray(ordersTable.type, [...BILLABLE_ORDER_TYPES]), inArray(ordersTable.status, [...BILLABLE_ORDER_STATUSES])));
  for (const r of storeRows) {
    paidById.add(r.id);
  }
  return { paidById };
}

/** Payment status of one billed line vs our orders:
 *  - "paid": backed by an order the customer paid us for (safe to pay him)
 *  - "unpaid": matched to an order we were NOT paid for (do NOT pay)
 *  - "unknown": no confident match (manual line / off-system item) - verify
 *  Only an exact internal order id counts as verified. A typed team name is not
 *  proof of payment and must stay "unknown" until it is linked. */
export function linePaymentStatus(line: { teamOrderId?: string | null }, idx: OrderPaymentIndex): "paid" | "unpaid" | "unknown" {
  if (line.teamOrderId) return idx.paidById.has(line.teamOrderId) ? "paid" : "unpaid";
  return "unknown";
}

export type InvoicePaymentReview = InvoiceReconciliation & {
  lines: Array<InvoiceReconciliation["lineChecks"][number] & {
    notPaid: boolean;
    unverifiedPay: boolean;
  }>;
  blockers: string[];
  canPay: boolean;
};

/** One shared payment decision for the admin page and both payment APIs. A red
 *  warning is not enough: any money that is unmatched, over quantity/rate, or
 *  already billed must be resolved before the invoice can be paid. */
export function reviewInvoiceForPayment(
  inv: typeof designerInvoices.$inferSelect,
  idx: OrderPaymentIndex,
  expectedUnitByOrder: ReadonlyMap<string, number> = new Map(),
): InvoicePaymentReview {
  const reconciliation = reconcileInvoice(inv, expectedUnitByOrder);
  const lines = reconciliation.lineChecks.map((line, i) => {
    const status = linePaymentStatus(
      { teamOrderId: inv.lines?.[i]?.teamOrderId },
      idx,
    );
    return { ...line, notPaid: status === "unpaid", unverifiedPay: status === "unknown" };
  });
  const moneyLines = lines.filter((line) => line.lineCents > 0);
  const blockers: string[] = [];
  const count = (n: number, singular: string, plural = `${singular}s`) => `${n} ${n === 1 ? singular : plural}`;

  const unpaid = moneyLines.filter((line) => line.notPaid).length;
  const unverified = moneyLines.filter((line) => line.unverifiedPay).length;
  const qty = moneyLines.filter((line) => line.qtyMismatch).length;
  const duplicate = moneyLines.filter((line) => Boolean(line.alreadyBilledOn)).length;
  const rate = moneyLines.filter((line) => line.unitCostOverage).length;
  if (unpaid) blockers.push(`${count(unpaid, "line")} not backed by customer payment`);
  if (unverified) blockers.push(`${count(unverified, "manual line")} not linked to an order`);
  if (qty) blockers.push(`${count(qty, "line")} over or under the saved quantity`);
  if (duplicate) blockers.push(`${count(duplicate, "line")} already billed`);
  if (rate) blockers.push(`${count(rate, "line")} above the saved vendor rate`);
  if (reconciliation.dutyFlag) blockers.push("duty outside the expected 15–19% range");
  if (inv.previousBalanceCents > 0) blockers.push("previous balance is not tied to an order");

  return { ...reconciliation, lines, blockers, canPay: blockers.length === 0 };
}

/** Live server-side review immediately before money/status changes. */
export async function getInvoicePaymentReview(inv: typeof designerInvoices.$inferSelect): Promise<InvoicePaymentReview> {
  const [idx, billable] = await Promise.all([getOrderPaymentIndex(), getBillableOrders()]);
  const expectedUnitByOrder = new Map<string, number>();
  for (const order of billable) {
    if (typeof order.unitCostCents === "number") expectedUnitByOrder.set(order.teamOrderId, order.unitCostCents);
  }
  return reviewInvoiceForPayment(inv, idx, expectedUnitByOrder);
}
