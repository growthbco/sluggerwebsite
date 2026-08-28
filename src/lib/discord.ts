// Posts new orders to Discord via an incoming webhook (no bot to host).
// Used for paid Shop/Buy-In orders (#orders) and custom projects in the
// Design Requests forum.
import { itemLabel, notDesignerMade, sizeFieldsForItems, sizeValueForField } from "@/lib/order-items";

const GOLD = 0xb8a36c;

// Bonans (bonans_sports123) - our print vendor. Production-facing posts tag him
// directly instead of pinging the whole server with @here. Override via env.
const DESIGNER_USER_ID = process.env.DISCORD_DESIGNER_USER_ID || "1257751481700843531";

type OrderLine = {
  name: string;
  description?: string;
  quantity: number;
  amountCents: number;
};

type OrderPayload = {
  reference: string;
  orderType: "Shop" | "Buy-In" | "Team Store" | "Custom Invoice";
  customerName?: string;
  customerEmail?: string;
  shipping?: string;
  lines: OrderLine[];
  subtotalCents?: number;
  shippingCents?: number;
  totalCents: number;
  // When the #buy-in-orders channel is a Discord Forum, this becomes the post
  // title so each drop's orders group under their own thread.
  threadName?: string;
  // Team stores: post INTO this existing thread instead of creating a new one,
  // so all of a store's orders (and later add-ons) stay in one place.
  existingThreadId?: string | null;
};

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

/** Post a paid order to the #orders channel. Returns true on success. */
type StoreOrderPayload = {
  reference: string;
  teamName: string;
  approvedDesignUrl?: string | null;
  customerName?: string;
  customerEmail?: string;
  shipping?: string;
  /** Garment lines (tax line excluded by the caller). */
  items: { quantity: number; label: string }[];
  /** Public store link so the designer can reference the exact jersey design. */
  storeUrl?: string;
  /** Designer-only print-file QA link. */
  verifyUrl?: string;
  /** Persistent per-store thread in the design forum; create-once, reuse. */
  existingThreadId?: string | null;
  /** Optional note the buyer left at checkout. */
  note?: string;
  /** Name for the thread when creating one (per-customer: "Aaron - Team Store"). */
  threadName?: string;
};

/** Post a paid team-store order as an "add-on" into the store's own thread in
 *  the DESIGN-REQUESTS forum (where the designer works and threads exist).
 *  Creates the "🏪 <Team> Store" thread on the first order, then every later
 *  order (family add-ons) posts into that same thread. Returns the thread id
 *  so the caller can persist it. */
export async function postStoreOrderToDiscord(order: StoreOrderPayload): Promise<{ ok: boolean; threadId?: string }> {
  const url = process.env.DISCORD_DESIGN_REQUESTS_WEBHOOK_URL;
  if (!url) {
    console.warn("DISCORD_DESIGN_REQUESTS_WEBHOOK_URL not set - skipping store order post");
    return { ok: false };
  }
  const itemText = order.items.map((i) => `• ${i.quantity}× ${i.label}`).join("\n");
  // Designer-facing: what to make, not what we make on it. No prices/totals
  // (matches the design-request and add-on posts).
  const fields = [
    { name: "Status", value: "✅ **PAID** - ready to produce", inline: true },
    { name: "Order", value: `\`${order.reference}\` · add-on for ${order.customerName ?? "a player"}`, inline: true },
    { name: `Make (${order.items.length})`, value: (itemText || "-").slice(0, 1024), inline: false },
  ];
  if (order.note) fields.push({ name: "📝 Buyer note", value: order.note.slice(0, 1024), inline: false });
  if (order.storeUrl) fields.push({ name: "Team store (design reference)", value: order.storeUrl, inline: false });
  if (order.verifyUrl) fields.push({ name: "🔍 Print-file QA (before printing)", value: order.verifyUrl, inline: false });
  if (order.shipping) fields.push({ name: "Ship to", value: order.shipping.slice(0, 1024), inline: false });

  const embed: Record<string, unknown> = {
    title: `🏪 ${order.teamName} Team Store`,
    color: GOLD,
    fields,
    timestamp: new Date().toISOString(),
  };

  const body: Record<string, unknown> = {
    username: "Slugger Team Stores",
    content: "@here 🏪 New **Team Store** order (add-on) - PAID, ready to produce.",
    allowed_mentions: { parse: ["everyone"] },
    embeds: [embed],
  };

  // Reuse the store's thread when we have it; otherwise open it (and show the
  // approved design as the anchor image).
  if (order.existingThreadId) {
    const sep = url.includes("?") ? "&" : "?";
    const ok = await send(`${url}${sep}thread_id=${order.existingThreadId}`, body);
    return { ok, threadId: order.existingThreadId };
  }
  if (order.approvedDesignUrl) embed.image = { url: order.approvedDesignUrl };
  body.thread_name = (order.threadName ?? `🏪 ${order.teamName} Store`).slice(0, 100);
  const msg = await sendAndReturn(url, body);
  return { ok: Boolean(msg), threadId: msg?.channel_id };
}

