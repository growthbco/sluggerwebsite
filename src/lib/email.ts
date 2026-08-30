// Sends transactional email via Brevo (https://brevo.com).
// Used for contact-form submissions, design-request confirmations, and
// designer notifications. The higher-level helpers below stay provider-agnostic.

export const emailEnabled = () => Boolean(process.env.BREVO_API_KEY);

// Where customer-facing form submissions are delivered.
export const CONTACT_INBOX = process.env.CONTACT_TO_EMAIL || "apparel@sluggerathletics.com";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://sluggerathletics.com";

// Reusable footer snippet pointing customers to the self-serve order portal.
const portalLinkHtml = `<p style="margin:16px 0 0;font-size:13px;color:#555;">See all your orders, designs, and invoices anytime at <a href="${SITE}/portal" style="color:#b8a36c;font-weight:bold;">your order portal &rarr;</a></p>`;

// Warm first-touch welcome line for a customer's first confirmation email.
const welcomeHtml = `<p style="margin:16px 0 0;font-size:13px;color:#555;">Welcome to Slugger Athletics - Ocala's custom team shop. Questions anytime? Text us at (352) 414-7270.</p>`;

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
import {
  formatRequestedDate,
  formatTimelineDate,
  type DeliveryTimeline,
} from "@/lib/delivery-timeline";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function deliveryTimelineEmailHtml(timeline: DeliveryTimeline, localPickup = false): string {
  if (!timeline.startAt || !timeline.selectedTargetAt) return "";
  const targetLabel = localPickup ? "Pickup target" : "Ready-to-ship target";
  return `
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px 12px;background:#f6f4ee;border-left:3px solid #b8a36c;color:#666;">Service level</td><td style="padding:8px 12px;background:#f6f4ee;text-align:right;"><strong>${esc(timeline.tierLabel)}</strong></td></tr>
      <tr><td style="padding:8px 12px;background:#f6f4ee;border-left:3px solid #b8a36c;color:#666;">Production started</td><td style="padding:8px 12px;background:#f6f4ee;text-align:right;"><strong>${formatTimelineDate(timeline.startAt)}</strong></td></tr>
      <tr><td style="padding:8px 12px;background:#f6f4ee;border-left:3px solid #b8a36c;color:#666;">${targetLabel}</td><td style="padding:8px 12px;background:#f6f4ee;text-align:right;"><strong>${formatTimelineDate(timeline.selectedTargetAt)}</strong></td></tr>
      ${timeline.requestedInHandAt ? `<tr><td style="padding:8px 12px;background:#f6f4ee;border-left:3px solid #b8a36c;color:#666;">Requested in hand</td><td style="padding:8px 12px;background:#f6f4ee;text-align:right;">${formatRequestedDate(timeline.requestedInHandAt)}${timeline.promisedInHandAt ? "" : ` <span style="display:block;font-size:11px;color:#888;">request, not a confirmed date</span>`}</td></tr>` : ""}
      ${timeline.promisedInHandAt ? `<tr><td style="padding:8px 12px;background:#fff8df;border-left:3px solid #b8a36c;color:#806d35;"><strong>Confirmed in-hand date</strong></td><td style="padding:8px 12px;background:#fff8df;text-align:right;"><strong>${formatRequestedDate(timeline.promisedInHandAt)}</strong></td></tr>` : ""}
    </table>
    <p style="margin:0 0 12px;font-size:13px;color:#666;">${localPickup ? "We will contact you when the order is ready for pickup in Ocala." : "The production target is when we expect your order to be ready to ship. Carrier transit comes afterward, and tracking will show the delivery estimate once the final package is on its way."}</p>
  `;
}

export type OrderTimelineEmailContent = {
  teamName: string;
  reference: string;
  timeline: DeliveryTimeline;
  localPickup?: boolean;
  manageUrl: string;
};

