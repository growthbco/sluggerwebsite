import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { getTableConfig } from "drizzle-orm/pg-core";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema";
import { rushFeeCentsForPieces } from "../src/lib/rush-pricing";
import * as pricing from "../src/lib/team-order-pricing";
import { buildCustomerOrderSpec } from "../src/lib/order-spec";
import * as shipping from "../src/lib/team-order-shipping";
import * as tax from "../src/lib/pricing";
import { loadModule } from "./load-module";

test("rush fee cutoff is 50 billable pieces, not players or setup fees", () => {
  for (const [pieces, fee] of [[0, 0], [1, 10000], [49, 10000], [50, 15000], [99, 15000]]) {
    assert.equal(rushFeeCentsForPieces(pieces), fee);
    const quote = pricing.computeTeamOrderQuote({ items: ["jersey"], rushShipping: true, customJerseyCents: 2500 },
      pieces ? [{ sizes: { jersey: "Large" }, quantity: pieces }] : []);
    assert.equal(quote.rushFeeCents, fee);
    assert.equal(quote.totalCents, pieces * 2500 + fee);
  }
  const mixed = pricing.computeTeamOrderQuote({ items: ["jersey", "shorts"], rushShipping: true },
    [{ sizes: { jersey: "Large", shorts: "Medium" }, quantity: 25 }]);
  assert.equal(mixed.pieces, 50);
  assert.equal(mixed.rushFeeCents, 15000);
  const hats = pricing.computeTeamOrderQuote({ items: ["fitted_hat"], rushShipping: true },
    [{ sizes: { fitted_hat: "L/XL" }, quantity: 49 }]);
  assert.equal(hats.pieces, 49, "embroidery setup is not a garment");
  assert.equal(hats.rushFeeCents, 10000);
  const addon = pricing.computeTeamOrderQuote({ items: ["jersey"], rushShipping: true },
    [{ size: "Large", quantity: 49 }, { size: "Large", filledBy: "addon", quantity: 10 }]);
  assert.equal(addon.rushFeeCents, 10000, "separately paid add-ons are not charged twice");
  const standard = pricing.computeTeamOrderQuote({ items: ["jersey"], rushShipping: false }, [{ size: "Large", quantity: 50 }]);
  assert.equal(standard.rushFeeCents, 0);
  const spec = buildCustomerOrderSpec({ teamName: "Test", items: ["jersey", "shorts"], rushShipping: true }, [], null, mixed);
  assert.equal(spec.rushFeeCents, 15000);
  assert.match(spec.productionWindow, /\$150/);
  assert.equal(spec.merchandiseSubtotalCents, mixed.totalCents);
});

async function fixture() {
  const pg = new PGlite();
  const columns = getTableConfig(schema.teamOrders).columns;
  await pg.exec(`CREATE TABLE team_orders (${columns.map((column) =>
    `"${column.name}" ${column.getSQLType() === "team_order_status" ? "text" : column.getSQLType()}`
  ).join(",")})`);
  const db = drizzle(pg);
  const id = "10000000-0000-0000-0000-000000000001";
  await db.insert(schema.teamOrders).values({
    id, reference: "TEST", teamName: "Synthetic team", contactName: "Coach",
    contactEmail: "test@example.invalid", status: "collecting", manageToken: "valid",
    rushShipping: false, customJerseyCents: 2700, items: ["jersey"],
    priorityFeeCents: 0, updatedAt: new Date("2026-09-04T20:00:00Z"),
  });
  const service = loadModule<typeof import("../src/lib/customer-production-service")>("src/lib/customer-production-service.ts", {
    "@/db": { getDb: () => db }, "@/db/schema": schema,
  });
  const read = async () => (await db.select().from(schema.teamOrders).where(eq(schema.teamOrders.id, id)))[0];
  const route = loadModule<typeof import("../src/app/api/team-order/[token]/service/route")>("src/app/api/team-order/[token]/service/route.ts", {
    "@/db": { dbEnabled: () => true },
    "@/lib/team-orders": { getByManageToken: async (token: string) => token === "valid" ? read() : null,
      getRoster: async () => [{ sizes: { jersey: "Large" }, quantity: 16 }] },
    "@/lib/team-order-pricing": pricing,
    "@/lib/customer-production-service": service,
  });
  const post = async (choice: string, updatedAt?: string, token = "valid") => route.PATCH(new Request("http://test.invalid", {
    method: "PATCH", body: JSON.stringify({ service: choice, updatedAt: updatedAt ?? (await read()).updatedAt.toISOString() }),
  }), { params: Promise.resolve({ token }) });
  return { pg, db, id, post, read, service };
}

test("customer can select Rush for 16 jerseys then return to Standard without changing unit price", async () => {
  const f = await fixture();
  try {
    assert.equal((await f.post("rush", undefined, "invalid")).status, 404);
    assert.equal((await f.post("priority")).status, 400);
    const oldDate = (await f.read()).updatedAt.toISOString();
    const response = await f.post("rush");
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, rushFeeCents: 10000, totalCents: 53200 });
    assert.equal((await f.read()).rushShipping, true);
    assert.equal((await f.read()).customJerseyCents, 2700);
    assert.equal((await f.read()).shippingChargedCents, null);
    assert.equal((await f.post("standard", oldDate)).status, 409);
    assert.equal((await f.post("standard")).status, 200);
    assert.equal((await f.read()).rushShipping, false);
  } finally { await f.pg.close(); }
});

