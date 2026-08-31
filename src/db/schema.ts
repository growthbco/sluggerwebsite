import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  numeric,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

// Top-level product categories for Slugger Athletics.
export const productCategory = pgEnum("product_category", [
  "hats", // embroidered hats
  "uniforms", // team & sports uniforms (all sports)
  "chains", // 3D chains / hype chains
  "accessories", // everything else
]);

// Where an order originated. Drives Discord routing logic.
export const orderType = pgEnum("order_type", [
  "shop", // standard catalog purchase
  "buy_in", // limited themed drop
  "team_store", // purchase from a team's storefront
]);

export const orderStatus = pgEnum("order_status", [
  "pending", // checkout session created, not yet paid
  "paid",
  "fulfilled",
  "cancelled",
  "refunded",
]);

export const dropStatus = pgEnum("drop_status", [
  "scheduled", // not open yet
  "open",
  "closed",
  "sold_out",
]);

// Lifecycle of a quote-first team order.
export const teamOrderStatus = pgEnum("team_order_status", [
  "draft", // coach building the roster
  "collecting", // self-entry link shared, players filling rows
  "submitted", // coach submitted; roster locked
  "quoted", // total emailed to coach
  "paid",
  "in_production",
  "shipped",
  "cancelled",
]);

// Vendor (print designer) invoice lifecycle: he submits after an order is
// produced, we reconcile it against our records, then pay.
export const designerInvoiceStatus = pgEnum("designer_invoice_status", [
  "submitted", // designer sent it via the private link; awaiting our review/pay
  "paid", // one of us paid it
  "void", // mistake / duplicate, set aside
]);

// Design intake → proof → approval funnel; precedes the team order.
export const designRequestStatus = pgEnum("design_request_status", [
  "pending_payment", // intake filled but $35 design fee not yet paid (Stripe pending)
  "submitted", // client filled the intake form (fee paid or waived)
  "in_design", // designer is working on it
  "proof_sent", // designer uploaded a proof for client review
  "changes_requested", // client asked for revisions; back to designer
  "approved", // client approved the proof
  "ordered", // a team order was created against this design
  "cancelled",
]);

/* ------------------------------------------------------------------ */
/* Catalog                                                             */
/* ------------------------------------------------------------------ */

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    category: productCategory("category").notNull(),
    // Base price in cents. Variants may override.
    basePriceCents: integer("base_price_cents").notNull().default(0),
    active: boolean("active").notNull().default(true),
    featured: boolean("featured").notNull().default(false),
    // Carry the original WooCommerce id through migration for idempotent imports.
    legacyWooId: text("legacy_woo_id"),
    // SEO
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("products_slug_idx").on(t.slug),
    index("products_category_idx").on(t.category),
    uniqueIndex("products_legacy_woo_idx").on(t.legacyWooId),
  ],
);

export const productImages = pgTable(
  "product_images",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    alt: text("alt"),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("product_images_product_idx").on(t.productId)],
);

// Size/color (etc.) variants with their own price + stock.
export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sku: text("sku"),
    size: text("size"),
    color: text("color"),
    priceCents: integer("price_cents"), // null => use product.basePriceCents
    // null stock => made-to-order / unlimited (common for custom apparel).
    stock: integer("stock"),
    active: boolean("active").notNull().default(true),
  },
  (t) => [
    index("product_variants_product_idx").on(t.productId),
    uniqueIndex("product_variants_sku_idx").on(t.sku),
  ],
);

// Per-product customization fields (player name, number, embroidery text...).
export const customizationOptions = pgTable(
  "customization_options",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    label: text("label").notNull(), // e.g. "Player Name"
    kind: text("kind").notNull().default("text"), // text | number | select
    required: boolean("required").notNull().default(false),
    maxLength: integer("max_length"),
    options: jsonb("options").$type<string[]>(), // for select kind
    surchargeCents: integer("surcharge_cents").notNull().default(0),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("customization_options_product_idx").on(t.productId)],
);

/* ------------------------------------------------------------------ */
/* Drops / Buy-Ins                                                     */
/* ------------------------------------------------------------------ */