export async function postOrderToDiscord(order: OrderPayload): Promise<{ ok: boolean; threadId?: string }> {
  const url = process.env.DISCORD_ORDERS_WEBHOOK_URL;
  if (!url) {
    console.warn("DISCORD_ORDERS_WEBHOOK_URL not set - skipping Discord post");
    return { ok: false };
  }

  const itemLines = order.lines
    .map((l) => `**${l.quantity}× ${l.name}** - ${money(l.amountCents)}${l.description ? `\n  ${l.description}` : ""}`)
    .join("\n");

  const fields = [
    { name: "Order", value: `\`${order.reference}\` · ${order.orderType}`, inline: true },
    { name: "Total", value: money(order.totalCents), inline: true },
    {
      name: "Customer",
      value: [order.customerName, order.customerEmail].filter(Boolean).join("\n") || "-",
      inline: false,
    },
    { name: "Items", value: itemLines.slice(0, 1024) || "-", inline: false },
  ];
  // Always surface shipping so a paid order's charges are unambiguous.
  if (typeof order.shippingCents === "number") {
    fields.push({
      name: "Shipping",
      value: order.shippingCents > 0 ? money(order.shippingCents) : "Free / local pickup",
      inline: true,
    });
  }
  if (order.shipping) fields.push({ name: "Ship to", value: order.shipping.slice(0, 1024), inline: false });

  // Put the drop name in the title so orders are scannable by drop even in a
  // single shared channel.
  const title = order.threadName ? `🧾 ${order.threadName}` : "🧾 New Order";

  const body: Record<string, unknown> = {
    username: "Slugger Orders",
    // Paid order = money moment: ping the team.
    content: "@here 🧾 New paid order",
    allowed_mentions: { parse: ["everyone"] },
    embeds: [
      {
        title,
        color: GOLD,
        fields,
        timestamp: new Date().toISOString(),
      },
    ],
  };

  // Team stores: post into the store's existing thread when we have one, so
  // every order for that store (and future add-ons) lands in one place.
  if (order.existingThreadId) {
    const sep = url.includes("?") ? "&" : "?";
    const ok = await send(`${url}${sep}thread_id=${order.existingThreadId}`, body);
    return { ok, threadId: order.existingThreadId };
  }

  // Otherwise, on a Forum channel, open a new thread and capture its id so the
  // caller can persist it (team stores) and reuse it next time.
  if (process.env.DISCORD_ORDERS_FORUM === "true" && order.threadName) {
    body.thread_name = order.threadName.slice(0, 100);
    const msg = await sendAndReturn(url, body);
    return { ok: Boolean(msg), threadId: msg?.channel_id };
  }

  const ok = await send(url, body);
  return { ok };
}

type RosterRow = {
  name?: string;
  number?: string;
  size?: string;
  // Per-item sizes, e.g. { jersey: "L", pants: "32", socks: "Adult S/M" }.
  sizes?: Record<string, string>;
  // Which approved design this row gets, when a team has more than one
  // (e.g. "Pin Daddy" / "Pin Mommy"). Rendered up-front so production ties the
  // right artwork to the right size without hunting through notes.
  design?: string;
  notes?: string;
};

type TeamOrderPayload = {
  reference: string;
  teamName: string;
  contactName: string;
  contactEmail?: string;
  contactPhone?: string;
  jerseyStyle?: string;
  jerseyMaterial?: string;
  items?: string[];
  roster: RosterRow[];
  /** Direct link to open this order (design-manage page). */
  manageUrl?: string;
  /** Approved mockup graphic(s) for this order, so the designer sees WHAT to
   *  produce right on the roster post - not just when a customer approved via
   *  their own link. Up to a few are shown. */
  designImages?: string[];
  /** Paid white-label order: production must OMIT the SA back-logo + neck label. */
  whiteLabel?: boolean;
};