test("submitted, invoiced, paid, priority and staff-arranged orders are locked", async () => {
  const f = await fixture();
  try {
    const baseline = await f.read();
    for (const patch of [
      { status: "submitted" as const }, { status: "quoted" as const }, { status: "cancelled" as const },
      { depositPaidAt: new Date() }, { invoicePaidAt: new Date() }, { shippedAt: new Date() },
      { invoiceUrl: "https://test.invalid/invoice" }, { fullInvoiceUrl: "https://test.invalid/full" },
      { balanceInvoiceUrl: "https://test.invalid/balance" }, { quotedTotalCents: 43000 },
      { turnaroundTier: "priority" }, { priorityFeeCents: 100 }, { timelineStartAt: new Date() },
      { promisedInHandAt: new Date() },
    ]) {
      await f.db.update(schema.teamOrders).set(patch).where(eq(schema.teamOrders.id, f.id));
      assert.equal((await f.post("rush")).status, 409, JSON.stringify(patch));
      assert.equal((await f.read()).rushShipping, false);
      await f.db.update(schema.teamOrders).set(baseline).where(eq(schema.teamOrders.id, f.id));
    }
  } finally { await f.pg.close(); }
});

test("write-time guards reject an invoice or submission arriving after the draft was read", async () => {
  const f = await fixture();
  try {
    const order = await f.read();
    await f.db.update(schema.teamOrders).set({ invoiceUrl: "https://test.invalid/new" }).where(eq(schema.teamOrders.id, f.id));
    assert.equal(await f.service.saveCustomerProductionService(order, true, order.updatedAt.toISOString()), false);
    await f.db.update(schema.teamOrders).set({ invoiceUrl: null, status: "submitted" }).where(eq(schema.teamOrders.id, f.id));
    assert.equal(await f.service.saveCustomerProductionService(order, true, order.updatedAt.toISOString()), false);
    assert.equal((await f.read()).rushShipping, false);
  } finally { await f.pg.close(); }
});

test("Rush invoice charges the correct fee, requires full payment, and adds no shipping", async () => {
  const f = await fixture();
  const prices: Array<{ unit_amount: number; product_data?: { name: string } }> = [];
  const links: Array<{ metadata: Record<string, string>; optional_items?: unknown; line_items: unknown[] }> = [];
  let quantity = 49;
  const stripe = {
    products: { create: async () => ({ id: "prod_test" }) },
    prices: { create: async (input: typeof prices[number]) => { prices.push(input); return { id: "price_" + prices.length }; } },
    paymentLinks: { create: async (input: typeof links[number]) => { links.push(input); return { id: "pl_test", url: "https://test.invalid/new", metadata: input.metadata }; } },
  };
  const invoice = loadModule<typeof import("../src/lib/team-order-invoicing")>("src/lib/team-order-invoicing.ts", {
    "@/db": { getDb: () => f.db }, "@/db/schema": schema,
    "@/lib/team-orders": { getRoster: async () => [{ size: "Large", quantity }], invoiceRosterEntries: () => [] },
    "@/lib/team-order-pricing": pricing, "@/lib/pricing": tax,
    "@/lib/email": { emailTeamOrderInvoice: async (input: { shippingIncludedWithRush: boolean; shipCents: number; stage: string }) => {
      assert.equal(input.shippingIncludedWithRush, true); assert.equal(input.shipCents, 0); assert.equal(input.stage, "full"); return true;
    } },
    "@/lib/stripe": { getStripe: () => stripe },
    "@/lib/customers": { getCustomer: async () => null },
    "@/lib/sms": { smsIfConsented: async () => undefined },
    "@/lib/team-order-shipping": shipping,
    "@/lib/shipping-protection": {},
    "@/lib/ship-quote": { quoteShippingCents: () => { throw new Error("Rush must never request an additional shipping quote"); } },
  });
  try {
    for (quantity of [49, 50]) {
      await f.db.update(schema.teamOrders).set({
        status: "submitted", rushShipping: true, invoiceUrl: null, fullInvoiceUrl: null,
        embroideryFeeWaived: true, taxExempt: true,
      }).where(eq(schema.teamOrders.id, f.id));
      const result = await invoice.sendTeamOrderInvoice({ teamOrderId: f.id, stage: "deposit", ship: "auto" });
      assert.equal(result.ok, true);
      assert.equal(result.stage, "full");
      assert.equal(result.totalCents, quantity * 2700 + (quantity === 49 ? 10000 : 15000));
      assert.equal(result.dueCents, result.totalCents);
      assert.equal(result.shipCents, 0);
      assert.equal(links.at(-1)!.metadata.shipCents, "0");
      assert.equal(links.at(-1)!.metadata.stage, "full");
      assert.equal(links.at(-1)!.optional_items, undefined);
      assert.equal(links.at(-1)!.line_items.length, 1);
      assert.equal(prices.at(-1)!.unit_amount, result.totalCents);
    }
    assert.equal(shipping.shouldChargeAdditionalTeamOrderShipping({ rushShipping: false, localPickup: false }), true);
    assert.equal(shipping.shouldChargeAdditionalTeamOrderShipping({ rushShipping: true, ship: "auto" }), false);
  } finally { await f.pg.close(); }
});