export const drops = pgTable(
  "drops",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    theme: text("theme"), // e.g. "Halloween Horror"
    description: text("description"),
    heroImageUrl: text("hero_image_url"),
    status: dropStatus("status").notNull().default("scheduled"),
    opensAt: timestamp("opens_at", { withTimezone: true }),
    closesAt: timestamp("closes_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("drops_slug_idx").on(t.slug)],
);

export const dropProducts = pgTable(
  "drop_products",
  {
    dropId: uuid("drop_id")
      .notNull()
      .references(() => drops.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
  },
  (t) => [uniqueIndex("drop_products_pk").on(t.dropId, t.productId)],
);

/* ------------------------------------------------------------------ */
/* Team Stores                                                         */
/* ------------------------------------------------------------------ */

export const teams = pgTable(
  "teams",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    sport: text("sport"),
    logoUrl: text("logo_url"),
    primaryColor: text("primary_color"),
    secondaryColor: text("secondary_color"),
    contactEmail: text("contact_email"),
    storeActive: boolean("store_active").notNull().default(false),
    // Tax-exempt org: store buyers pay no sales tax.
    taxExempt: boolean("tax_exempt").notNull().default(false),
    // Team fundraising: a % markup the organizer adds on top of every store
    // item. Buyers pay base + this %, and that portion is the team's raised
    // funds (tracked per order in orders.fundraiseCents).
    fundraisePercent: integer("fundraise_percent").notNull().default(0),
    storeOpensAt: timestamp("store_opens_at", { withTimezone: true }),
    storeClosesAt: timestamp("store_closes_at", { withTimezone: true }),

    // Per-person team store: private link where players/parents buy their own
    // gear at list prices. Created from an approved design request.
    storeToken: text("store_token"),
    // Persistent Discord forum thread for this store: all orders (incl. later
    // family add-ons) post into this one thread instead of scattering.
    storeThreadId: text("store_thread_id"),
    // One Discord thread PER customer (keyed by lowercased email), so each
    // buyer's orders + later add-ons stay together in their own thread instead
    // of all piling into the single store thread.
    storeCustomerThreads: jsonb("store_customer_threads").$type<Record<string, string>>().default({}),
    // Store add-on print-file QA, keyed by design group (gray/white/practice
    // etc.) since one store has multiple print files, one per design.
    storePrintFileQa: jsonb("store_print_file_qa").$type<Record<string, {
      urls: string[];
      ok: boolean;
      summary: string;
      extracted: { name: string; number: string; size: string }[];
      mismatches: { kind: "missing" | "extra" | "wrong_size" | "wrong_number" | "name_typo"; roster?: { name?: string; number?: string; size?: string }; printed?: { name?: string; number?: string; size?: string }; detail: string }[];
      dismissed?: number[];
      verifiedAt: string;
      model: string;
    }>>(),
    approvedDesignUrl: text("approved_design_url"),
    designRequestId: uuid("design_request_id"),
    // Items purchasable in this store (label/price/sizes snapshot so catalog
    // edits never change a live store).
    storeItems: jsonb("store_items").$type<
      Array<{
        key: string;
        label: string;
        priceCents: number;
        sizes: string[];
        nameNumber?: boolean;
        numberAddOnCents?: number;
        weightOz: number;
        designs?: { label: string; image: string }[];
        image?: string;
      }>
    >(),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("teams_slug_idx").on(t.slug),
    uniqueIndex("teams_store_token_idx").on(t.storeToken),
    index("teams_design_request_idx").on(t.designRequestId),
  ],
);

export const teamStoreProducts = pgTable(
  "team_store_products",
  {
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
  },
  (t) => [uniqueIndex("team_store_products_pk").on(t.teamId, t.productId)],
);

/* ------------------------------------------------------------------ */
/* Orders (paid, via Stripe) - Shop / Buy-In / Team Store              */
/* ------------------------------------------------------------------ */

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // Human-friendly sequential-ish reference shown to staff/customer.
    reference: text("reference").notNull(),
    type: orderType("type").notNull().default("shop"),
    status: orderStatus("status").notNull().default("pending"),

    customerName: text("customer_name"),
    customerEmail: text("customer_email"),
    // Buyer phone captured by Stripe Checkout (phone_number_collection). Lets
    // store buyers get the ship/tracking + review texts, same as team orders.
    customerPhone: text("customer_phone"),
    // Post-delivery review request sent (once). Null = not yet asked.
    reviewRequestedAt: timestamp("review_requested_at", { withTimezone: true }),
    shippingAddress: jsonb("shipping_address").$type<{
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    }>(),

    subtotalCents: integer("subtotal_cents").notNull().default(0),
    shippingCents: integer("shipping_cents").notNull().default(0),
    // Optional customer-funded XCover package protection. `value` is the
    // merchandise value the customer chose to protect; `covered` is allocated
    // across purchased Shippo labels (important when one order uses 2 boxes).
    shippingProtectionCents: integer("shipping_protection_cents").notNull().default(0),
    shippingProtectionValueCents: integer("shipping_protection_value_cents").notNull().default(0),
    shippingProtectionCoveredCents: integer("shipping_protection_covered_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull().default(0),

    // Stripe linkage
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),

    // Set true once successfully pushed to Discord so retries don't double-post.
    discordNotifiedAt: timestamp("discord_notified_at", { withTimezone: true }),

    // Fulfillment (tracking emailed to the buyer on ship; labelUrl is the
    // Shippo PDF for reprints).
    trackingNumber: text("tracking_number"),
    labelUrl: text("label_url"),
    // Carrier of the primary outbound label (FedEx/UPS/USPS/DHL) - needed to
    // poll live delivery status (the review text waits until it's Delivered).
    shipCarrier: text("ship_carrier"),
    // Set when this order's designer cost has been settled OUTSIDE the invoice
    // tool (paid the designer directly) - drops it from the "not yet billed"
    // list and the designer's quick-add.
    designerSettledAt: timestamp("designer_settled_at", { withTimezone: true }),
    // ACTUAL amount paid to the designer/factory for THIS order (COGS), recorded
    // by staff - drives true per-order margin instead of an estimate.
    designerCostCents: integer("designer_cost_cents"),
    // Shippo transaction object id of the primary label (lets us schedule a
    // carrier pickup for it).
    shipTransactionId: text("ship_transaction_id"),
    // Extra parcels beyond the first (a second box, a reship, hats shipping
    // on their own). Each carries its own tracking + label + emailed flag.
    additionalShipments: jsonb("additional_shipments").$type<
      { trackingNumber: string; labelUrl?: string; carrier?: string; service?: string; transactionId?: string; insuredValueCents?: number; at: string }[]
    >(),
    shippedAt: timestamp("shipped_at", { withTimezone: true }),
    // Carrier-recorded delivery time. Multi-parcel orders use the latest
    // delivery scan so the customer gets the full inspection window.
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    deliveryNoticeSentAt: timestamp("delivery_notice_sent_at", { withTimezone: true }),
    // Admin can hide a fulfilled/void shop or store order from the active list.
    archivedAt: timestamp("archived_at", { withTimezone: true }),

    // Origin context (drop or team store) when applicable.
    dropId: uuid("drop_id").references(() => drops.id, { onDelete: "set null" }),
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),

    // Self-serve "add to my order" top-ups: Stripe session ids already merged
    // into this order, so a webhook retry can't append the same items twice.
    addSessionIds: jsonb("add_session_ids").$type<string[]>().default([]),

    // Optional note the buyer left at checkout (team store).
    customerNote: text("customer_note"),
    // First-touch attribution ("Google", "Instagram", "Direct", ...).
    source: text("source"),
    // The team-fundraising portion of this order (sum of the % markup), for
    // tracking how much a store has raised for its team.
    fundraiseCents: integer("fundraise_cents").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("orders_reference_idx").on(t.reference),
    uniqueIndex("orders_stripe_session_idx").on(t.stripeCheckoutSessionId),
    index("orders_status_idx").on(t.status),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
    // Snapshot fields so the line item survives catalog edits.
    name: text("name").notNull(),
    size: text("size"),
    color: text("color"),
    // Captured customization: { "Player Name": "SMITH", "Number": "23" }
    customization: jsonb("customization").$type<Record<string, string>>(),
    quantity: integer("quantity").notNull().default(1),
    unitPriceCents: integer("unit_price_cents").notNull().default(0),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

/* ------------------------------------------------------------------ */
/* Team Orders (quote-first, roster-based) + self-entry                */
/* ------------------------------------------------------------------ */

