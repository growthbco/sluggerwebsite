// Sends transactional email via Brevo (https://brevo.com).
// Used for contact-form submissions, design-request confirmations, and
// designer notifications. The higher-level helpers below stay provider-agnostic.

export const emailEnabled = () => Boolean(process.env.BREVO_API_KEY);

// Where customer-facing form submissions are delivered.
export const CONTACT_INBOX = process.env.CONTACT_TO_EMAIL || "apparel@sluggerathletics.com";

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
};

// Parse "Name <email@x.com>" or just "email@x.com" into Brevo's sender object.
function parseFrom(raw: string): { name?: string; email: string } {
  const m = raw.match(/^\s*(.+?)\s*<\s*([^>]+)\s*>\s*$/);
  if (m) return { name: m[1].trim(), email: m[2].trim() };
  return { email: raw.trim() };
}

export async function sendEmail({ to, subject, html, replyTo }: SendArgs): Promise<boolean> {
  const key = process.env.BREVO_API_KEY;
  if (!key) {
    console.warn("BREVO_API_KEY not set - skipping email send");
    return false;
  }
  // Sender must be a verified sender / domain in your Brevo account.
  const sender = parseFrom(process.env.EMAIL_FROM || "Slugger Athletics <noreply@sluggerathletics.com>");

  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": key,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender,
        to: [{ email: to }],
        subject,
        htmlContent: html,
        ...(replyTo ? { replyTo: { email: replyTo } } : {}),
      }),
    });
    if (!res.ok) {
      console.error("Brevo email failed:", res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("Email send error:", e);
    return false;
  }
}

