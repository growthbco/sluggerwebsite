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

/** Email the client that the designer sent them a message/question. */
export async function emailDesignerMessage(args: {
  to: string;
  teamName: string;
  reference: string;
  text: string;
  statusUrl: string;
}): Promise<boolean> {
  return sendEmail({
    to: args.to,
    subject: `💬 A question about your ${args.teamName} design (${args.reference})`,
    html: brandedEmail({
      preheader: `Your designer needs a quick answer to keep your design moving.`,
      heading: `Quick question from your designer`,
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