export function renderOrderTimelineConfirmation(args: OrderTimelineEmailContent): { subject: string; html: string } {
  const target = formatTimelineDate(args.timeline.selectedTargetAt);
  const action = args.localPickup ? "pickup" : "ready to ship";
  return {
    subject: `Your ${args.teamName} order timeline (${args.reference})`,
    html: brandedEmail({
      preheader: `Your order is currently expected to be ${action} by ${target}.`,
      heading: "Your order timeline is set",
      intro: `Order reference: <strong>${esc(args.reference)}</strong>`,
      bodyHtml: `
        <p style="margin:0 0 12px;">Here is the production and delivery information we have on file for <strong>${esc(args.teamName)}</strong>.</p>
        ${deliveryTimelineEmailHtml(args.timeline, args.localPickup)}
        <p style="margin:0;">You can return to your order page anytime for the latest status. We will also email tracking when the final package is on its way.</p>
        ${portalLinkHtml}
      `,
      ctaText: "View order timeline",
      ctaUrl: args.manageUrl,
      footerNote: "Questions? Reply to this email or text (352) 414-7270",
    }),
  };
}

export async function emailOrderTimelineConfirmation(args: OrderTimelineEmailContent & { to: string }): Promise<boolean> {
  const { subject, html } = renderOrderTimelineConfirmation(args);
  return sendEmail({ to: args.to, subject, html, replyTo: CONTACT_INBOX });
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
    if (!isNaN(d.getTime())) neededByStr = d.toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" });
  }
  const subjectPrefix = req.rush ? "🚨 DATE REVIEW " : "";
  const bodyHtml = `
    ${req.rush ? `<p style="background:#fff3cd;padding:10px 14px;border-left:4px solid #b8a36c;margin:0 0 16px;"><strong style="color:#13160b;">🚨 Expedited date review:</strong> this date is inside the standard three-week window. Two-week rush is $100; shorter deadlines require a manual priority quote. Approve the full timeline BEFORE promising the date.</p>` : ""}
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
      heading: `${req.rush ? "🚨 DATE REVIEW · " : ""}New design request`,
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
        ${welcomeHtml}
        ${portalLinkHtml}
      `,
      ctaText: "Track your design",
      ctaUrl: args.statusUrl,
      footerNote: "Free design proofs · Order early for fall · Flat $100 rush service",
    }),
  });
}

/** Email the client that we received their payment, pointing them to the portal
 *  to track the order from here on. Fires on deposit or full/balance payment. */