import { brandedEmail } from "@/lib/email-template";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Email the designer/business that a new design request came in. */
export async function emailDesignRequestToDesigner(req: {
  reference: string;
  teamName: string;
  sport?: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  products?: string;
  vision?: string;
  colors?: string;
  inspirationImages?: string[];
  manageUrl?: string;
  neededBy?: string | Date | null;
  rush?: boolean;
}): Promise<boolean> {
  const imgs = (req.inspirationImages ?? [])
    .map((u, i) => `<li><a href="${esc(u)}">Inspiration ${i + 1}</a></li>`)
    .join("");
  let neededByStr: string | null = null;
  if (req.neededBy) {
    const d = typeof req.neededBy === "string" ? new Date(req.neededBy) : req.neededBy;
    if (!isNaN(d.getTime())) neededByStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  const subjectPrefix = req.rush ? "🚨 RUSH " : "";
  const bodyHtml = `
    ${req.rush ? `<p style="background:#fff3cd;padding:10px 14px;border-left:4px solid #b8a36c;margin:0 0 16px;"><strong style="color:#13160b;">🚨 RUSH request:</strong> needed within 2 weeks. A $5/item rush fee applies.</p>` : ""}
    <p style="margin:0 0 10px;"><strong>Team:</strong> ${esc(req.teamName)} ${req.sport ? `(${esc(req.sport)})` : ""}</p>
    ${neededByStr ? `<p style="margin:0 0 10px;"><strong>Needed by:</strong> ${neededByStr}</p>` : ""}
    <p style="margin:0 0 10px;"><strong>Contact:</strong> ${esc(req.contactName)} · ${esc(req.contactEmail)}${req.contactPhone ? ` · ${esc(req.contactPhone)}` : ""}</p>
    ${req.products ? `<p style="margin:0 0 10px;"><strong>🎨 Mock up:</strong> ${esc(req.products)}</p>` : ""}
    ${req.colors ? `<p style="margin:0 0 10px;"><strong>Colors:</strong> ${esc(req.colors)}</p>` : ""}
    ${req.vision ? `<p style="margin:14px 0 6px;"><strong>Vision:</strong></p><p style="margin:0;">${esc(req.vision).replace(/\n/g, "<br>")}</p>` : ""}
    ${imgs ? `<p style="margin:14px 0 6px;"><strong>Inspiration:</strong></p><ul style="margin:0;padding-left:18px;">${imgs}</ul>` : ""}
  `;
  return sendEmail({
    to: CONTACT_INBOX,
    subject: `${subjectPrefix}New design request: ${req.teamName} - ${req.reference}`,
    html: brandedEmail({
      preheader: `${req.teamName} - ${req.reference}`,
      heading: `${req.rush ? "🚨 RUSH · " : ""}New design request`,
      intro: `Reference: <strong>${esc(req.reference)}</strong>`,
      bodyHtml,
      ctaText: req.manageUrl ? "Open manage view" : undefined,
      ctaUrl: req.manageUrl,
    }),
    replyTo: req.contactEmail,
  });
}

/** Email the client a confirmation with their status link. */
export async function emailDesignRequestConfirmation(args: {
  to: string;
  teamName: string;
  reference: string;
  statusUrl: string;
}): Promise<boolean> {
  return sendEmail({
    to: args.to,
    subject: `Your Slugger Athletics design request (${args.reference})`,
    html: brandedEmail({
      preheader: `We're on it - reference ${args.reference}`,
      heading: `We got it, ${esc(args.teamName)}!`,
      intro: `Reference: <strong>${esc(args.reference)}</strong>`,
      bodyHtml: `
        <p style="margin:0 0 12px;">Our in-house designer is starting work on your <strong>free mockup</strong>. We'll send you another email the moment it's ready to review.</p>
        <p style="margin:0;">Bookmark your tracking link below so you can check in anytime - it's also where you'll approve the design when it's ready.</p>
      `,
      ctaText: "Track your design",
      ctaUrl: args.statusUrl,
      footerNote: "Free design proofs · 2-3 week standard turnaround · 1-week rush available",
    }),
  });
}

/** Email the client that a proof is ready to review. */
export async function emailProofReady(args: {
  to: string;
  teamName: string;
  reference: string;
  statusUrl: string;
}): Promise<boolean> {
  return sendEmail({
    to: args.to,
    subject: `🎨 Your Slugger Athletics proof is ready (${args.reference})`,
    html: brandedEmail({
      preheader: `Your design proof is ready - approve or request changes.`,
      heading: `Your proof is ready, ${esc(args.teamName)}!`,
      intro: `Reference: <strong>${esc(args.reference)}</strong>`,
      bodyHtml: `
        <p style="margin:0 0 12px;">Your designer just uploaded your proof. Review it, then either <strong>approve</strong> to move straight into your team order, or request changes if anything needs to be tweaked.</p>
      `,
      ctaText: "Review your proof",
      ctaUrl: args.statusUrl,
    }),
  });
}

/** Team-order invoice (50% deposit or final balance) + a Stripe payment link. */
export type TeamOrderInvoiceContent = {
  teamName: string;
  reference: string;
  stage: "deposit" | "balance";
  lines: { label: string; quantity: number; unitPriceCents: number; totalCents: number }[];
  totalCents: number;
  dueCents: number;
  taxDueCents: number;
  taxExempt?: boolean;
  shipCents?: number;
  roster?: { name: string; number: string; size: string }[];
  payUrl: string;
  payFullUrl?: string;
};

/** The invoice email as { subject, html } - shared by the actual send and the
 *  admin "view invoice" preview so the preview is EXACTLY what the customer
 *  received. */
export function renderTeamOrderInvoice(args: TeamOrderInvoiceContent): { subject: string; html: string } {
  const money = (c: number) => `$${(c / 100).toFixed(2)}`;
  const rows = args.lines
    .map(
      (l) => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #e6e2d6;">${esc(l.label)} × ${l.quantity} <span style="color:#8a8570;">(${money(l.unitPriceCents)} each)</span></td>
          <td style="padding:8px 0;border-bottom:1px solid #e6e2d6;text-align:right;">${money(l.totalCents)}</td>
        </tr>`,
    )
    .join("");
  const isDeposit = args.stage === "deposit";
  return {
    subject: isDeposit
      ? `Your ${args.teamName} order: ${money(args.dueCents)} deposit starts production (${args.reference})`
      : `Final balance for your ${args.teamName} order: ${money(args.dueCents)} (${args.reference})`,
    html: brandedEmail({
      preheader: isDeposit
        ? `Pay the 50% deposit and your order goes straight into production.`
        : `Your order is in production - the balance is due before it ships.`,
      heading: isDeposit ? `Let's get your order started, ${esc(args.teamName)}!` : `Almost there, ${esc(args.teamName)}!`,
      intro: `Order reference: <strong>${esc(args.reference)}</strong>`,
      bodyHtml: `
        ${rows ? `<table style="width:100%;border-collapse:collapse;margin:0 0 14px;">${rows}
          <tr><td style="padding:10px 0;"><strong>Order subtotal</strong></td><td style="padding:10px 0;text-align:right;"><strong>${money(args.totalCents)}</strong></td></tr>
        </table>` : ""}
        <table style="width:100%;border-collapse:collapse;margin:0 0 14px;">
          <tr>
            <td style="padding:6px 14px;background:#f6f4ee;border-left:3px solid #b8a36c;">${isDeposit ? "50% deposit" : "Final balance"}</td>
            <td style="padding:6px 14px;background:#f6f4ee;text-align:right;">${money(args.dueCents)}</td>
          </tr>
          <tr>
            <td style="padding:6px 14px;background:#f6f4ee;border-left:3px solid #b8a36c;">Sales tax (7%)</td>
            <td style="padding:6px 14px;background:#f6f4ee;text-align:right;">${args.taxExempt ? "Exempt" : money(args.taxDueCents)}</td>
          </tr>
          ${
            args.shipCents && args.shipCents > 0
              ? `<tr><td style="padding:6px 14px;background:#f6f4ee;border-left:3px solid #b8a36c;">Shipping</td><td style="padding:6px 14px;background:#f6f4ee;text-align:right;">${money(args.shipCents)}</td></tr>`
              : ""
          }
          <tr>
            <td style="padding:10px 14px;background:#f6f4ee;border-left:3px solid #b8a36c;"><strong>Due now</strong></td>
            <td style="padding:10px 14px;background:#f6f4ee;text-align:right;"><strong>${money(args.dueCents + args.taxDueCents + (args.shipCents ?? 0))}</strong></td>
          </tr>
        </table>
        ${
          args.roster && args.roster.length
            ? `<p style="margin:18px 0 6px;font-size:13px;color:#666;"><strong>Your roster (${args.roster.length}):</strong></p>
               <table style="width:100%;border-collapse:collapse;font-size:13px;margin:0 0 14px;">
                 <tr style="color:#666;"><td style="padding:4px 0;border-bottom:1px solid #e6e0cf;">Player</td><td style="padding:4px 0;border-bottom:1px solid #e6e0cf;">#</td><td style="padding:4px 0;border-bottom:1px solid #e6e0cf;">Size</td></tr>
                 ${args.roster
                   .map(
                     (r) =>
                       `<tr><td style="padding:4px 0;border-bottom:1px solid #f0ece0;">${esc((r.name || "-").toUpperCase())}</td><td style="padding:4px 0;border-bottom:1px solid #f0ece0;">${esc(r.number || "-")}</td><td style="padding:4px 0;border-bottom:1px solid #f0ece0;">${esc(r.size || "-")}</td></tr>`,
                   )
                   .join("")}
               </table>
               <p style="margin:0 0 14px;font-size:12px;color:#888;">Names and numbers print exactly as shown above - reply if anything needs a fix before we produce.</p>`
            : ""
        }
        ${
          isDeposit
            ? `<p style="margin:0;">Production starts the moment your deposit lands - the remaining ${money(args.totalCents - args.dueCents)} plus tax is due before your order ships. You'll enter your <strong>shipping address</strong> on the payment page so we know exactly where your gear is headed. Questions or roster changes first? Just reply to this email.</p>`
            : `<p style="margin:0;">Your gear is in production! Settling the balance now means we ship the moment it's ready - no waiting. Questions? Just reply to this email.</p>`
        }
        ${
          isDeposit && args.payFullUrl
            ? `<p style="margin:14px 0 0;text-align:center;">Prefer one payment? <a href="${args.payFullUrl}" style="color:#b8a36c;font-weight:bold;">Pay in full (${money(args.totalCents)}) instead →</a></p>`
            : ""
        }
      `,
      ctaText: isDeposit ? "Pay your deposit" : "Pay the balance",
      ctaUrl: args.payUrl,
      footerNote: "Standard 2-3 week turnaround · Free local pickup in Ocala",
    }),
  };
}

export async function emailTeamOrderInvoice(args: TeamOrderInvoiceContent & { to: string }): Promise<boolean> {
  const { subject, html } = renderTeamOrderInvoice(args);
  return sendEmail({ to: args.to, subject, html, replyTo: CONTACT_INBOX });
}

/** Reminder for an unpaid deposit or balance invoice. */
export async function emailInvoiceReminder(args: {
  to: string;
  teamName: string;
  reference: string;
  stage: "deposit" | "balance";
  dueCents: number;
  payUrl: string;
  isFinal: boolean;
}): Promise<boolean> {
  const money = `$${(args.dueCents / 100).toFixed(2)}`;
  const isDeposit = args.stage === "deposit";
  return sendEmail({
    to: args.to,
    subject: isDeposit
      ? `Reminder: your ${money} deposit starts production (${args.reference})`
      : `Reminder: ${money} balance due on your ${args.teamName} order (${args.reference})`,
    html: brandedEmail({
      preheader: isDeposit ? `Your order is on hold until the deposit lands.` : `Pay the balance so we can ship the moment it's ready.`,
      heading: `${args.isFinal ? "Last reminder" : "Friendly reminder"}, ${esc(args.teamName)}!`,
      intro: `Order reference: <strong>${esc(args.reference)}</strong>`,
      bodyHtml: isDeposit
        ? `<p style="margin:0;">Your team order is priced and ready, but production doesn't start until the <strong>${money} deposit</strong> comes in. Pay below and we get to work the same day. Roster changes or questions? Just reply.</p>`
        : `<p style="margin:0;">Your gear is in production and the remaining <strong>${money}</strong> is due before it ships. Settling it now means zero delay when your order is ready. Questions? Just reply.</p>`,
      ctaText: isDeposit ? "Pay your deposit" : "Pay the balance",
      ctaUrl: args.payUrl,
    }),
    replyTo: CONTACT_INBOX,
  });
}