/** Announce a custom-order payment in its Design Requests forum thread. */
export async function postTeamOrderPaidToDiscord(args: {
  reference: string;
  teamName: string;
  totalCents: number;
  stage?: "deposit" | "balance";
  designThreadId?: string | null;
  /** Extra lines appended under the amount (itemized add-on breakdown, etc.). */
  details?: string;
}): Promise<boolean> {
  const designUrl = process.env.DISCORD_DESIGN_REQUESTS_WEBHOOK_URL;
  // Prefer the order's persistent project thread. A missing id opens a new
  // Design Requests post as a final safety net; callers normally resolve and
  // persist the thread before reaching this function.
  let url: string | undefined;
  let threadName: string | undefined;
  if (args.designThreadId && designUrl) {
    url = `${designUrl}?thread_id=${args.designThreadId}`;
  } else if (designUrl) {
    url = designUrl;
    if (process.env.DISCORD_DESIGN_REQUESTS_FORUM === "true") threadName = `${args.teamName} (${args.reference})`;
  }
  if (!url) return false;
  const amt = `$${(args.totalCents / 100).toFixed(2)}`;
  const isDeposit = args.stage === "deposit";
  return send(url, {
    username: "Slugger Custom Orders",
    // Payments always ping - these gate production and shipping.
    content: isDeposit ? "@here 💰 Deposit paid - clear to start" : "@here 💰 Paid in full",
    allowed_mentions: { parse: ["everyone"] },
    ...(threadName ? { thread_name: threadName } : {}),
    embeds: [
      {
        title: isDeposit
          ? `💰 50% DEPOSIT PAID - ${args.teamName} (${args.reference})`
          : `💰 PAID IN FULL - ${args.teamName} (${args.reference})`,
        description:
          (isDeposit
            ? `Deposit received: **${amt}**. Clear to START production.`
            : `Balance received: **${amt}**. Clear to ship when ready.`) +
          (args.details ? `\n\n${args.details}` : ""),
        color: GOLD,
        timestamp: new Date().toISOString(),
      },
    ],
  });
}

/** Tell the designer to add paid add-on pieces to the print file. Posts into
 *  the project's existing design thread when there is one (keeps the story in
 *  one place); otherwise the #design-requests channel. Production-facing:
 *  names / numbers / sizes, no pricing. */
export async function postAddonToDesignerDiscord(args: {
  reference: string;
  teamName: string;
  rows: Array<{ key?: string; label: string; size: string; name?: string; number?: string; quantity: number }>;
  designThreadId?: string | null;
}): Promise<boolean> {
  // In-house pieces (hats) are the shop's work, not the designer's - drop
  // them, and skip the ping entirely if that's all the add-on contained.
  const printRows = args.rows.filter((r) => !r.key || !notDesignerMade(r.key));
  if (printRows.length === 0) return true;
  const designUrl = process.env.DISCORD_DESIGN_REQUESTS_WEBHOOK_URL;
  // Prefer the project's thread; otherwise create a Design Requests post.
  const url =
    args.designThreadId && designUrl
      ? `${designUrl}?thread_id=${args.designThreadId}`
      : designUrl;
  if (!url) {
    console.warn("No Discord webhook set - skipping add-on designer ping");
    return false;
  }
  const lines = printRows
    .map((r) => {
      const who = [r.name?.trim(), r.number ? `#${r.number}` : null].filter(Boolean).join(" ") || "(no name)";
      const qty = Math.max(1, r.quantity ?? 1);
      return `• ${who} - ${r.label} (${r.size})${qty > 1 ? ` ×${qty}` : ""}`;
    })
    .join("\n");
  return send(url, {
    username: "Slugger Custom Orders",
    ...(!args.designThreadId && process.env.DISCORD_DESIGN_REQUESTS_FORUM === "true"
      ? { thread_name: `${args.teamName} (${args.reference})`.slice(0, 100) }
      : {}),
    content: "@here ➕ Add-on to add to the print file",
    allowed_mentions: { parse: ["everyone"] },
    embeds: [
      {
        title: `➕ ADD TO PRINT FILE - ${args.teamName} (${args.reference})`,
        description: `A paid add-on came in for an existing order. Please add these pieces to the print file:\n\n${lines}\n\n⚠️ Print-file QA has been reset for this order. Upload the updated print file and re-run the AI check before printing - even if the original file was already verified and approved.`,
        color: GOLD,
        timestamp: new Date().toISOString(),
      },
    ],
  });
}

