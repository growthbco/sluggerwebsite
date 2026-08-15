import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { designerInvoices, teamOrders, teamOrderRoster } from "@/db/schema";
import { computeTeamOrderQuote } from "@/lib/team-order-pricing";

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
  if (subtotalCents <= 0) return dutyCents > 0; // duty with no goods is always suspect
  const bps = dutyRateBps(subtotalCents, dutyCents);
  return bps < DUTY_BAND_MIN_BPS || bps > DUTY_BAND_MAX_BPS;
}

/* ------------------------------------------------------------------ */
/* Billable orders (what the designer should be billing us for)        */
/* ------------------------------------------------------------------ */

// Orders that have been sent to the designer and produced. He bills after an
// order comes in, so these are the candidates for any invoice.
const BILLABLE_STATUSES = ["in_production", "shipped"] as const;

export type BillableGarment = { garment: string; qty: number };
export type BillableOrder = {
  teamOrderId: string;
  reference: string;
  teamName: string;
  status: string;
  garments: BillableGarment[];
  pieces: number;
  /** If this order already appears on a non-void invoice, the ref it's on.
   *  The designer link disables re-adding it so we can't be billed twice. */
  alreadyBilledOn?: string | null;
};

/** Team-order ids already billed on a submitted or paid invoice → the invoice
 *  ref they first appeared on. Void invoices don't count. */
export async function getBilledOrderRefs(): Promise<Map<string, string>> {
  const db = getDb();
  const rows = await db
    .select({
      reference: designerInvoices.reference,
      status: designerInvoices.status,
      lines: designerInvoices.lines,
    })
    .from(designerInvoices);
  const map = new Map<string, string>();
  for (const r of rows) {
    if (r.status === "void") continue;
    for (const l of r.lines ?? []) {
      if (l.teamOrderId && !map.has(l.teamOrderId)) map.set(l.teamOrderId, r.reference);
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
    .where(inArray(teamOrders.status, [...BILLABLE_STATUSES]))
    .orderBy(desc(teamOrders.createdAt));

  if (!orders.length) return [];

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

  const billed = await getBilledOrderRefs();

  return orders.map((o) => {
    const roster = byOrder.get(o.id) ?? [];
    const quote = computeTeamOrderQuote(
      {
        jerseyStyle: o.jerseyStyle,
        items: o.items,
        localPricing: o.localPricing,
        customJerseyCents: o.customJerseyCents,
        embroideryFeeWaived: o.embroideryFeeWaived,
      },
      roster,
    );
    // Quote lines carry priced retail items; for reconciliation we only want the
    // garment label + our quantity (drop the embroidery/rush fee lines).
    const garments: BillableGarment[] = quote.lines
      .filter((l) => l.quantity > 0 && !/fee/i.test(l.label))
      .map((l) => ({ garment: l.label, qty: l.quantity }));
    const pieces = garments.reduce((s, g) => s + g.qty, 0);
    return {
      teamOrderId: o.id,
      reference: o.reference,
      teamName: o.teamName,
      status: o.status,
      garments,
      pieces,
      alreadyBilledOn: billed.get(o.id) ?? null,
    };
  });
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
};

/** Persist a submitted invoice. Money is recomputed server-side from the lines
 *  so a tampered client can't inflate the total; `ourQty` is snapshotted now. */
export async function createDesignerInvoice(input: CreateDesignerInvoiceInput) {
  const db = getDb();

  // Snapshot our piece counts so a later roster edit can't mask a mismatch.
  const billable = await getBillableOrders();
  const ourByOrder = new Map(billable.map((b) => [b.teamOrderId, b]));
  // Orders already billed on an earlier invoice — the double-billing guard.
  const alreadyBilled = await getBilledOrderRefs();
  const seenThisInvoice = new Map<string, number>(); // order id → line index

  const lines = input.lines
    .map((l, idx) => {
      const qty = Math.max(0, Math.round(Number(l.qty) || 0));
      const unitCents = Math.max(0, Math.round(Number(l.unitCents) || 0));
      const matched = l.teamOrderId ? ourByOrder.get(l.teamOrderId) : undefined;
      // Our count for this order across every garment (piece-level check). A
      // per-garment check would need the designer to tag garment type; matching
      // on total pieces per order is the reliable signal we have.
      const ourQty = matched?.pieces;
      // Duplicate detection: this order billed on a prior invoice, OR listed
      // twice within this same submission.
      let alreadyBilledOn: string | undefined;
      if (l.teamOrderId) {
        if (alreadyBilled.has(l.teamOrderId)) {
          alreadyBilledOn = alreadyBilled.get(l.teamOrderId);
        } else if (seenThisInvoice.has(l.teamOrderId)) {
          alreadyBilledOn = "this invoice (duplicate line)";
        } else {
          seenThisInvoice.set(l.teamOrderId, idx);
        }
      }
      return {
        team: String(l.team ?? "").slice(0, 120),
        garment: String(l.garment ?? "").slice(0, 120),
        qty,
        unitCents,
        teamOrderId: l.teamOrderId,
        orderRef: matched?.reference ?? l.orderRef,
        ourQty,
        ...(alreadyBilledOn ? { alreadyBilledOn } : {}),
      };
    })
    .filter((l) => l.team || l.garment || l.qty || l.unitCents);

  const subtotalCents = lines.reduce((s, l) => s + l.qty * l.unitCents, 0);
  const dutyCents = Math.max(0, Math.round(Number(input.dutyCents) || 0));
  const previousBalanceCents = Math.max(0, Math.round(Number(input.previousBalanceCents) || 0));
  const totalCents = subtotalCents + dutyCents + previousBalanceCents;

  const [row] = await db
    .insert(designerInvoices)
    .values({
      reference: invoiceRef(),
      designerName: input.designerName?.slice(0, 120) || null,
      lines,
      subtotalCents,
      dutyCents,
      previousBalanceCents,
      totalCents,
      notes: input.notes?.slice(0, 2000) || null,
    })
    .returning();

  return row;
}

export async function listDesignerInvoices() {
  const db = getDb();
  return db.select().from(designerInvoices).orderBy(desc(designerInvoices.submittedAt));
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
    qtyMismatch: boolean;
    alreadyBilledOn?: string;
  }[];
  anyQtyMismatch: boolean;
  anyDoubleBill: boolean;
};

export function reconcileInvoice(inv: typeof designerInvoices.$inferSelect): InvoiceReconciliation {
  const lineChecks = (inv.lines ?? []).map((l) => {
    const qtyMismatch = typeof l.ourQty === "number" && l.ourQty !== l.qty;
    return {
      team: l.team,
      garment: l.garment,
      qty: l.qty,
      unitCents: l.unitCents,
      lineCents: l.qty * l.unitCents,
      orderRef: l.orderRef,
      ourQty: l.ourQty,
      qtyMismatch,
      alreadyBilledOn: l.alreadyBilledOn,
    };
  });
  return {
    dutyBps: dutyRateBps(inv.subtotalCents, inv.dutyCents),
    dutyFlag: isDutyOutOfBand(inv.subtotalCents, inv.dutyCents),
    lineChecks,
    anyQtyMismatch: lineChecks.some((l) => l.qtyMismatch),
    anyDoubleBill: lineChecks.some((l) => Boolean(l.alreadyBilledOn)),
  };
}