/** Shipping notification with the tracking number. */
// Direct "write a review" link for the Slugger Athletics Google Business
// Profile (place ID from Google Maps). Review text mentioning specific
// products (hats, jerseys) is a local-SEO ranking signal, so the ask below
// nudges customers to say what they ordered.
const GOOGLE_REVIEW_URL =
  "https://search.google.com/local/writereview?placeid=ChIJh0imFOTa7EgRpcOO8DdGe9E";

export async function emailOrderShipped(args: {
  to: string;
  name?: string | null;
  reference: string;
  trackingNumber: string;
  trackingUrl: string;
}): Promise<boolean> {
  return sendEmail({
    to: args.to,
    subject: `🚚 Your Slugger Athletics order is on the way! (${args.reference})`,
    html: brandedEmail({
      preheader: `Tracking number ${args.trackingNumber}`,
      heading: `It's on the way${args.name ? `, ${esc(args.name.split(" ")[0])}` : ""}!`,
      intro: `Order reference: <strong>${esc(args.reference)}</strong>`,
      bodyHtml: `
        <p style="margin:0 0 12px;">Your custom gear just shipped. Track it here:</p>
        <p style="margin:0 0 12px;background:#f6f4ee;padding:12px 14px;border-left:3px solid #b8a36c;font-family:monospace;">${esc(args.trackingNumber)}</p>
        <p style="margin:0 0 16px;">Once it lands, we'd love to see it on the field - tag us @sluggerathletics!</p>
        <p style="margin:0 0 6px;"><strong>Happy with your gear?</strong> A quick Google review helps our small shop more than you'd think.</p>
        <p style="margin:0 0 12px;font-size:13px;color:#555;">One sentence about what we made for you (jerseys, embroidered hats, the whole kit) helps other teams find us.</p>
        <p style="margin:0;"><a href="${GOOGLE_REVIEW_URL}" style="color:#b8a36c;font-weight:bold;">Leave a Google review →</a></p>
      `,
      ctaText: "Track your package",
      ctaUrl: args.trackingUrl,
    }),
    replyTo: CONTACT_INBOX,
  });
}