export async function emailPaymentReceived(args: {
  to: string;
  teamName: string;
  reference: string;
  stage: "deposit" | "balance";
  timeline?: DeliveryTimeline;
  localPickup?: boolean;
  manageUrl?: string;
}): Promise<boolean> {
  const dep = args.stage === "deposit";
  return sendEmail({
    to: args.to,
    subject: `Payment received - ${args.teamName} (${args.reference})`,
    html: brandedEmail({
      preheader: dep ? "Deposit received - your order is in production." : "Payment received - thank you.",
      heading: `Thank you, ${esc(args.teamName)}!`,
      intro: `Reference: <strong>${esc(args.reference)}</strong>`,
      bodyHtml: `
        <p style="margin:0 0 12px;">We received your ${dep ? "50% deposit" : "payment"} for <strong>${esc(args.teamName)}</strong>. ${dep ? "Your order is now in production." : "Your order is paid in full."}</p>
        ${args.timeline ? deliveryTimelineEmailHtml(args.timeline, args.localPickup) : ""}
        <p style="margin:0;">From your order portal you can check status and tracking, pay a balance, update your shipping address, or add players anytime.</p>
      `,
      ctaText: args.timeline ? "View order timeline" : "View my orders",
      ctaUrl: args.manageUrl ?? `${SITE}/portal`,
      footerNote: "Track everything at sluggerathletics.com/portal · Text us at (352) 414-7270",
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
  /** Number of parcels this order ships in. When >1 (hats ship in their own
   *  box), the shipping line notes it so the charge is self-explanatory. */
  shipBoxes?: number;
  roster?: { name: string; number: string; size: string; item?: string; color?: string }[];
  payUrl: string;
  payFullUrl?: string;
  /** The true pay-in-full charge (goods + tax + shipping). Shown on the
   *  "pay in full instead" link so it matches what Stripe actually charges. */
  payFullCents?: number;
  /** Referral store credit applied to the amount due now (reduces the goods
   *  and the tax computed on them). */
  creditAppliedCents?: number;
  /** Referral credit baked into the "pay in full instead" amount, for the note
   *  on that link at the deposit stage. */
  payFullCreditCents?: number;
  /** Order is local pickup in Ocala - no shipping is ever charged. */
  localPickup?: boolean;
  /** Rush orders ship direct from production with no additional shipping fee. */
  shippingIncludedWithRush?: boolean;
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
              ? `<tr><td style="padding:6px 14px;background:#f6f4ee;border-left:3px solid #b8a36c;">Shipping${args.shipBoxes && args.shipBoxes > 1 ? ` <span style="color:#8a8570;">(${args.shipBoxes} boxes - hats ship separately)</span>` : ""}</td><td style="padding:6px 14px;background:#f6f4ee;text-align:right;">${money(args.shipCents)}</td></tr>`
              : args.shippingIncludedWithRush
                ? `<tr><td style="padding:6px 14px;background:#f6f4ee;border-left:3px solid #b8a36c;">Direct shipping</td><td style="padding:6px 14px;background:#f6f4ee;text-align:right;color:#2e7d32;">included with Rush</td></tr>`
                : args.localPickup
                ? `<tr><td style="padding:6px 14px;background:#f6f4ee;border-left:3px solid #b8a36c;">Shipping</td><td style="padding:6px 14px;background:#f6f4ee;text-align:right;color:#8a8570;">free local pickup in Ocala</td></tr>`
                : isDeposit
                  ? `<tr><td style="padding:6px 14px;background:#f6f4ee;border-left:3px solid #b8a36c;">Shipping</td><td style="padding:6px 14px;background:#f6f4ee;text-align:right;color:#8a8570;">added to your final invoice</td></tr>`
                  : ""
          }
          ${
            args.creditAppliedCents && args.creditAppliedCents > 0
              ? `<tr><td style="padding:6px 14px;background:#f6f4ee;border-left:3px solid #b8a36c;">Referral credit</td><td style="padding:6px 14px;background:#f6f4ee;text-align:right;color:#2e7d32;">-${money(args.creditAppliedCents)}</td></tr>`
              : ""
          }
          <tr>
            <td style="padding:10px 14px;background:#f6f4ee;border-left:3px solid #b8a36c;"><strong>Due now</strong></td>
            <td style="padding:10px 14px;background:#f6f4ee;text-align:right;"><strong>${money(args.dueCents + args.taxDueCents + (args.shipCents ?? 0) - (args.creditAppliedCents ?? 0))}</strong></td>
          </tr>
        </table>
        ${
          isDeposit
            ? args.shippingIncludedWithRush
              ? `<p style="margin:0 0 14px;font-size:13px;color:#666;">This order includes direct shipping from production as part of the Rush fee. No additional shipping charge will be added.</p>`
              : args.localPickup
              ? `<p style="margin:0 0 14px;font-size:13px;color:#666;">This order is set for free local pickup at our Ocala shop - no shipping charges, ever. We'll let you know the moment it's ready to grab.</p>`
              : `<p style="margin:0 0 14px;font-size:13px;color:#666;">Why is shipping on the final invoice? Teams often add pieces while we're in production - extra jerseys, hats, a team hype chain. Charging shipping at the end means everything ships together and you pay the exact real rate, never an estimate. And if you pick up at our Ocala shop, shipping is simply $0.</p>`
            : ""
        }
        ${
          args.roster && args.roster.length
            ? `<p style="margin:18px 0 6px;font-size:13px;color:#666;"><strong>Your roster (${args.roster.length}):</strong></p>
               <table style="width:100%;border-collapse:collapse;font-size:13px;margin:0 0 14px;">
                 <tr style="color:#666;">
                   <td style="padding:4px 0;border-bottom:1px solid #e6e0cf;">Player</td>
                   <td style="padding:4px 0;border-bottom:1px solid #e6e0cf;">#</td>
                   ${args.roster.some((r) => r.item) ? `<td style="padding:4px 0;border-bottom:1px solid #e6e0cf;">Item</td>` : ""}
                   <td style="padding:4px 0;border-bottom:1px solid #e6e0cf;">Size</td>
                   ${args.roster.some((r) => r.color) ? `<td style="padding:4px 0;border-bottom:1px solid #e6e0cf;">Color</td>` : ""}
                 </tr>
                 ${args.roster
                   .map(
                     (r) =>
                       `<tr><td style="padding:4px 0;border-bottom:1px solid #f0ece0;">${esc((r.name || "-").toUpperCase())}</td><td style="padding:4px 0;border-bottom:1px solid #f0ece0;">${esc(r.number || "-")}</td>${args.roster!.some((x) => x.item) ? `<td style="padding:4px 0;border-bottom:1px solid #f0ece0;">${esc(r.item || "-")}</td>` : ""}<td style="padding:4px 0;border-bottom:1px solid #f0ece0;">${esc(r.size || "-")}</td>${args.roster!.some((x) => x.color) ? `<td style="padding:4px 0;border-bottom:1px solid #f0ece0;">${esc(r.color || "-")}</td>` : ""}</tr>`,
                   )
                   .join("")}
               </table>
               <p style="margin:0 0 14px;font-size:12px;color:#888;">Names and numbers print exactly as shown above - reply if anything needs a fix before we produce.</p>`
            : ""
        }
        ${
          isDeposit
            ? `<p style="margin:0;">${args.shippingIncludedWithRush ? `Production starts the moment your deposit lands - the remaining ${money(args.totalCents - args.dueCents)} plus tax is due before your order ships. Direct shipping is included with Rush, with no added shipping charge.` : `Production starts the moment your deposit lands - the remaining ${money(args.totalCents - args.dueCents)} plus tax and shipping is due before your order ships.`} You'll enter your <strong>shipping address</strong> on the payment page so we know exactly where your gear is headed. Questions or roster changes first? Just reply to this email.</p>
        <table style="width:100%;border-collapse:collapse;margin:18px 0 0;"><tr><td style="padding:14px 16px;background:#f6f4ee;border:1px solid #e6e0cf;border-left:3px solid #b8a36c;">
          <p style="margin:0 0 6px;font-weight:bold;color:#13160b;">🏆 Make it official: add a Custom Team Hype Chain</p>
          <p style="margin:0 0 8px;font-size:14px;color:#444;">The chain your players fight for after every big play - custom built in 3D to match your team's logo and colors. Chains start at $40 each (one-time $50 design file charge per design), and the mockup is free. Add one now and it ships right alongside your uniforms.</p>
          <p style="margin:0;font-size:14px;"><a href="https://sluggerathletics.com/hype-chains" style="color:#9c884f;font-weight:bold;">See custom hype chains →</a> <span style="color:#8a8570;">or just reply to this email and we'll mock one up free.</span></p>
        </td></tr></table>`
            : `<p style="margin:0;">Your gear is in production! Settling the balance now means we ship the moment it's ready - no waiting. Questions? Just reply to this email.</p>`
        }
        ${
          isDeposit && args.payFullUrl
            ? `<p style="margin:14px 0 0;text-align:center;">Prefer one payment? <a href="${args.payFullUrl}" style="color:#b8a36c;font-weight:bold;">Pay in full (${money(args.payFullCents ?? args.totalCents)}) instead →</a>${args.payFullCreditCents && args.payFullCreditCents > 0 ? ` <span style="color:#2e7d32;font-size:13px;">(includes your ${money(args.payFullCreditCents)} referral credit)</span>` : ""}</p>`
            : ""
        }
      `,
      ctaText: isDeposit ? "Pay your deposit" : "Pay the balance",
      ctaUrl: args.payUrl,
      footerNote: args.shippingIncludedWithRush
        ? "Rush production: 2 weeks · Direct shipping included · Carrier transit follows production"
        : "Standard production: 3 weeks · Shipping time additional · Free local pickup in Ocala",
    }),
  };
}

export async function emailTeamOrderInvoice(args: TeamOrderInvoiceContent & { to: string }): Promise<boolean> {
  const { subject, html } = renderTeamOrderInvoice(args);
  return sendEmail({ to: args.to, subject, html, replyTo: CONTACT_INBOX });
}

/** Free-form custom invoice (built from scratch on /admin/invoice/new). */
export async function emailCustomInvoice(args: {
  to: string;
  customerName: string;
  reference: string;
  lines: { name: string; description?: string; quantity: number; unitPriceCents: number }[];
  subtotalCents: number;
  creditCents?: number;
  shippingCents?: number;
  taxCents: number;
  totalCents: number;
  notes?: string | null;
  payUrl: string;
}): Promise<boolean> {
  const money = (c: number) => `$${(c / 100).toFixed(2)}`;
  const rows = args.lines
    .map(
      (l) => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #e6e2d6;">
            ${esc(l.name)} × ${l.quantity} <span style="color:#8a8570;">(${money(l.unitPriceCents)} each)</span>
            ${l.description ? `<div style="font-size:13px;color:#8a8570;margin-top:2px;">${esc(l.description)}</div>` : ""}
          </td>
          <td style="padding:8px 0;border-bottom:1px solid #e6e2d6;text-align:right;vertical-align:top;">${money(l.unitPriceCents * l.quantity)}</td>
        </tr>`,
    )
    .join("");
  return sendEmail({
    to: args.to,
    subject: `Invoice from Slugger Athletics: ${money(args.totalCents)} (${args.reference})`,
    html: brandedEmail({
      preheader: `Your Slugger Athletics invoice for ${money(args.totalCents)} is ready to pay online.`,
      heading: `Invoice for ${esc(args.customerName)}`,
      intro: `Invoice reference: <strong>${esc(args.reference)}</strong>`,
      bodyHtml: `
        <table style="width:100%;border-collapse:collapse;margin:0 0 14px;">${rows}
          <tr><td style="padding:10px 0;">Subtotal</td><td style="padding:10px 0;text-align:right;">${money(args.subtotalCents)}</td></tr>
          ${args.creditCents ? `<tr><td style="padding:4px 0;color:#2e7d32;">Referral credit</td><td style="padding:4px 0;text-align:right;color:#2e7d32;">-${money(args.creditCents)}</td></tr>` : ""}
          ${args.taxCents > 0 ? `<tr><td style="padding:4px 0;">FL sales tax (7%)</td><td style="padding:4px 0;text-align:right;">${money(args.taxCents)}</td></tr>` : ""}
          ${args.shippingCents ? `<tr><td style="padding:4px 0;">Shipping</td><td style="padding:4px 0;text-align:right;">${money(args.shippingCents)}</td></tr>` : ""}
          <tr><td style="padding:10px 0;border-top:1px solid #e6e2d6;"><strong>Total due</strong></td><td style="padding:10px 0;border-top:1px solid #e6e2d6;text-align:right;"><strong>${money(args.totalCents)}</strong></td></tr>
        </table>
        ${args.notes ? `<div style="margin:0 0 14px;padding:12px 14px;background:#f6f4ee;border-left:3px solid #b8a36c;font-size:13px;color:#555;white-space:pre-line;">${esc(args.notes)}</div>` : ""}
        <p style="margin:0;">Pay securely online with the button below. Questions? Just reply to this email or text us at (352) 414-7270.</p>
      `,
      ctaText: "Pay this invoice",
      ctaUrl: args.payUrl,
      footerNote: "Slugger Athletics · Custom team gear · Ocala, FL",
    }),
    replyTo: CONTACT_INBOX,
  });
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
  directFromProduction?: boolean;
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
        ${args.directFromProduction ? `
          <p style="margin:0 0 12px;background:#fff8df;padding:12px 14px;border-left:3px solid #b8a36c;">
            This order is shipping directly from one of our production partners. Carrier tracking may display the shipment&apos;s origin facility or country. Slugger Athletics remains your point of contact for the order and any delivery questions.
          </p>
        ` : ""}
        <p style="margin:0 0 16px;">Once it lands, we'd love to see it on the field - tag us @sluggerathletics!</p>
        <p style="margin:0 0 6px;"><strong>Happy with your gear?</strong> A quick Google review helps our small shop more than you'd think.</p>
        <p style="margin:0 0 12px;font-size:13px;color:#555;">One sentence about what we made for you (jerseys, embroidered hats, the whole kit) helps other teams find us.</p>
        <p style="margin:0;"><a href="${GOOGLE_REVIEW_URL}" style="color:#b8a36c;font-weight:bold;">Leave a Google review →</a></p>
        ${portalLinkHtml}
      `,
      ctaText: "Track your package",
      ctaUrl: args.trackingUrl,
    }),
    replyTo: CONTACT_INBOX,
  });
}

/** An ADDITIONAL package on an order that already shipped (a second box, a
 *  reship, or hats going out separately). Same look as the first, worded so
 *  the customer knows more is on the way. */
export async function emailAdditionalShipment(args: {
  to: string;
  name?: string | null;
  reference: string;
  trackingNumber: string;
  trackingUrl: string;
  note?: string;
}): Promise<boolean> {
  return sendEmail({
    to: args.to,
    subject: `🚚 Another Slugger Athletics package is on the way! (${args.reference})`,
    html: brandedEmail({
      preheader: `Additional shipment - tracking ${args.trackingNumber}`,
      heading: `More gear headed your way${args.name ? `, ${esc(args.name.split(" ")[0])}` : ""}!`,
      intro: `Order reference: <strong>${esc(args.reference)}</strong>`,
      bodyHtml: `
        <p style="margin:0 0 12px;">A second package for your order just shipped${args.note ? ` (${esc(args.note)})` : ""}. Track this one here:</p>
        <p style="margin:0 0 16px;background:#f6f4ee;padding:12px 14px;border-left:3px solid #b8a36c;font-family:monospace;">${esc(args.trackingNumber)}</p>
        <p style="margin:0;">Questions? Just reply or text us at (352) 414-7270.</p>
        ${portalLinkHtml}
      `,
      ctaText: "Track this package",
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
      ? args.neededBy.toLocaleDateString("en-US", { timeZone: "America/New_York", month: "long", day: "numeric" })
      : null;
  const isFinal = args.round >= 3;
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
        ${deadline ? `<p style="margin:0 0 12px;">Heads up: you requested your gear in hand by <strong>${deadline}</strong>. Standard production is three weeks after final approval, final roster, and deposit, with shipping time additional. A quick review helps keep the order moving.</p>` : ""}
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
    subject: `💬 New message about your ${args.teamName} design (${args.reference})`,
    html: brandedEmail({
      preheader: `There's a new reply on your design thread.`,
      heading: args.fromName ? `New message from ${esc(args.fromName)} at Slugger` : `New message from your designer`,
      intro: `Reference: <strong>${esc(args.reference)}</strong>`,
      bodyHtml: `
        <p style="margin:0;background:#f6f4ee;padding:12px 14px;border-left:3px solid #b8a36c;">${esc(args.text).replace(/\n/g, "<br>")}</p>
        <p style="margin:14px 0 0;">Replying on your design page keeps everything in one place - and the faster we hear back, the faster your design moves.</p>
      `,
      ctaText: "Open your design page",
      ctaUrl: args.statusUrl,
    }),
  });
}

