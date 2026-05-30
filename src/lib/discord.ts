// Posts new orders to Discord via an incoming webhook (no bot to host).
// Used for paid Shop/Buy-In orders (#orders) and team orders (#team-orders).
import { itemLabel } from "@/lib/order-items";

const GOLD = 0xb8a36c;

type OrderLine = {
  name: string;
  description?: string;
  quantity: number;
  amountCents: number;
};

type OrderPayload = {
  reference: string;
  orderType: "Shop" | "Buy-In" | "Team Store";
  customerName?: string;
  customerEmail?: string;
  shipping?: string;
  lines: OrderLine[];
  totalCents: number;
  // When the #buy-in-orders channel is a Discord Forum, this becomes the post
  // title so each drop's orders group under their own thread.
  threadName?: string;
};

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

/** Post a paid order to the #orders channel. Returns true on success. */
export async function postOrderToDiscord(order: OrderPayload): Promise<boolean> {
  const url = process.env.DISCORD_ORDERS_WEBHOOK_URL;
  if (!url) {
    console.warn("DISCORD_ORDERS_WEBHOOK_URL not set - skipping Discord post");
    return false;
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
  if (order.shipping) fields.push({ name: "Ship to", value: order.shipping.slice(0, 1024), inline: false });

  // Put the drop name in the title so orders are scannable by drop even in a
  // single shared channel.
  const title = order.threadName ? `🧾 ${order.threadName}` : "🧾 New Order";

  const body: Record<string, unknown> = {
    username: "Slugger Orders",
    embeds: [
      {
        title,
        color: GOLD,
        fields,
        timestamp: new Date().toISOString(),
      },
    ],
  };

  // If the channel is a Forum, also route into a per-drop thread (its title).
  if (process.env.DISCORD_ORDERS_FORUM === "true" && order.threadName) {
    body.thread_name = order.threadName.slice(0, 100);
  }

  return send(url, body);
}

type RosterRow = {
  name?: string;
  number?: string;
  size?: string;
  // Per-item sizes, e.g. { jersey: "L", pants: "32", socks: "Adult S/M" }.
  sizes?: Record<string, string>;
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
};

/** Post a team order's roster (no pricing) to the #team-orders channel. */
export async function postTeamOrderToDiscord(order: TeamOrderPayload): Promise<boolean> {
  const url = process.env.DISCORD_TEAM_ORDERS_WEBHOOK_URL;
  if (!url) {
    console.warn("DISCORD_TEAM_ORDERS_WEBHOOK_URL not set - skipping team-order Discord post");
    return false;
  }

  const itemKeys = order.items?.length ? order.items : ["jersey"];

  // Production only needs: name / number / sizes per item (+ optional note). No prices.
  const rows = order.roster
    .filter((r) => r.name || r.number || r.size || (r.sizes && Object.keys(r.sizes).length))
    .map((r, i) => {
      const sizeStr = itemKeys
        .map((k) => {
          const v = r.sizes?.[k] ?? (k === "jersey" ? r.size : undefined);
          return v ? `${itemLabel(k)}: ${v}` : null;
        })
        .filter(Boolean)
        .join(" · ");
      const note = r.notes ? ` - ${r.notes}` : "";
      return `${i + 1}. **${r.name || "-"}** · #${r.number || "-"} · ${sizeStr || "-"}${note}`;
    })
    .join("\n");

  // NOTE: customer contact (email/phone) is intentionally NOT posted here — this
  // channel is designer/production-facing, and the business already has the
  // customer's contact from the initial inquiry. Keeps clients from being poached.
  const fields = [
    { name: "Order", value: `\`${order.reference}\``, inline: true },
    { name: "Style", value: order.jerseyStyle || "-", inline: true },
    { name: "Material", value: order.jerseyMaterial || "-", inline: true },
    { name: "Items", value: itemKeys.map(itemLabel).join(", "), inline: true },
    { name: "Players", value: String(order.roster.filter((r) => r.name || r.number || r.size || (r.sizes && Object.keys(r.sizes).length)).length), inline: true },
    { name: "Roster", value: rows.slice(0, 1024) || "-", inline: false },
  ];

  const body: Record<string, unknown> = {
    username: "Slugger Team Orders",
    embeds: [{ title: `📋 ${order.teamName}`, color: GOLD, fields, timestamp: new Date().toISOString() }],
  };

  // When #team-orders is a Forum channel, give each order its own thread so the
  // mockup → approval back-and-forth lives in one place.
  if (process.env.DISCORD_TEAM_ORDERS_FORUM === "true") {
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
  vision?: string;
  colors?: string;
  inspirationImages?: string[];
  manageUrl?: string;
  neededBy?: string | Date | null;
  rush?: boolean;
};

function fmtNeededBy(v: string | Date | null | undefined): string | null {
  if (!v) return null;
  const d = typeof v === "string" ? new Date(v) : v;
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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
  const needed = fmtNeededBy(req.neededBy ?? null);
  if (needed) {
    fields.push({
      name: req.rush ? "Needed by 🚨 RUSH" : "Needed by",
      value: req.rush ? `${needed} — within 2 weeks (rush fee applies)` : needed,
      inline: true,
    });
  }
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

  const body: Record<string, unknown> = {
    username: "Slugger Design Requests",
    embeds: [
      {
        title: `🎨 ${req.teamName}`,
        color: GOLD,
        fields,
        // First inspiration image as the embed image so it's visible at a glance.
        ...(req.inspirationImages?.[0] ? { image: { url: req.inspirationImages[0] } } : {}),
        timestamp: new Date().toISOString(),
      },
    ],
  };

  if (process.env.DISCORD_DESIGN_REQUESTS_FORUM === "true") {
    body.thread_name = `${req.teamName} (${req.reference})`.slice(0, 100);
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

async function send(url: string, body: unknown): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error("Discord webhook failed:", res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("Discord webhook error:", e);
    return false;
  }
}

/** Same as send() but uses ?wait=true so Discord returns the created Message,
 *  which lets us capture channel_id (= thread_id for forum posts). */
async function sendAndReturn(url: string, body: unknown): Promise<{ id?: string; channel_id?: string } | null> {
  try {
    const sep = url.includes("?") ? "&" : "?";
    const res = await fetch(`${url}${sep}wait=true`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error("Discord webhook failed:", res.status, await res.text());
      return null;
    }
    return (await res.json()) as { id?: string; channel_id?: string };
  } catch (e) {
    console.error("Discord webhook error:", e);
    return null;
  }
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
}): Promise<boolean> {
  const baseUrl = process.env.DISCORD_DESIGN_REQUESTS_WEBHOOK_URL;
  if (!baseUrl) return false;
  const url = opts.threadId ? `${baseUrl}?thread_id=${opts.threadId}` : baseUrl;
  const body: Record<string, unknown> = {
    username: opts.username ?? "Slugger Design Requests",
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
  // thread_name to post — only do this fallback if forum mode is on.
  if (!opts.threadId && process.env.DISCORD_DESIGN_REQUESTS_FORUM === "true") {
    body.thread_name = opts.title.slice(0, 100);
  }
  return send(url, body);
}