export const teamOrders = pgTable(
  "team_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reference: text("reference").notNull(),
    status: teamOrderStatus("status").notNull().default("draft"),

    // Coach / requester
    teamName: text("team_name").notNull(),
    contactName: text("contact_name").notNull(),
    contactEmail: text("contact_email").notNull(),
    contactPhone: text("contact_phone"),
    // Active SMS opt-in from the order form (A2P compliance).
    smsOptInAt: timestamp("sms_opt_in_at", { withTimezone: true }),
    salesRep: text("sales_rep"),
    // Where this order came from ("Google (organic) → /custom-softball-uniforms",
    // "Instagram", "Direct"), captured from the visitor's first-touch cookie.
    source: text("source"),

    sport: text("sport"),
    jerseyStyle: text("jersey_style"), // crew / v-neck / full button / two button
    // Staff note for the designer/production about this order (e.g. "light grey,
    // not the dark one"). Shown in admin + pushed to Discord.
    designerNote: text("designer_note"),
    // Ocala league-family pricing: standard jerseys at $25 instead of $28.
    // Set by staff for teams that play in our leagues.
    localPricing: boolean("local_pricing").notNull().default(false),
    // One-time $20 hat digitizing fee already paid on a prior order for this
    // design -> waive it on this order (auto-set at invoicing, staff toggle).
    embroideryFeeWaived: boolean("embroidery_fee_waived").notNull().default(false),
    // Tax-exempt org/company: no sales tax on this order's invoices.
    taxExempt: boolean("tax_exempt").notNull().default(false),
    // Paid white-label upgrade: remove every Slugger mark (SA back logo,
    // branded neck label, and branded size/barcode tag). Adds a per-piece fee
    // to the invoice; production must omit the branding.
    whiteLabel: boolean("white_label").notNull().default(false),
    jerseyMaterial: text("jersey_material"), // birdseye mesh / pro smooth
    // Which item types this order covers, e.g. ["jersey","pants","socks"].
    items: jsonb("items").$type<string[]>().default(["jersey"]),
    rushShipping: boolean("rush_shipping").notNull().default(false),
    // Manual-order timeline override. Website orders derive their clock from
    // approval + final roster + deposit; orders entered by staff must record
    // these facts explicitly so a missing legacy timestamp never invents a
    // customer promise.
    manualEntryAt: timestamp("manual_entry_at", { withTimezone: true }),
    timelineStartAt: timestamp("timeline_start_at", { withTimezone: true }),
    turnaroundTier: text("turnaround_tier"), // standard | rush | priority
    requestedInHandAt: timestamp("requested_in_hand_at", { withTimezone: true }),
    customerDatePromised: boolean("customer_date_promised").notNull().default(false),
    promisedInHandAt: timestamp("promised_in_hand_at", { withTimezone: true }),
    // One-week Priority is never auto-priced. Staff must enter the premium
    // amount when creating the manual order; it becomes a labeled quote line.
    priorityFeeCents: integer("priority_fee_cents").notNull().default(0),
    // "Do players need a name on the back?" survey answer for the roster form.
    // Default true (most jerseys); auto-set false at provisioning for name-less
    // items like cheer sets. When false, the roster hides the name field so
    // players just enter a size.
    requiresNames: boolean("requires_names").notNull().default(true),

    // Uploaded approved design + optional roster file.
    approvedDesignUrl: text("approved_design_url"),
    rosterFileUrl: text("roster_file_url"),
    specialInstructions: text("special_instructions"),

    // Print-file QA: the designer uploads the print-file layout, we OCR it with
    // Gemini and compare against the submitted roster to catch typos before printing.
    printFileUrl: text("print_file_url"),
    // Print files can span several sheets; all are stored, printFileUrl keeps
    // the first for back-compat.
    printFileUrls: jsonb("print_file_urls").$type<string[]>(),
    // The approved print-file sheets for the ORIGINAL order (last full-roster
    // verification), kept even after add-on sheets replace printFileUrls, so
    // the original's file stays attached in roster history.
    originalPrintFileUrls: jsonb("original_print_file_urls").$type<string[]>(),
    // In-house hat production progress, checked off on the /hat-sheet page.
    // Keyed per physical hat ("rosterRowId:itemKey:unitIndex") with per-stage
    // flags: s = stitched, c = cleaned, b = bagged.
    hatChecklist: jsonb("hat_checklist").$type<Record<string, { s?: boolean; c?: boolean; b?: boolean }>>(),
    printFileVerifiedAt: timestamp("print_file_verified_at", { withTimezone: true }),
    printFileVerification: jsonb("print_file_verification").$type<{
      ok: boolean;
      summary: string;
      extracted: { name: string; number: string; size: string }[];
      mismatches: {
        kind: "missing" | "extra" | "wrong_size" | "wrong_number" | "name_typo";
        roster?: { name?: string; number?: string; size?: string };
        printed?: { name?: string; number?: string; size?: string };
        detail: string;
      }[];
      // Indexes of mismatches a human reviewed and marked as actually fine
      // (e.g. the AI misread a funky font). When every mismatch is dismissed,
      // the order counts as verified.
      dismissed?: number[];
      verifiedAt: string;
      model: string;
    }>(),

    shippingAddress: jsonb("shipping_address").$type<{
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    }>(),

    // Secret token for the public player self-entry link (add rows only).
    selfEntryToken: text("self_entry_token"),
    // Secret token for the coach's private manage link (view all + submit).
    manageToken: text("manage_token"),
    selfEntryOpen: boolean("self_entry_open").notNull().default(false),

    // Optional link back to the design request this team order fulfills.
    designRequestId: uuid("design_request_id"),
    // Canonical Discord thread for this order. Usually copied from the linked
    // design request, but standalone/manual orders can own a thread in the
    // Design Requests forum without inventing a design-request DB record.
    discordThreadId: text("discord_thread_id"),

    quotedTotalCents: integer("quoted_total_cents"),
    // Two-stage invoicing: a 50% deposit starts production; the balance is
    // collected when the order is ready. Each is a one-time Stripe Payment
    // Link; payment lands via webhook.
    invoiceUrl: text("invoice_url"), // deposit link
    fullInvoiceUrl: text("full_invoice_url"), // optional pay-in-full link (sibling of deposit)
    depositCents: integer("deposit_cents"),
    depositPaidAt: timestamp("deposit_paid_at", { withTimezone: true }),
    balanceInvoiceUrl: text("balance_invoice_url"),
    // Shipping charged to the customer on the final invoice (0 = local pickup).
    shippingChargedCents: integer("shipping_charged_cents"),
    // Optional customer-funded XCover package protection. Coverage is offered
    // on pay-in-full/final-balance links, then allocated across Shippo labels.
    shippingProtectionCents: integer("shipping_protection_cents").notNull().default(0),
    shippingProtectionValueCents: integer("shipping_protection_value_cents").notNull().default(0),
    shippingProtectionCoveredCents: integer("shipping_protection_covered_cents").notNull().default(0),
    // Local order: customer picks up in Ocala - no shipping anywhere (admin
    // estimates, invoices, balance default all show pickup instead).
    localPickup: boolean("local_pickup").notNull().default(false),
    // Owner-negotiated per-jersey price for THIS order (e.g. $23 for a
    // long-time customer). Wins over the standard and Ocala prices.
    customJerseyCents: integer("custom_jersey_cents"),
    // Offline payments (Zelle, CashApp, cash...) recorded by staff from the
    // admin page, e.g. "deposit via Zelle - $330 (Jul 22, 2026)".
    paymentNote: text("payment_note"),
    invoicePaidAt: timestamp("invoice_paid_at", { withTimezone: true }), // fully paid
    // One-time "want to add more?" nudge, sent ~a day after the first payment
    // with the self-serve add-on link. Set once so it never repeats.
    addonNudgeSentAt: timestamp("addon_nudge_sent_at", { withTimezone: true }),
    // Unpaid-invoice reminders (deposit or balance); reset on each new invoice.
    invoiceRemindersSent: integer("invoice_reminders_sent").notNull().default(0),
    lastInvoiceReminderAt: timestamp("last_invoice_reminder_at", { withTimezone: true }),
    // Fulfillment (labelUrl = Shippo PDF for reprints)
    trackingNumber: text("tracking_number"),
    labelUrl: text("label_url"),
    // Carrier of the primary outbound label (FedEx/UPS/USPS/DHL) - needed to
    // poll live delivery status (the review text waits until it's Delivered).
    shipCarrier: text("ship_carrier"),
    // Set when this order's designer cost has been settled OUTSIDE the invoice
    // tool (paid the designer directly) - drops it from the "not yet billed"
    // list and the designer's quick-add.
    designerSettledAt: timestamp("designer_settled_at", { withTimezone: true }),
    // ACTUAL amount paid to the designer/factory for THIS order (COGS), recorded
    // by staff - drives true per-order margin instead of an estimate.
    designerCostCents: integer("designer_cost_cents"),
    // Shippo transaction object id of the primary label (lets us schedule a
    // carrier pickup for it).
    shipTransactionId: text("ship_transaction_id"),
    // Extra parcels beyond the first (a second box, a reship, hats shipping
    // on their own). Each carries its own tracking + label + emailed flag.
    additionalShipments: jsonb("additional_shipments").$type<
      { trackingNumber: string; labelUrl?: string; carrier?: string; service?: string; transactionId?: string; insuredValueCents?: number; at: string }[]
    >(),
    shippedAt: timestamp("shipped_at", { withTimezone: true }),
    // Carrier-recorded delivery time. Multi-parcel orders use the latest
    // delivery scan so the customer gets the full inspection window.
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    deliveryNoticeSentAt: timestamp("delivery_notice_sent_at", { withTimezone: true }),
    // When the post-delivery "how'd it turn out? leave a review" text went out
    // (once per order, a few days after shipping). Null = not yet asked.
    reviewRequestedAt: timestamp("review_requested_at", { withTimezone: true }),
    // When we texted the coach their referral link ("refer a team, you both
    // get a free jersey"), once, about a week after delivery.
    referralPromptedAt: timestamp("referral_prompted_at", { withTimezone: true }),
    // When we texted a next-season reorder nudge (~a year after the order),
    // once, so long-cycle teams get invited back before their season.
    reorderPromptedAt: timestamp("reorder_prompted_at", { withTimezone: true }),

    // Inbound production shipment (factory -> Slugger in Florida). Entered by
    // the designer on /design/manage. Internal only - never shown to the
    // customer; their tracking is the outbound trackingNumber above.
    inboundCarrier: text("inbound_carrier"),
    inboundTrackingNumber: text("inbound_tracking_number"),
    inboundTrackingAddedAt: timestamp("inbound_tracking_added_at", { withTimezone: true }),
    // Last stalled-shipment nudge posted to the designer (cron dedupe).
    inboundNudgedAt: timestamp("inbound_nudged_at", { withTimezone: true }),

    // Admin archive: hides the order from the active list without deleting it,
    // with a note ("lost - went with competitor") for later follow-up.
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    archivedNote: text("archived_note"),

    // Timestamped proof that the coach accepted the delivery-delay policy at
    // final roster submission (standard dates are estimates, rush must be
    // confirmed, and carrier delays are outside Slugger's control).
    deliveryTermsAcceptedAt: timestamp("delivery_terms_accepted_at", { withTimezone: true }),
    // Immutable customer-facing summary accepted with the final roster. This
    // preserves the exact material, artwork, sizes, service level and subtotal
    // the coach reviewed even if catalog copy or pricing changes later.
    specConfirmedAt: timestamp("spec_confirmed_at", { withTimezone: true }),
    specSnapshot: jsonb("spec_snapshot").$type<import("@/lib/order-spec").CustomerOrderSpec>(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("team_orders_reference_idx").on(t.reference),
    uniqueIndex("team_orders_self_entry_token_idx").on(t.selfEntryToken),
    uniqueIndex("team_orders_manage_token_idx").on(t.manageToken),
    index("team_orders_status_idx").on(t.status),
    index("team_orders_design_request_idx").on(t.designRequestId),
  ],
);