/** Two-week rush service approved by staff. The requested in-hand date remains
 * separate from the production target unless it is explicitly confirmed. */
export async function emailRushConfirmed(args: {
  to: string;
  teamName: string;
  reference: string;
  neededBy: Date | null;
  approvedBy?: string;
  statusUrl: string;
}): Promise<boolean> {
  const date = args.neededBy
    ? args.neededBy.toLocaleDateString("en-US", { timeZone: "America/New_York", month: "long", day: "numeric", year: "numeric" })
    : "your requested date";
  return sendEmail({
    to: args.to,
    subject: `🚨 Rush confirmed - ${args.teamName} (${args.reference})`,
    html: brandedEmail({
      preheader: `Your two-week rush service has been approved.`,
      heading: `Your rush service is confirmed`,
      intro: `Reference: <strong>${esc(args.reference)}</strong>`,
      bodyHtml: `
        <p style="margin:0 0 12px;">${args.approvedBy ? `${esc(args.approvedBy)} at Slugger` : "Our team"} reviewed your deadline and we can have your order in hand by <strong>${esc(date)}</strong>.</p>
        <p style="margin:0 0 12px;">Rush orders get priority production and ship direct to you. Rush is a flat <strong>$100</strong> fee, includes direct shipping, and will appear on your invoice. No additional shipping charge will be added.</p>
        <p style="margin:0;">To keep the timeline, please approve your design and pay the deposit as soon as they're ready - the clock starts there.</p>
      `,
      ctaText: "View your design",
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
        <p style="margin:0;">Custom gear is made to order. Standard production is <strong>three weeks</strong> after final design approval, final roster submission, and deposit payment. Shipping time is additional. We'll email you again when your order ships.</p>
        ${welcomeHtml}
        ${portalLinkHtml}
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
