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