/** Internal heads-up: the designer logged the factory -> Slugger tracking
 *  number, so the order is on its way to the Florida shop. Never sent to the
 *  customer. */
export async function emailInboundShipment(args: {
  reference: string;
  teamName: string;
  carrier: string;
  trackingNumber: string;
  trackingUrl: string;
}): Promise<boolean> {
  return sendEmail({
    to: CONTACT_INBOX,
    subject: `📦 Inbound shipment: ${args.teamName} (${args.reference})`,
    html: brandedEmail({
      preheader: `${args.carrier} ${args.trackingNumber}`,
      heading: "Order is on the way to us",
      intro: `Team order <strong>${esc(args.reference)}</strong> · ${esc(args.teamName)}`,
      bodyHtml: `
        <p style="margin:0 0 12px;">The designer added tracking for the production shipment headed to the shop.</p>
        <p style="margin:0 0 12px;background:#f6f4ee;padding:12px 14px;border-left:3px solid #b8a36c;font-family:monospace;">${esc(args.carrier)} · ${esc(args.trackingNumber)}</p>
        <p style="margin:0;font-size:13px;color:#555;">Internal only - the customer does not see this. When it lands, use the admin page to create the outbound label and email their tracking.</p>
      `,
      ctaText: "Check shipment status",
      ctaUrl: args.trackingUrl,
    }),
  });
}