// Post-submission add-ons: a coach pays for a few extra pieces on an existing
// order (no new design/order). Rows land on the roster once the Stripe
// checkout completes.
export const teamOrderAddons = pgTable(
  "team_order_addons",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamOrderId: uuid("team_order_id")
      .notNull()
      .references(() => teamOrders.id, { onDelete: "cascade" }),
    rows: jsonb("rows")
      .$type<Array<{ key: string; label: string; size: string; name?: string; number?: string; design?: string; quantity: number; unitPriceCents: number }>>()
      .notNull(),
    totalCents: integer("total_cents").notNull(), // goods only (pre-tax/shipping)
    // What the customer actually paid at checkout (goods + 7% tax + shipping),
    // so the admin can show why the total is what it is.
    paidTotalCents: integer("paid_total_cents"),
    status: text("status").notNull().default("pending"), // pending | paid
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    // Set once this batch's pieces have passed print-file QA (or a prior batch
    // was already produced/shipped). Unverified paid batches are what the
    // "add-ons only" print-file check verifies; verified ones are archived
    // history and never re-flagged.
    printVerifiedAt: timestamp("print_verified_at", { withTimezone: true }),
    // The approved print-file sheet URLs for this batch (kept with the order so
    // they can be reopened/enlarged later).
    printFileUrls: jsonb("print_file_urls").$type<string[]>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("team_order_addons_order_idx").on(t.teamOrderId)],
);