/** Post a team order's roster (no pricing) in the Design Requests forum.
 *  Linked orders reuse the design thread; standalone/manual orders receive
 *  their own persistent thread there. */
export async function postTeamOrderToDiscord(
  order: TeamOrderPayload,
  opts: { designThreadId?: string | null } = {},
): Promise<boolean> {
  const designUrl = process.env.DISCORD_DESIGN_REQUESTS_WEBHOOK_URL;
  const useDesignThread = Boolean(opts.designThreadId && designUrl);
  const url = useDesignThread ? `${designUrl}?thread_id=${opts.designThreadId}` : designUrl;
  if (!url) {
    console.warn("DISCORD_DESIGN_REQUESTS_WEBHOOK_URL not set - skipping team-order post");
    return false;
  }

  // In-house items (hats) are embroidered at the shop, not by the factory -
  // the designer never needs to see them, so they're filtered out of this
  // production-facing post entirely.
  const itemKeys = (order.items?.length ? order.items : ["jersey"]).filter((k) => !notDesignerMade(k));

  // Production only needs: name / number / sizes per item (+ optional note). No prices.
  const rows = order.roster
    .filter((r) => r.name || r.number || r.size || (r.sizes && Object.keys(r.sizes).length))
    .map((r, i) => {
      const sizeStr = sizeFieldsForItems(itemKeys)
        .map((field) => {
          const v = sizeValueForField(field, r.sizes, r.size);
          return v ? `${field.label}: ${v}` : null;
        })
        .filter(Boolean)
        .join(" · ");
      const note = r.notes ? ` - ${r.notes}` : "";
      const designTag = r.design ? `**${r.design}** · ` : "";
      return `${i + 1}. ${designTag}${r.name || "-"} · #${r.number || "-"} · ${sizeStr || "-"}${note}`;
    })
    .join("\n");

  // NOTE: customer contact (email/phone) is intentionally NOT posted here - this
  // channel is designer/production-facing, and the business already has the
  // customer's contact from the initial inquiry. Keeps clients from being poached.
  const fields = [
    { name: "Order", value: `\`${order.reference}\``, inline: true },
    { name: "Style", value: order.jerseyStyle || "-", inline: true },
    { name: "Material", value: order.jerseyMaterial || "-", inline: true },
    { name: "Items", value: itemKeys.map(itemLabel).join(", ") || "-", inline: true },
    { name: "Players", value: String(order.roster.filter((r) => r.name || r.number || r.size || (r.sizes && Object.keys(r.sizes).length)).length), inline: true },
  ];
  if (order.whiteLabel) {
    fields.push({ name: "⚠️ WHITE-LABEL", value: "Remove the SA back-logo and the Slugger Athletics neck label - this order ships unbranded.", inline: false });
  }
  fields.push({ name: "Roster", value: rows.slice(0, 1024) || "-", inline: false });
  if (order.manageUrl) fields.push({ name: "🔗 Open order", value: order.manageUrl, inline: false });

  // Attach the approved mockup(s) so the designer builds from the right art.
  // Discord shows one image per embed, so extra graphics become image-only
  // embeds stacked under the roster.
  const imgs = (order.designImages ?? []).filter(Boolean).slice(0, 4);
  const embeds: Record<string, unknown>[] = [
    {
      title: `📋 ${order.teamName}`,
      color: GOLD,
      fields,
      timestamp: new Date().toISOString(),
      ...(imgs[0] ? { image: { url: imgs[0] } } : {}),
    },
    ...imgs.slice(1).map((url) => ({ color: GOLD, image: { url } })),
  ];

  const body: Record<string, unknown> = {
    username: "Slugger Custom Orders",
    // A submitted roster is production work - tag Bonans directly, not @here.
    content: `<@${DESIGNER_USER_ID}> 📋 New roster submitted`,
    allowed_mentions: { parse: [], users: [DESIGNER_USER_ID] },
    embeds,
  };

  // Safety net for legacy callers that did not resolve an order thread first.
  if (!useDesignThread && process.env.DISCORD_DESIGN_REQUESTS_FORUM === "true") {
    body.thread_name = `${order.teamName} (${order.reference})`.slice(0, 100);
  }

  return send(url, body);
}

