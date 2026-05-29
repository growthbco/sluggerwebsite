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

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Email the designer that a new design request came in. */
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
}): Promise<boolean> {
  const imgs = (req.inspirationImages ?? [])
    .map((u, i) => `<li><a href="${esc(u)}">Inspiration ${i + 1}</a></li>`)
    .join("");
  const html = `
    <h2>New design request - ${esc(req.reference)}</h2>
    <p><strong>Team:</strong> ${esc(req.teamName)} ${req.sport ? `(${esc(req.sport)})` : ""}</p>
    <p><strong>Contact:</strong> ${esc(req.contactName)} - ${esc(req.contactEmail)}${req.contactPhone ? ` - ${esc(req.contactPhone)}` : ""}</p>
    ${req.colors ? `<p><strong>Colors:</strong> ${esc(req.colors)}</p>` : ""}
    ${req.vision ? `<p><strong>Vision:</strong><br>${esc(req.vision).replace(/\n/g, "<br>")}</p>` : ""}
    ${imgs ? `<p><strong>Inspiration:</strong></p><ul>${imgs}</ul>` : ""}
    ${req.manageUrl ? `<p><a href="${esc(req.manageUrl)}">Open in manage view to upload a proof →</a></p>` : ""}
  `;
  return sendEmail({
    to: CONTACT_INBOX,
    subject: `New design request: ${req.teamName} - ${req.reference}`,
    html,
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
  const html = `
    <h2>We got your design request, ${esc(args.teamName)}!</h2>
    <p>Reference: <strong>${esc(args.reference)}</strong></p>
    <p>Our in-house designer will start work on a free mockup. You'll get a notification when the proof is ready to review.</p>
    <p>Track your design request: <a href="${esc(args.statusUrl)}">${esc(args.statusUrl)}</a></p>
    <p>- The Slugger Athletics team</p>
  `;
  return sendEmail({
    to: args.to,
    subject: `Your Slugger Athletics design request (${args.reference})`,
    html,
  });
}

/** Email the client that a proof is ready to review. */
export async function emailProofReady(args: {
  to: string;
  teamName: string;
  reference: string;
  statusUrl: string;
}): Promise<boolean> {
  const html = `
    <h2>Your proof is ready, ${esc(args.teamName)}!</h2>
    <p>Reference: <strong>${esc(args.reference)}</strong></p>
    <p>Review and approve (or request changes) here: <a href="${esc(args.statusUrl)}">${esc(args.statusUrl)}</a></p>
  `;
  return sendEmail({
    to: args.to,
    subject: `Your Slugger Athletics proof is ready (${args.reference})`,
    html,
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
  const html = `
    <h2>New website contact message</h2>
    <p><strong>Name:</strong> ${esc(msg.name)}</p>
    <p><strong>Email:</strong> ${esc(msg.email)}</p>
    ${msg.phone ? `<p><strong>Phone:</strong> ${esc(msg.phone)}</p>` : ""}
    <p><strong>Subject:</strong> ${esc(msg.subject || "General")}</p>
    <p><strong>Message:</strong></p>
    <p>${esc(msg.message).replace(/\n/g, "<br>")}</p>
  `;
  return sendEmail({
    to: CONTACT_INBOX,
    subject: `New contact: ${msg.subject || "Website message"} - ${msg.name}`,
    html,
    replyTo: msg.email, // so you can reply straight to the customer
  });
}