/** Friendly reminder that a proof is waiting on the client's review. */
export async function emailProofFollowUp(args: {
  to: string;
  teamName: string;
  reference: string;
  statusUrl: string;
  round: number;
  neededBy?: Date | null;
}): Promise<boolean> {
  const deadline =
    args.neededBy && !isNaN(args.neededBy.getTime())
      ? args.neededBy.toLocaleDateString("en-US", { month: "long", day: "numeric" })
      : null;
  const isFinal = args.round >= 2;
  return sendEmail({
    to: args.to,
    subject: isFinal
      ? `Last nudge: your ${args.teamName} design is waiting on you (${args.reference})`
      : `Your ${args.teamName} proof is still waiting for a look (${args.reference})`,
    html: brandedEmail({
      preheader: `One click to review - approve it or tell us what to change.`,
      heading: isFinal ? `Don't leave your design hanging!` : `Just checking in, ${esc(args.teamName)}`,
      intro: `Reference: <strong>${esc(args.reference)}</strong>`,
      bodyHtml: `
        <p style="margin:0 0 12px;">Your custom design proof is ready and waiting for your review. Approve it and we move straight into production, or drop a pin on anything you'd like changed.</p>
        ${deadline ? `<p style="margin:0 0 12px;">Heads up: you told us you need your gear by <strong>${deadline}</strong>. Production takes 2-3 weeks after approval, so a quick review keeps you on schedule.</p>` : ""}
        <p style="margin:0;">Questions first? Just reply to this email or use the message box on your design page.</p>
      `,
      ctaText: "Review your proof",
      ctaUrl: args.statusUrl,
    }),
    replyTo: CONTACT_INBOX,
  });
}