type DesignRequestPayload = {
  reference: string;
  teamName: string;
  sport?: string;
  // Contact fields kept on the type so callers don't have to change, but they
  // are intentionally NOT rendered in the Discord embed (designer-facing).
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  /** What the customer wants mocked up, e.g. "Jersey (Two-button), Shorts, Hat". */
  products?: string;
  vision?: string;
  colors?: string;
  inspirationImages?: string[];
  manageUrl?: string;
  neededBy?: string | Date | null;
  rush?: boolean;
  /** Approximate piece count from the intake ("3-9", "25+", ...). */
  estimatedPieces?: string | null;
  /** First-touch attribution ("Google", "Instagram", "Direct", ...). */
  source?: string | null;
};

function fmtNeededBy(v: string | Date | null | undefined): string | null {
  if (!v) return null;
  const d = typeof v === "string" ? new Date(v) : v;
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" });
}

/** Post a new design intake to the #design-requests channel.
 *  Includes contact + inspiration image links so the designer can start work.
 *  Each request gets its own thread (when the channel is a Forum) for the
 *  mockup -> approval back-and-forth.
 *  Returns the Discord thread id (for forum posts) so callers can persist it
 *  and route follow-ups (change requests, approvals) into the same thread. */
export async function postDesignRequestToDiscord(req: DesignRequestPayload): Promise<{ ok: boolean; threadId?: string }> {
  const url = process.env.DISCORD_DESIGN_REQUESTS_WEBHOOK_URL;
  if (!url) {
    console.warn("DISCORD_DESIGN_REQUESTS_WEBHOOK_URL not set - skipping design Discord post");
    return { ok: false };
  }

  // Designer-facing channel: customer contact (name/email/phone) is intentionally
  // omitted. The business has the contact via the email notification + DB.
  const fields = [
    { name: "Request", value: `\`${req.reference}\``, inline: true },
    { name: "Sport", value: req.sport || "-", inline: true },
  ];
  if (req.source) fields.push({ name: "Source", value: req.source.slice(0, 256), inline: true });
  if (req.estimatedPieces) {
    // Tiny requests get a warning glyph - a full custom design for 1-2 pieces
    // usually isn't worth the work, so staff should weigh in before designing.
    const tiny = /^1-5/.test(req.estimatedPieces);
    fields.push({ name: "Approx. pieces", value: `${tiny ? "⚠️ " : ""}${req.estimatedPieces}`, inline: true });
  }
  const needed = fmtNeededBy(req.neededBy ?? null);
  if (needed) {
    fields.push({
      name: req.rush ? "Needed by 🚨 RUSH" : "Needed by",
      value: req.rush ? `${needed} - within 2 weeks (flat $100 rush fee; confirm timeline)` : needed,
      inline: true,
    });
  }
  if (req.products) fields.push({ name: "🎨 Mock up", value: req.products.slice(0, 1024), inline: false });
  if (req.colors) fields.push({ name: "Colors", value: req.colors.slice(0, 200), inline: false });
  if (req.vision) fields.push({ name: "Vision", value: req.vision.slice(0, 1024), inline: false });
  if (req.inspirationImages?.length) {
    fields.push({
      name: "Inspiration",
      value: req.inspirationImages.map((u, i) => `[Image ${i + 1}](${u})`).join(" · ").slice(0, 1024),
      inline: false,
    });
  }
  if (req.manageUrl) fields.push({ name: "Manage", value: req.manageUrl, inline: false });

  const RED = 0xe74c3c;
  const body: Record<string, unknown> = {
    username: "Slugger Design Requests",
    // Rush requests get an unmissable @here banner above the embed: staff must
    // confirm the timeline and final rush fee before design starts.
    ...(req.rush
      ? {
          content: `@here # 🚨🚨 RUSH ORDER 🚨🚨\n**Needed by ${fmtNeededBy(req.neededBy ?? null) ?? "ASAP"}. Rush is a flat $100 fee and ships direct. DO NOT promise the date until staff approves it on the manage page.**`,
          allowed_mentions: { parse: ["everyone"] },
        }
      : {}),
    embeds: [
      {
        title: req.rush ? `🚨 RUSH - ${req.teamName}` : `🎨 ${req.teamName}`,
        color: req.rush ? RED : GOLD,
        fields,
        // First inspiration image as the embed image so it's visible at a glance.
        ...(req.inspirationImages?.[0] ? { image: { url: req.inspirationImages[0] } } : {}),
        timestamp: new Date().toISOString(),
      },
    ],
  };

  if (process.env.DISCORD_DESIGN_REQUESTS_FORUM === "true") {
    body.thread_name = `${req.rush ? "🚨 RUSH - " : ""}${req.teamName} (${req.reference})`.slice(0, 100);
  }

  // Use wait=true so Discord returns the created Message; for forum posts the
  // channel_id is the new thread's id, which we persist for future follow-ups.
  const msg = await sendAndReturn(url, body);
  if (!msg) return { ok: false };
  return { ok: true, threadId: msg.channel_id };
}

