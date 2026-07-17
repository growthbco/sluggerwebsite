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

/** Announce an invoice payment - into the design's thread when linked,
 *  otherwise the #team-orders channel. */
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
  const url =
    args.designThreadId && designUrl
      ? `${designUrl}?thread_id=${args.designThreadId}`
      : process.env.DISCORD_TEAM_ORDERS_WEBHOOK_URL;
  if (!url) return false;
  const amt = `$${(args.totalCents / 100).toFixed(2)}`;
  const isDeposit = args.stage === "deposit";
  return send(url, {
    username: "Slugger Team Orders",
    // Payments always ping - these gate production and shipping.
    content: isDeposit ? "@here 💰 Deposit paid - clear to start" : "@here 💰 Paid in full",
    allowed_mentions: { parse: ["everyone"] },
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
  rows: Array<{ label: string; size: string; name?: string; number?: string; quantity: number }>;
  designThreadId?: string | null;
}): Promise<boolean> {
  const designUrl = process.env.DISCORD_DESIGN_REQUESTS_WEBHOOK_URL;
  // Prefer the project's thread; fall back to the design channel, then the
  // team-orders channel so the ping isn't lost if design Discord isn't set.
  const url =
    args.designThreadId && designUrl
      ? `${designUrl}?thread_id=${args.designThreadId}`
      : designUrl || process.env.DISCORD_TEAM_ORDERS_WEBHOOK_URL;
  if (!url) {
    console.warn("No Discord webhook set - skipping add-on designer ping");
    return false;
  }
  const lines = args.rows
    .map((r) => {
      const who = [r.name?.trim(), r.number ? `#${r.number}` : null].filter(Boolean).join(" ") || "(no name)";
      const qty = Math.max(1, r.quantity ?? 1);
      return `• ${who} - ${r.label} (${r.size})${qty > 1 ? ` ×${qty}` : ""}`;
    })
    .join("\n");
  return send(url, {
    username: "Slugger Team Orders",
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

/** Post a team order's roster (no pricing). Linked orders land INSIDE the
 *  design's existing thread so a project's whole story lives in one place;
 *  standalone orders go to the #team-orders channel. */
export async function postTeamOrderToDiscord(
  order: TeamOrderPayload,
  opts: { designThreadId?: string | null } = {},
): Promise<boolean> {
  const designUrl = process.env.DISCORD_DESIGN_REQUESTS_WEBHOOK_URL;
  const useDesignThread = Boolean(opts.designThreadId && designUrl);
  const url = useDesignThread
    ? `${designUrl}?thread_id=${opts.designThreadId}`
    : process.env.DISCORD_TEAM_ORDERS_WEBHOOK_URL;
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

  // NOTE: customer contact (email/phone) is intentionally NOT posted here - this
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
    // Money moment: a submitted roster needs eyes, so actually ping the team.
    content: "@here 📋 New roster submitted",
    allowed_mentions: { parse: ["everyone"] },
    embeds: [{ title: `📋 ${order.teamName}`, color: GOLD, fields, timestamp: new Date().toISOString() }],
  };

  // Standalone orders in a Forum #team-orders channel get their own thread;
  // linked orders are already targeting the design thread via ?thread_id.
  if (!useDesignThread && process.env.DISCORD_TEAM_ORDERS_FORUM === "true") {
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
      value: req.rush ? `${needed} - within 2 weeks (rush fee applies)` : needed,
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