// One row per player on a team order (Name / Number / Size / Notes).
export const teamOrderRoster = pgTable(
  "team_order_roster",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamOrderId: uuid("team_order_id")
      .notNull()
      .references(() => teamOrders.id, { onDelete: "cascade" }),
    playerName: text("player_name"),
    playerNumber: text("player_number"),
    size: text("size"), // legacy / jersey size
    // Per-item sizes, e.g. { jersey: "L", pants: "32", socks: "M" }.
    sizes: jsonb("sizes").$type<Record<string, string>>(),
    style: text("style"), // optional per-player style override (hoodie, shorts...)
    notes: text("notes"),
    // Which approved design/colorway this jersey is (label, e.g. "Gray" or
    // "Black Pullover"), when the team has more than one approved design.
    design: text("design"),
    quantity: integer("quantity").notNull().default(1),
    // How the row was created: "coach" or "self".
    filledBy: text("filled_by").notNull().default("coach"),
    position: integer("position").notNull().default(0),
    // Per-jersey print-file verification: set when this specific jersey was
    // checked against a print sheet. printVerifiedSheet holds the sheet URL it
    // was verified on. Lets QA work jersey-by-jersey (verify new ones without
    // re-checking already-verified ones).
    printVerifiedAt: timestamp("print_verified_at", { withTimezone: true }),
    printVerifiedSheet: text("print_verified_sheet"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("team_order_roster_order_idx").on(t.teamOrderId)],
);

/* ------------------------------------------------------------------ */
/* Design Requests (intake → proof → approval)                         */
/* ------------------------------------------------------------------ */