type ContactPayload = {
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
};

/** Post a contact-form message to the #contact channel. Returns true on success. */
export async function postContactToDiscord(msg: ContactPayload): Promise<boolean> {
  const url = process.env.DISCORD_CONTACT_WEBHOOK_URL;
  if (!url) {
    console.warn("DISCORD_CONTACT_WEBHOOK_URL not set - skipping contact Discord post");
    return false;
  }

  const fields = [
    { name: "From", value: msg.name || "-", inline: true },
    { name: "Email", value: msg.email || "-", inline: true },
    { name: "Phone", value: msg.phone || "-", inline: true },
    { name: "Subject", value: msg.subject || "General", inline: false },
    { name: "Message", value: msg.message.slice(0, 1024) || "-", inline: false },
  ];

  const body = {
    username: "Slugger Contact",
    embeds: [{ title: "✉️ New Contact Message", color: GOLD, fields, timestamp: new Date().toISOString() }],
  };

  return send(url, body);
}

/** Ping the invoice channel when the print vendor submits an invoice, so
 *  someone can pay it. Flags (duty out of band / quantity mismatch) are called
 *  out right in the embed so problems are visible before anyone pays. */
export async function postInvoiceToDiscord(inv: {
  reference: string;
  designerName?: string | null;
  subtotalCents: number;
  dutyCents: number;
  previousBalanceCents: number;
  totalCents: number;
  dutyBps: number;
  dutyFlag: boolean;
  anyQtyMismatch: boolean;
  anyDoubleBill: boolean;
  lineCount: number;
  adminUrl: string;
}): Promise<{ ok: boolean; threadId?: string }> {
  // Prefer a dedicated invoice channel; fall back to the paid-orders channel.
  // Track whether the chosen channel is a Forum, because forum webhooks 400
  // unless the post carries a thread_name.
  let url: string | undefined;
  let isForum = false;
  if (process.env.DISCORD_INVOICES_WEBHOOK_URL) {
    url = process.env.DISCORD_INVOICES_WEBHOOK_URL;
    isForum = process.env.DISCORD_INVOICES_FORUM === "true";
  } else if (process.env.DISCORD_ORDERS_WEBHOOK_URL) {
    url = process.env.DISCORD_ORDERS_WEBHOOK_URL;
    isForum = process.env.DISCORD_ORDERS_FORUM === "true";
  }
  if (!url) {
    console.warn("No invoice/orders webhook set - skipping invoice Discord post");
    return { ok: false };
  }

  const money = (c: number) => `$${(c / 100).toFixed(2)}`;
  const flags: string[] = [];
  if (inv.anyDoubleBill) flags.push("🛑 An order here was already billed on a prior invoice — do not pay twice");
  if (inv.dutyFlag) flags.push(`⚠️ Duty ${(inv.dutyBps / 100).toFixed(1)}% is outside the normal 15-19% range`);
  if (inv.anyQtyMismatch) flags.push("⚠️ A quantity does not match our records");

  const fields = [
    { name: "Goods", value: money(inv.subtotalCents), inline: true },
    {
      name: "Duty",
      value: `${money(inv.dutyCents)} (${(inv.dutyBps / 100).toFixed(1)}%)`,
      inline: true,
    },
    ...(inv.previousBalanceCents > 0
      ? [{ name: "Prev. balance", value: money(inv.previousBalanceCents), inline: true }]
      : []),
    { name: "Total to pay", value: `**${money(inv.totalCents)}**`, inline: false },
    { name: "Review + pay", value: inv.adminUrl, inline: false },
  ];
  if (flags.length) fields.unshift({ name: "Needs a look", value: flags.join("\n"), inline: false });

  const body: Record<string, unknown> = {
    username: "Slugger Invoices",
    // Forum channels require a thread_name to open the post; text channels
    // ignore it. Including it always keeps both kinds happy.
    ...(isForum ? { thread_name: `Invoice ${inv.reference}` } : {}),
    embeds: [
      {
        title: `🧾 New designer invoice ${inv.reference}`,
        description: `${inv.lineCount} line${inv.lineCount === 1 ? "" : "s"}${
          inv.designerName ? ` from ${inv.designerName}` : ""
        }`,
        color: flags.length ? 0xe74c3c : GOLD,
        fields,
        timestamp: new Date().toISOString(),
      },
    ],
  };

  // On a forum, capture the created thread id so the PAID confirmation can
  // nest in THIS same thread later instead of opening a new one.
  if (isForum) {
    const msg = await sendAndReturn(url, body);
    return { ok: Boolean(msg), threadId: msg?.channel_id };
  }
  return { ok: await send(url, body) };
}