test("submission rejects a Rush or total changed in another tab before any write", async () => {
  const route = loadModule<typeof import("../src/app/api/team-order/[token]/submit/route")>("src/app/api/team-order/[token]/submit/route.ts", {
    "@/db": { dbEnabled: () => true, getDb: () => { throw new Error("Must reject before writes"); } },
    "@/db/schema": schema, "@/lib/team-order-invoicing": {},
    "@/lib/team-orders": {
      getByManageToken: async () => ({ id: "test", status: "collecting", rushShipping: true, items: ["jersey"] }),
      getRoster: async () => [{ size: "Large" }],
    },
    "@/lib/order-items": { minPiecesForItems: () => 6, missingCheerSizeLabels: () => [] },
    "@/lib/discord": {}, "@/lib/design-requests": {}, "@/lib/discord-bot": {},
    "@/lib/team-order-pricing": { computeTeamOrderQuote: () => ({ totalCents: 54800 }) },
    "@/lib/order-spec": {},
  });
  for (const [rushShipping, reviewedTotalCents] of [[false, 54800], [true, 44800]]) {
    const response = await route.POST(new Request("http://test.invalid", {
      method: "POST", body: JSON.stringify({ specConfirmed: true, deliveryTermsAccepted: true, rushShipping, reviewedTotalCents }),
    }), { params: Promise.resolve({ token: "test" }) });
    assert.equal(response.status, 409);
    assert.match((await response.json()).error, /Refresh and review/);
  }
});

test("team stores reject Rush and retain normal weight-based shipping at every quantity", async () => {
  type Checkout = { line_items: Array<{ quantity: number; price_data: { unit_amount: number; product_data: { name: string } } }>; shipping_options: Array<{ shipping_rate_data: { fixed_amount: { amount: number } } }>; optional_items?: unknown };
  const sessions: Checkout[] = [];
  const route = loadModule<typeof import("../src/app/api/store/[token]/checkout/route")>("src/app/api/store/[token]/checkout/route.ts", {
    "@/db": { dbEnabled: () => true },
    "@/lib/stripe": { stripeEnabled: () => true, getStripe: () => ({ checkout: { sessions: { create: async (input: Checkout) => { sessions.push(input); return { url: "https://test.invalid/checkout" }; } } } }) },
    "@/lib/team-stores": { getStoreByHandle: async () => ({ id: "store-test", name: "Test", storeActive: true, taxExempt: true, storeItems: [
      { key: "jersey", sizes: ["Large"], label: "Jersey", priceCents: 2800, weightOz: 11 },
      { key: "shorts", sizes: ["Large"], label: "Shorts", priceCents: 2500, weightOz: 10 },
    ] }), applyFundraise: (price: number) => price, fundraisePortionCents: () => 0, shippingCentsFor: () => 1200 },
    "@/lib/pricing": tax, "@/lib/referral-cookie": { refCodeFromCookie: async () => null },
    "@/lib/attribution": { attributionFromCookie: async () => null },
    "@/lib/operational-events": { recordOperationalFailure: () => { throw new Error("Checkout unexpectedly failed"); } },
    "@/lib/shippo": { shippoEnabled: () => false },
    "@/lib/shipping-protection": { estimatedPostageFromChargedShipping: () => 0, shippingProtectionCents: () => 0, createShippingProtectionPrice: async () => null },
  });
  const post = (rush: boolean, items: Array<{ key: string; quantity: number }>) => route.POST(new Request("http://test.invalid", {
    method: "POST", body: JSON.stringify({ rush, shipZip: "33139", items: items.map((item) => ({ ...item, size: "Large" })) }),
  }), { params: Promise.resolve({ token: "test" }) });
  for (const count of [49, 50]) {
    const rejected = await post(true, [{ key: "jersey", quantity: count }]);
    assert.equal(rejected.status, 400);
    assert.match((await rejected.json()).error, /only for full team orders/);
    assert.equal(sessions.length, count === 49 ? 0 : 1);
    assert.equal((await post(false, [{ key: "jersey", quantity: count }])).status, 200);
    const session = sessions.at(-1)!;
    assert.equal(session.line_items.length, 1);
    assert.equal(session.line_items[0].price_data.unit_amount, 2800);
    assert.equal(session.line_items[0].quantity, count);
    assert.equal(session.shipping_options[0].shipping_rate_data.fixed_amount.amount, 1200);
    assert.equal(session.optional_items, undefined);
  }
  assert.equal((await post(false, [{ key: "jersey", quantity: 25 }, { key: "shorts", quantity: 25 }])).status, 200);
  assert.equal(sessions.at(-1)!.line_items.length, 2);
  assert.equal(sessions.at(-1)!.shipping_options[0].shipping_rate_data.fixed_amount.amount, 1200);
});