export const designRequests = pgTable(
  "design_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reference: text("reference").notNull(),
    status: designRequestStatus("status").notNull().default("submitted"),

    // Requester / team
    teamName: text("team_name").notNull(),
    sport: text("sport"),
    contactName: text("contact_name").notNull(),
    contactEmail: text("contact_email").notNull(),
    contactPhone: text("contact_phone"),
    // When the customer actively checked the SMS opt-in box on the intake
    // form (A2P compliance: we only text consented numbers).
    smsOptInAt: timestamp("sms_opt_in_at", { withTimezone: true }),

    // The brief
    vision: text("vision"), // free-form description of desired look
    colors: text("colors"),
    notes: text("notes"),

    // What the customer wants mocked up: product labels the client picked
    // ("Jersey", "Shorts", "Hat", "Hoodie", or their own "Other" text) and the
    // jersey cut when a jersey is requested (Two-button, Crew neck, V-neck...).
    productTypes: jsonb("product_types").$type<string[]>().default([]),
    jerseyStyle: text("jersey_style"),
    // Approximate piece count the client expects ("3-9", "25+", ...). Asked at
    // intake to qualify the request - full custom designs aren't worth doing
    // for a single piece, so staff sees this before design work starts.
    estimatedPieces: text("estimated_pieces"),
    // Staff-confirmed white-label upgrade. This is captured while the artwork
    // is still being reviewed, then inherited by the team order created on
    // approval so pricing and production cannot lose the instruction.
    whiteLabel: boolean("white_label").notNull().default(false),
    // Exact colors the customer picked from the hex wheel (e.g. ["#EC4899",
    // "#000000"]). The free-form `colors` text still holds names/notes.
    colorHexes: jsonb("color_hexes").$type<string[]>().default([]),

    // When the customer wants the uniforms in hand. Anything inside the standard
    // 3-week window triggers review: 2-week rush is $100, while shorter dates
    // require a manually priced internal priority review.
    neededBy: timestamp("needed_by", { withTimezone: true }),
    rush: boolean("rush").notNull().default(false),
    // When the customer ticked the required "delivery dates are estimates and
    // delays outside our control aren't our responsibility" acknowledgment on
    // the intake form - a timestamped record for disputes.
    delaysAckAt: timestamp("delays_ack_at", { withTimezone: true }),
    // Staff sign-off that we can actually hit the rush date (who + when).
    // Unapproved rush requests show "confirming your date" to the client.
    rushApprovedAt: timestamp("rush_approved_at", { withTimezone: true }),
    rushApprovedBy: text("rush_approved_by"),

    // Revision tracking. We cap at MAX_REVISIONS so clients can't loop forever.
    // changeRequests stores the structured feedback from each round (annotations
    // pinned to the proof + general note + which proof url it was made against).
    revisionsUsed: integer("revisions_used").notNull().default(0),
    changeRequests: jsonb("change_requests")
      .$type<
        Array<{
          at: string;
          proofImageUrl?: string;
          generalNote?: string;
          annotations?: { n: number; x: number; y: number; note: string }[];
        }>
      >()
      .default([]),

    // Designer <-> client Q&A thread. Designer posts from the manage page,
    // client answers from the status page. Distinct from changeRequests:
    // messages don't burn a revision.
    messages: jsonb("messages")
      .$type<Array<{ at: string; from: "designer" | "client"; text: string; name?: string; attachments?: string[] }>>()
      .default([]),

    // Inspiration uploaded by the client (Vercel Blob URLs).
    inspirationImages: jsonb("inspiration_images").$type<string[]>().default([]),
    // Proof/mockup images uploaded by the designer.
    proofImages: jsonb("proof_images").$type<string[]>().default([]),
    // Exact proof batch currently in front of the customer. Uploading a newer
    // batch moves these URLs to supersededProofUrls and clears the old approval,
    // so approval always belongs to an immutable file/version rather than the
    // overall design request.
    proofReviewUrls: jsonb("proof_review_urls").$type<string[]>().default([]),
    supersededProofUrls: jsonb("superseded_proof_urls").$type<string[]>().default([]),
    // Optional human labels for proofs, keyed by image URL (e.g. "Practice
    // Jersey 1"), shown to staff and the client.
    proofLabels: jsonb("proof_labels").$type<Record<string, string>>().default({}),
    // Stable SKU / item number per approved design, keyed by image URL. Assigned
    // when a design is approved (a name is required then), so a team store can
    // reference exactly which jersey without confusion.
    designSkus: jsonb("design_skus").$type<Record<string, string>>().default({}),
    // Persistent AI design memory: the iterative concept + every revision, so
    // the designer can "pick up where we left off" when a customer requests
    // changes - survives sessions, browsers, and staff handoffs.
    aiDesignState: jsonb("ai_design_state").$type<{
      sport?: string;
      style?: string;
      primaryColor?: string;
      secondaryColor?: string;
      teamName?: string;
      versions: { url: string; cleanUrl?: string; product?: string; note: string; at: string }[];
    }>(),
    // The single approved proof URL (selected on approval) - attached to the team order.
    approvedDesignUrl: text("approved_design_url"),
    // ALL approved proofs. A project can have several final mockups (jersey,
    // hat, hoodie, pants), each approved individually from /design/manage.
    // approvedDesignUrl above stays the primary (first) for older surfaces.
    approvedDesignUrls: jsonb("approved_design_urls").$type<string[]>(),

    // Tokens powering the public client + private staff links.
    statusToken: text("status_token"),
    // First-touch attribution ("Google", "Instagram", "Direct", ...).
    source: text("source"),
    manageToken: text("manage_token"),

    // Discord thread id of this request's forum post (captured on first send).
    // Used so change-request + approval follow-ups land in the SAME thread
    // instead of creating a new one per event.
    discordThreadId: text("discord_thread_id"),

    // Design fee ($35 default) - captured upfront to filter out customers who
    // would otherwise shop the design elsewhere. Waived automatically for
    // returning customers (matched by email against prior approved design or
    // submitted team order).
    designFeeAmountCents: integer("design_fee_amount_cents").notNull().default(3500),
    designFeePaidAt: timestamp("design_fee_paid_at", { withTimezone: true }),
    designFeePaymentId: text("design_fee_payment_id"), // stripe session id
    designFeeWaivedReason: text("design_fee_waived_reason"), // returning_customer | promo:<code> | manual
    designFeeWaivedRef: text("design_fee_waived_ref"), // e.g. "DR-XXXX" of the prior order that triggered the waiver

    // Automated proof follow-ups: how many reminders we've emailed and when
    // the last one went out. Capped so clients never get spammed.
    followUpsSent: integer("follow_ups_sent").notNull().default(0),
    lastFollowUpAt: timestamp("last_follow_up_at", { withTimezone: true }),
    // Staff can temporarily park a quiet proof without archiving the customer.
    // The shared follow-up policy resumes from the existing reminder round
    // after this timestamp passes.
    followUpSnoozedUntil: timestamp("follow_up_snoozed_until", { withTimezone: true }),
    // Internal SLA: last time we pinged the designer that this design has been
    // waiting with no first proof sent (>24h).
    designerRemindedAt: timestamp("designer_reminded_at", { withTimezone: true }),

    // Admin archive: hides the request from the active list (and stops auto
    // follow-ups) without deleting it. Note is for later follow-up context.
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    archivedNote: text("archived_note"),

    // Auto-gallery: once approved, a design shows in the public "Recent
    // Designs" showcase by default. Set true to hide one specific design from
    // the gallery (does not affect the order or anything else).
    galleryHidden: boolean("gallery_hidden").notNull().default(false),

    // Timestamps
    proofSentAt: timestamp("proof_sent_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    orderedAt: timestamp("ordered_at", { withTimezone: true }),
    // Staff marked "I followed up" (e.g. texted/called the customer outside the
    // thread). Clears the "waiting on us" flag until the customer messages again
    // after this time. Reset whenever a newer client message arrives.
    followedUpAt: timestamp("followed_up_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("design_requests_reference_idx").on(t.reference),
    uniqueIndex("design_requests_status_token_idx").on(t.statusToken),
    uniqueIndex("design_requests_manage_token_idx").on(t.manageToken),
    index("design_requests_status_idx").on(t.status),
  ],
);

/* ------------------------------------------------------------------ */
/* Customers (portal profile)                                          */
/* ------------------------------------------------------------------ */
// One profile per buyer, keyed by lowercased email. Orders stay the source of
// truth for what was bought; this holds portal-level data: editable contact,
// optional password, and referral state. Rows are created lazily the first
// time someone opens the portal or gets attributed a referral.
export const customers = pgTable(
  "customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(), // always stored lowercased
    name: text("name"),
    phone: text("phone"),
    // Optional password: scrypt hash ("salt:hash" hex), null until the
    // customer sets one.
    passwordHash: text("password_hash"),
    // Their own code to share; unique, uppercase, no ambiguous chars.
    referralCode: text("referral_code").notNull(),
    // The code that referred THIS customer, if any (set once at first order).
    referredByCode: text("referred_by_code"),
    // Store credit earned from referrals, in cents. Applied by staff on the
    // referrer's next invoice for now.
    referralCreditCents: integer("referral_credit_cents").notNull().default(0),
    // Set once this customer's referral reward has been granted, so a second
    // paid order never double-pays. Null until their first paid order settles.
    referralRewardedAt: timestamp("referral_rewarded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("customers_email_idx").on(t.email),
    uniqueIndex("customers_referral_code_idx").on(t.referralCode),
    index("customers_referred_by_idx").on(t.referredByCode),
  ],
);

/* ------------------------------------------------------------------ */
/* Relations                                                           */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Custom invoices                                                     */
/* ------------------------------------------------------------------ */

// Free-form invoices built from scratch on /admin/invoice/new - name the
// items, price them, send. Not tied to a team order or design request.
export const customInvoices = pgTable("custom_invoices", {
  id: uuid("id").defaultRandom().primaryKey(),
  reference: text("reference").notNull(), // INV-XXXXXX
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  lines: jsonb("lines")
    .$type<Array<{ name: string; description?: string; quantity: number; unitPriceCents: number }>>()
    .notNull(),
  // Notes / terms & conditions block shown at the bottom of the invoice.
  notes: text("notes"),
  taxExempt: boolean("tax_exempt").notNull().default(false),
  subtotalCents: integer("subtotal_cents").notNull(),
  // Referral store credit applied to this invoice (deducted from the goods
  // and the tax base at creation; redeemed from the customer's balance in
  // the webhook when the invoice is actually paid).
  creditCents: integer("credit_cents").notNull().default(0),
  // Shipping charged on the invoice (quoted from the customer's ZIP + the
  // estimated package weight; 0 = pickup / no shipping).
  shippingCents: integer("shipping_cents").notNull().default(0),
  taxCents: integer("tax_cents").notNull().default(0),
  totalCents: integer("total_cents").notNull(),
  payUrl: text("pay_url"),
  status: text("status").notNull().default("sent"), // sent | paid
  paidAt: timestamp("paid_at", { withTimezone: true }),
  paymentNote: text("payment_note"), // offline payment record
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Item library for custom invoices: every line ever sent on an invoice is
// upserted here (keyed by lowercased name, latest description/price wins),
// so staff pick items from a dropdown instead of retyping them.
export const invoiceItems = pgTable(
  "invoice_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    nameKey: text("name_key").notNull(), // lowercased for dedupe
    description: text("description"),
    // Extra search words ("crewneck crew neck" on Round-Neck Jersey) so the
    // picker finds items by whatever staff actually call them.
    aliases: text("aliases"),
    unitPriceCents: integer("unit_price_cents").notNull().default(0),
    // Per-piece shipping weight for the auto shipping estimate.
    weightOz: integer("weight_oz").notNull().default(16),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("invoice_items_name_key_idx").on(t.nameKey)],
);

/* ------------------------------------------------------------------ */
/* AI assistant knowledge                                              */
/* ------------------------------------------------------------------ */

// Facts staff teach the AI assistant from the admin page ("train the bot").
// Every row is injected into the assistant's grounded knowledge - both the
// auto-replies on client threads and the staff "Suggest reply" drafts - as
// authoritative shop policy.
export const assistantFacts = pgTable("assistant_facts", {
  id: uuid("id").defaultRandom().primaryKey(),
  fact: text("fact").notNull(),
  addedBy: text("added_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const productsRelations = relations(products, ({ many }) => ({
  images: many(productImages),
  variants: many(productVariants),
  customizationOptions: many(customizationOptions),
  dropProducts: many(dropProducts),
  teamStoreProducts: many(teamStoreProducts),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, { fields: [productImages.productId], references: [products.id] }),
}));

export const productVariantsRelations = relations(productVariants, ({ one }) => ({
  product: one(products, { fields: [productVariants.productId], references: [products.id] }),
}));

export const customizationOptionsRelations = relations(customizationOptions, ({ one }) => ({
  product: one(products, { fields: [customizationOptions.productId], references: [products.id] }),
}));

export const dropsRelations = relations(drops, ({ many }) => ({
  dropProducts: many(dropProducts),
}));

export const dropProductsRelations = relations(dropProducts, ({ one }) => ({
  drop: one(drops, { fields: [dropProducts.dropId], references: [drops.id] }),
  product: one(products, { fields: [dropProducts.productId], references: [products.id] }),
}));

// AI design lab ladder: 3 free generations -> email unlocks 5 more -> $10
// credited "design session" unlocks the rest. One row per browser visitor.
export const designLabVisitors = pgTable("design_lab_visitors", {
  id: uuid("id").primaryKey().defaultRandom(),
  visitorKey: text("visitor_key").notNull().unique(),
  email: text("email"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  phone: text("phone"),
  // First-touch traffic source, captured the first time this visitor hit the
  // lab (e.g. "Google -> /custom-jersey-maker", "Instagram (ad)", "Direct").
  // Answers "how did they get to the AI Design Lab" - the lab origin alone
  // doesn't say whether they came from search, social, an ad, or direct.
  source: text("source"),
  generations: integer("generations").notNull().default(0),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  stripeRef: text("stripe_ref"),
  // "Can we help?" re-engagement texts sent to a lead who designed but never
  // ordered (max 2, a day then a few days later). Twilio blocks opted-out
  // numbers automatically, so we only track how many we've sent + when.
  smsFollowUpsSent: integer("sms_follow_ups_sent").notNull().default(0),
  lastFollowUpAt: timestamp("last_follow_up_at", { withTimezone: true }),
  // Season-aware re-engagement: last time we pinged this lead ahead of a busy
  // season (spring baseball/softball, fall ball). Capped once per season window
  // so a cold lead gets a nudge each new season without being spammed.
  lastSeasonalPromptAt: timestamp("last_seasonal_prompt_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Every SMS/WhatsApp message in or out of the shop's Twilio number
// (352) 414-7270 - powers the /admin/texts inbox where staff read and
// reply to customer texts.
export const smsMessages = pgTable(
  "sms_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    phone: text("phone").notNull(), // customer number, E.164 (+13525551234)
    direction: text("direction").notNull(), // in | out
    channel: text("channel").notNull().default("sms"), // sms | whatsapp
    body: text("body").notNull(),
    mediaCount: integer("media_count").notNull().default(0),
    // Public image URLs attached to this message (our Vercel Blob links out,
    // Twilio media links in) so the thread can show the actual pictures.
    mediaUrls: jsonb("media_urls").$type<string[]>(),
    staff: text("staff"), // who sent it (outbound only)
    twilioSid: text("twilio_sid"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sms_messages_phone_idx").on(t.phone, t.createdAt)],
);

// Back-office logins with roles. Each person has their OWN password (no
// usernames - the password identifies them at login). Roles gate what the
// sidebar shows and which pages load:
//   owner    - everything, including user management
//   staff    - everything except user management
//   designer - design work only (no money, customers, or store pages)
// The ADMIN_PASSWORD env var remains the built-in owner login.
export const adminUsers = pgTable("admin_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  role: text("role").notNull().default("staff"), // owner | staff | designer
  passwordHash: text("password_hash").notNull(), // scrypt "salt:hex"
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Customer-facing failures that need a human follow-up. Callers upsert by
// fingerprint so a noisy integration creates one actionable alert instead of
// flooding the admin dashboard with duplicates.
export const operationalEvents = pgTable(
  "operational_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fingerprint: text("fingerprint").notNull(),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    detail: text("detail"),
    href: text("href"),
    context: jsonb("context").$type<Record<string, string | number | boolean | null>>(),
    occurrences: integer("occurrences").notNull().default(1),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedBy: text("resolved_by"),
  },
  (t) => [
    uniqueIndex("operational_events_fingerprint_idx").on(t.fingerprint),
    index("operational_events_unresolved_idx").on(t.resolvedAt, t.lastSeenAt),
  ],
);

// Names staff attach to phone numbers in the texts inbox (takes priority
// over names derived from order records).
export const smsContacts = pgTable("sms_contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  phone: text("phone").notNull(), // E.164
  name: text("name").notNull(),
  // Mini-CRM conversation state for the Texts inbox: pin important threads,
  // park finished ones, and track what's been read (unread = an inbound
  // message newer than lastReadAt).
  starredAt: timestamp("starred_at", { withTimezone: true }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  lastReadAt: timestamp("last_read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("sms_contacts_phone_idx").on(t.phone)]);

// Every design-lab render, linked to the visitor who made it - powers the
// /admin/design-lab leads page (see what each lead was designing).
export const designLabRenders = pgTable("design_lab_renders", {
  id: uuid("id").primaryKey().defaultRandom(),
  visitorId: uuid("visitor_id").references(() => designLabVisitors.id),
  url: text("url").notNull(),
  note: text("note"), // sport | style | team | idea/refinement
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// One durable row per AI provider request. Cost is stored in millionths of a
// dollar so inexpensive image/text calls can be totaled without rounding.
// Some providers do not return enough billing detail for an honest estimate;
// those rows keep estimatedCostMicros null and still record model + token use.
export const aiUsageEvents = pgTable(
  "ai_usage_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    operation: text("operation").notNull(),
    quality: text("quality"),
    status: text("status").notNull().default("success"),
    estimatedCostMicros: integer("estimated_cost_micros"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    totalTokens: integer("total_tokens"),
    metadata: jsonb("metadata").$type<Record<string, string | number | boolean | null>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ai_usage_events_created_idx").on(t.createdAt),
    index("ai_usage_events_provider_idx").on(t.provider, t.model, t.createdAt),
  ],
);

// Atomic counters make the design-lab daily cap work across every serverless
// instance. The old module variable reset whenever Vercel started a new
// instance, so it was not a real spending limit.
export const aiDailyCounters = pgTable(
  "ai_daily_counters",
  {
    id: text("id").primaryKey(), // e.g. design-lab:2026-08-27
    scope: text("scope").notNull(),
    day: text("day").notNull(), // UTC YYYY-MM-DD (matches the previous cap)
    used: integer("used").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ai_daily_counters_scope_day_idx").on(t.scope, t.day)],
);

export const teamsRelations = relations(teams, ({ many }) => ({
  teamStoreProducts: many(teamStoreProducts),
}));

export const teamStoreProductsRelations = relations(teamStoreProducts, ({ one }) => ({
  team: one(teams, { fields: [teamStoreProducts.teamId], references: [teams.id] }),
  product: one(products, { fields: [teamStoreProducts.productId], references: [products.id] }),
}));

export const ordersRelations = relations(orders, ({ many, one }) => ({
  items: many(orderItems),
  drop: one(drops, { fields: [orders.dropId], references: [drops.id] }),
  team: one(teams, { fields: [orders.teamId], references: [teams.id] }),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
}));

export const teamOrdersRelations = relations(teamOrders, ({ many }) => ({
  roster: many(teamOrderRoster),
}));

export const teamOrderRosterRelations = relations(teamOrderRoster, ({ one }) => ({
  teamOrder: one(teamOrders, {
    fields: [teamOrderRoster.teamOrderId],
    references: [teamOrders.id],
  }),
}));

/* ------------------------------------------------------------------ */
/* Designer (print vendor) invoices — submit via private link, we pay */
/* ------------------------------------------------------------------ */

// The print vendor bills us AFTER an order is produced. He fills a private,
// no-login link that already lists the orders we're expecting to be billed for
// (with the piece counts we have on record), so his quantities can be checked
// against ours and his duty ("Tex") charge can be flagged when it drifts out of
// the normal range. On submit we ping the Discord invoice channel so someone
// pays it.
export const designerInvoices = pgTable(
  "designer_invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reference: text("reference").notNull(), // INV-XXXXXX
    // Per-invoice token for a shareable read-only link (/invoice/<token>).
    viewToken: text("view_token"),
    // Discord forum thread this invoice opened on submission, so the "PAID"
    // confirmation nests in the SAME thread instead of spawning a new one.
    discordThreadId: text("discord_thread_id"),

    status: designerInvoiceStatus("status").notNull().default("submitted"),

    // Who submitted (free text the designer types; we only have one vendor now
    // but this keeps the record honest if that changes).
    designerName: text("designer_name"),

    // One row per billed line. `teamOrderId`/`orderRef` are set when the line is
    // matched to one of our orders; `ourQty` snapshots the piece count we had on
    // record at submit time so a later roster edit can't hide a mismatch.
    lines: jsonb("lines")
      .$type<
        {
          team: string;
          garment: string;
          qty: number;
          unitCents: number;
          teamOrderId?: string;
          orderRef?: string;
          ourQty?: number;
          // Contract rate Slugger had on file when the invoice was submitted.
          // Stored with the line so later price-list edits cannot hide an
          // overcharge on an older invoice.
          ourUnitCents?: number;
          // Separates non-piece rush freight from produced garments. Shipping
          // remains order-linked for payment verification but never changes
          // billed garment counts or contract-rate reconciliation.
          chargeType?: "garment" | "rush_shipping";
          // If this order was already billed on an earlier (non-void) invoice,
          // the ref it was billed on. Guards against paying for it twice.
          alreadyBilledOn?: string;
        }[]
      >()
      .notNull()
      .default([]),

    // Sum of itemized lines (garments plus any linked rush shipping).
    subtotalCents: integer("subtotal_cents").notNull().default(0),
    dutyCents: integer("duty_cents").notNull().default(0), // the "Tex" line, as entered
    previousBalanceCents: integer("previous_balance_cents").notNull().default(0), // carryover
    totalCents: integer("total_cents").notNull().default(0), // what he's asking for

    notes: text("notes"),

    // The vendor's OWN invoice number (their external doc), if they have one.
    vendorRef: text("vendor_ref"),
    // The vendor's own uploaded invoice file(s) (PDF/image) on Vercel Blob.
    attachmentUrls: jsonb("attachment_urls").$type<string[]>().notNull().default([]),

    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    paidBy: text("paid_by"), // which of us marked it paid
    paymentNote: text("payment_note"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("designer_invoices_reference_idx").on(t.reference),
    index("designer_invoices_status_idx").on(t.status),
  ],
);