/** Post a "PAID" confirmation to the invoice channel when a designer invoice is
 *  marked paid (via Wise or manually), so the record reflects payment. */
export async function postInvoicePaidToDiscord(inv: {
  reference: string;
  totalCents: number;
  method: string;
  detail?: string;
  threadId?: string | null; // the invoice's submission thread - nest the PAID note here
}): Promise<boolean> {
  let baseUrl: string | undefined;
  let isForum = false;
  if (process.env.DISCORD_INVOICES_WEBHOOK_URL) {
    baseUrl = process.env.DISCORD_INVOICES_WEBHOOK_URL;
    isForum = process.env.DISCORD_INVOICES_FORUM === "true";
  } else if (process.env.DISCORD_ORDERS_WEBHOOK_URL) {
    baseUrl = process.env.DISCORD_ORDERS_WEBHOOK_URL;
    isForum = process.env.DISCORD_ORDERS_FORUM === "true";
  }
  if (!baseUrl) return false;
  const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;
  // If we know the invoice's thread, post the PAID note INTO it. Otherwise, on
  // a forum, open a new thread (thread_name); on a text channel, just post.
  const url = inv.threadId ? `${baseUrl}?thread_id=${inv.threadId}` : baseUrl;
  const body: Record<string, unknown> = {
    username: "Slugger Invoices",
    ...(!inv.threadId && isForum ? { thread_name: `Invoice ${inv.reference} - PAID` } : {}),
    embeds: [
      {
        title: `💸 Invoice ${inv.reference} - PAID`,
        description: `${fmt(inv.totalCents)} paid ${inv.method}${inv.detail ? ` - ${inv.detail}` : ""}.`,
        color: 0x2ecc71,
        timestamp: new Date().toISOString(),
      },
    ],
  };
  return send(url, body);
}

const DISCORD_MAX_ATTEMPTS = 3;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** POST to a Discord webhook with retries on the transient failures that made
 *  proof notifications vanish before: 429 rate limits (honoring Retry-After)
 *  and 5xx / network errors (exponential backoff). Returns the parsed response
 *  (for ?wait=true posts) on success, or null after exhausting retries. A hard
 *  4xx (bad request) isn't retried - it won't succeed on a repeat. */
async function postWebhook(url: string, body: unknown): Promise<{ ok: boolean; data?: { id?: string; channel_id?: string } }> {
  for (let attempt = 1; attempt <= DISCORD_MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        // Only ?wait=true responses have a JSON body worth parsing.
        let data: { id?: string; channel_id?: string } | undefined;
        try {
          data = url.includes("wait=true") ? ((await res.json()) as typeof data) : undefined;
        } catch {}
        return { ok: true, data };
      }
      const retriable = res.status === 429 || res.status >= 500;
      const text = await res.text().catch(() => "");
      if (retriable && attempt < DISCORD_MAX_ATTEMPTS) {
        const retryAfter = Number(res.headers.get("retry-after"));
        const waitMs = retryAfter > 0 ? retryAfter * 1000 : attempt * 600;
        console.warn(`Discord webhook ${res.status} (attempt ${attempt}) - retrying in ${waitMs}ms`);
        await sleep(waitMs);
        continue;
      }
      console.error("Discord webhook failed:", res.status, text.slice(0, 300));
      return { ok: false };
    } catch (e) {
      console.error(`Discord webhook error (attempt ${attempt}):`, e);
      if (attempt < DISCORD_MAX_ATTEMPTS) {
        await sleep(attempt * 600);
        continue;
      }
      return { ok: false };
    }
  }
  return { ok: false };
}

/** Email a fallback alert to staff when a Discord notification can't be posted
 *  after retries, so nothing goes silently missing. Best-effort; email is an
 *  independent channel from Discord. */
