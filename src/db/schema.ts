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

// Design intake → proof → approval funnel; precedes the team order.
export const designRequestStatus = pgEnum("design_request_status", [
  "submitted", // client filled the intake form
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
    storeOpensAt: timestamp("store_opens_at", { withTimezone: true }),
    storeClosesAt: timestamp("store_closes_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("teams_slug_idx").on(t.slug)],
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
    totalCents: integer("total_cents").notNull().default(0),

    // Stripe linkage
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),

    // Set true once successfully pushed to Discord so retries don't double-post.
    discordNotifiedAt: timestamp("discord_notified_at", { withTimezone: true }),

    // Origin context (drop or team store) when applicable.
    dropId: uuid("drop_id").references(() => drops.id, { onDelete: "set null" }),
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),

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
    salesRep: text("sales_rep"),

    sport: text("sport"),
    jerseyStyle: text("jersey_style"), // crew / v-neck / full button / two button
    jerseyMaterial: text("jersey_material"), // birdseye mesh / pro smooth
    // Which item types this order covers, e.g. ["jersey","pants","socks"].
    items: jsonb("items").$type<string[]>().default(["jersey"]),
    rushShipping: boolean("rush_shipping").notNull().default(false),

    // Uploaded approved design + optional roster file.
    approvedDesignUrl: text("approved_design_url"),
    rosterFileUrl: text("roster_file_url"),
    specialInstructions: text("special_instructions"),

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

    quotedTotalCents: integer("quoted_total_cents"),

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
    quantity: integer("quantity").notNull().default(1),
    // How the row was created: "coach" or "self".
    filledBy: text("filled_by").notNull().default("coach"),
    position: integer("position").notNull().default(0),
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

    // The brief
    vision: text("vision"), // free-form description of desired look
    colors: text("colors"),
    notes: text("notes"),

    // When the customer needs the uniforms in hand. Anything < 14 days triggers
    // the rush flag and surfaces a $5/item rush fee to both customer + team.
    neededBy: timestamp("needed_by", { withTimezone: true }),
    rush: boolean("rush").notNull().default(false),

    // Revision tracking. We cap at MAX_REVISIONS (3) so clients can't loop forever.
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

    // Inspiration uploaded by the client (Vercel Blob URLs).
    inspirationImages: jsonb("inspiration_images").$type<string[]>().default([]),
    // Proof/mockup images uploaded by the designer.
    proofImages: jsonb("proof_images").$type<string[]>().default([]),
    // The single approved proof URL (selected on approval) — attached to the team order.
    approvedDesignUrl: text("approved_design_url"),

    // Tokens powering the public client + private staff links.
    statusToken: text("status_token"),
    manageToken: text("manage_token"),

    // Discord thread id of this request's forum post (captured on first send).
    // Used so change-request + approval follow-ups land in the SAME thread
    // instead of creating a new one per event.
    discordThreadId: text("discord_thread_id"),

    // Timestamps
    proofSentAt: timestamp("proof_sent_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    orderedAt: timestamp("ordered_at", { withTimezone: true }),
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
/* Relations                                                           */
/* ------------------------------------------------------------------ */

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