/** Email the client that the designer sent them a message/question. */
export async function emailDesignerMessage(args: {
  to: string;
  teamName: string;
  reference: string;
  text: string;
  fromName?: string;
  statusUrl: string;
}): Promise<boolean> {
  return sendEmail({
    to: args.to,
    subject: `💬 A question about your ${args.teamName} design (${args.reference})`,
    html: brandedEmail({
      preheader: `Your designer needs a quick answer to keep your design moving.`,
      heading: args.fromName ? `Quick question from ${esc(args.fromName)} at Slugger` : `Quick question from your designer`,
      intro: `Reference: <strong>${esc(args.reference)}</strong>`,
      bodyHtml: `
        <p style="margin:0;background:#f6f4ee;padding:12px 14px;border-left:3px solid #b8a36c;">${esc(args.text).replace(/\n/g, "<br>")}</p>
        <p style="margin:14px 0 0;">Answering on your design page keeps everything in one place - and the faster we hear back, the faster your design moves.</p>
      `,
      ctaText: "Reply on your design page",
      ctaUrl: args.statusUrl,
    }),
  });
}

/** Email the buyer a paid-order confirmation with an item summary. */
export async function emailOrderConfirmation(args: {
  to: string;
  customerName?: string;
  reference: string;
  lines: { name: string; quantity: number; amountCents: number }[];
  totalCents: number;
  shipping?: string;
}): Promise<boolean> {
  const money = (c: number) => `$${(c / 100).toFixed(2)}`;
  const rows = args.lines
    .map(
      (l) => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #e6e2d6;">${esc(l.name)}${l.quantity > 1 ? ` × ${l.quantity}` : ""}</td>
          <td style="padding:8px 0;border-bottom:1px solid #e6e2d6;text-align:right;">${money(l.amountCents)}</td>
        </tr>`,
    )
    .join("");
  const firstName = args.customerName?.split(" ")[0];
  return sendEmail({
    to: args.to,
    subject: `Order confirmed! Your Slugger Athletics gear is in the works (${args.reference})`,
    html: brandedEmail({
      preheader: `We got your order ${args.reference} - here's what happens next.`,
      heading: `Thanks for your order${firstName ? `, ${esc(firstName)}` : ""}!`,
      intro: `Order reference: <strong>${esc(args.reference)}</strong>`,
      bodyHtml: `
        <table style="width:100%;border-collapse:collapse;margin:0 0 14px;">
          ${rows}
          <tr>
            <td style="padding:10px 0;"><strong>Total</strong></td>
            <td style="padding:10px 0;text-align:right;"><strong>${money(args.totalCents)}</strong></td>
          </tr>
        </table>
        ${args.shipping ? `<p style="margin:0 0 12px;"><strong>Ships to:</strong><br>${esc(args.shipping).replace(/\n/g, "<br>")}</p>` : ""}
        <p style="margin:0;">Custom gear is made to order - standard turnaround is <strong>2-3 weeks</strong>. We'll email you again when your order ships. Questions in the meantime? Just reply to this email.</p>
      `,
      footerNote: "Slugger Athletics · Custom team gear, made to order",
    }),
    replyTo: CONTACT_INBOX,
  });
}

/** Email the business a contact-form submission. */
export async function emailContactSubmission(msg: {
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
}): Promise<boolean> {
  const bodyHtml = `
    <p style="margin:0 0 8px;"><strong>Name:</strong> ${esc(msg.name)}</p>
    <p style="margin:0 0 8px;"><strong>Email:</strong> ${esc(msg.email)}</p>
    ${msg.phone ? `<p style="margin:0 0 8px;"><strong>Phone:</strong> ${esc(msg.phone)}</p>` : ""}
    <p style="margin:0 0 8px;"><strong>Subject:</strong> ${esc(msg.subject || "General")}</p>
    <p style="margin:14px 0 6px;"><strong>Message:</strong></p>
    <p style="margin:0;background:#f6f4ee;padding:12px 14px;border-left:3px solid #b8a36c;">${esc(msg.message).replace(/\n/g, "<br>")}</p>
  `;
  return sendEmail({
    to: CONTACT_INBOX,
    subject: `New contact: ${msg.subject || "Website message"} - ${msg.name}`,
    html: brandedEmail({
      preheader: `New contact from ${msg.name}`,
      heading: "New website contact message",
      intro: `From <strong>${esc(msg.name)}</strong>. Reply to this email to respond directly.`,
      bodyHtml,
    }),
    replyTo: msg.email,
  });
}