async function alertDiscordFailure(body: unknown): Promise<void> {
  try {
    const embed = (body as { embeds?: Array<{ title?: string; description?: string }> })?.embeds?.[0] ?? {};
    const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!));
    const { sendEmail, CONTACT_INBOX } = await import("@/lib/email");
    await sendEmail({
      to: process.env.ALERT_EMAIL || CONTACT_INBOX,
      subject: "⚠️ A Discord notification failed to post",
      html: `
        <p>A Discord notification could not be posted after ${DISCORD_MAX_ATTEMPTS} attempts, so it may be missing from the channel.</p>
        <p><strong>${esc(embed.title ?? "Notification")}</strong></p>
        ${embed.description ? `<p>${esc(embed.description)}</p>` : ""}
        <p style="color:#666;font-size:13px;">Please post it manually in Discord or check the webhook configuration.</p>
      `,
    });
  } catch (e) {
    console.error("Discord failure alert email also failed:", e);
  }
}

async function send(url: string, body: unknown): Promise<boolean> {
  const { ok } = await postWebhook(url, body);
  if (!ok) await alertDiscordFailure(body);
  return ok;
}

/** Same as send() but uses ?wait=true so Discord returns the created Message,
 *  which lets us capture channel_id (= thread_id for forum posts). */
async function sendAndReturn(url: string, body: unknown): Promise<{ id?: string; channel_id?: string } | null> {
  const sep = url.includes("?") ? "&" : "?";
  const { ok, data } = await postWebhook(`${url}${sep}wait=true`, body);
  if (!ok) {
    await alertDiscordFailure(body);
    return null;
  }
  return data ?? {};
}

/** Post a follow-up update INTO the existing thread for a design request
 *  (when the design channel is a Forum). Used for change-requests + approvals
 *  so the back-and-forth lives in one place. Falls back to a new post if
 *  threadId isn't known. */
export async function postDesignThreadUpdate(opts: {
  threadId?: string | null;
  title: string;
  description?: string;
  fields?: { name: string; value: string; inline?: boolean }[];
  imageUrl?: string;
  username?: string;
  mention?: boolean; // @here ping for time-sensitive items
}): Promise<boolean> {
  const baseUrl = process.env.DISCORD_DESIGN_REQUESTS_WEBHOOK_URL;
  if (!baseUrl) return false;
  const url = opts.threadId ? `${baseUrl}?thread_id=${opts.threadId}` : baseUrl;
  const body: Record<string, unknown> = {
    username: opts.username ?? "Slugger Design Requests",
    ...(opts.mention ? { content: "@here", allowed_mentions: { parse: ["everyone"] } } : {}),
    embeds: [
      {
        title: opts.title,
        ...(opts.description ? { description: opts.description } : {}),
        color: GOLD,
        ...(opts.fields?.length ? { fields: opts.fields } : {}),
        ...(opts.imageUrl ? { image: { url: opts.imageUrl } } : {}),
        timestamp: new Date().toISOString(),
      },
    ],
  };
  // If we don't have a thread_id and the channel is a Forum, we'd need a
  // thread_name to post - only do this fallback if forum mode is on.
  if (!opts.threadId && process.env.DISCORD_DESIGN_REQUESTS_FORUM === "true") {
    body.thread_name = opts.title.slice(0, 100);
  }
  return send(url, body);
}

/** Open ONE home thread for a design request in #design-requests and return its
 *  thread id (so it can be persisted). Used when a request is created outside
 *  the normal intake (e.g. converting a lab lead) so every later event
 *  (proof / changes / client reply) nests in one thread instead of spawning a
 *  new post each time. Quiet: no @here, no designer ping. */
export async function createDesignThread(args: { title: string; description?: string }): Promise<string | null> {
  const baseUrl = process.env.DISCORD_DESIGN_REQUESTS_WEBHOOK_URL;
  if (!baseUrl) return null;
  const body: Record<string, unknown> = {
    username: "Slugger Design Requests",
    embeds: [
      {
        title: args.title,
        ...(args.description ? { description: args.description } : {}),
        color: GOLD,
        timestamp: new Date().toISOString(),
      },
    ],
  };
  if (process.env.DISCORD_DESIGN_REQUESTS_FORUM === "true") body.thread_name = args.title.slice(0, 100);
  const msg = await sendAndReturn(baseUrl, body);
  return msg?.channel_id ?? null;
}
