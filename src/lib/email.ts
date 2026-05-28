// Sends transactional email via Resend (https://resend.com).
// Used for contact-form submissions and (later) team-order quotes.

export const emailEnabled = () => Boolean(process.env.RESEND_API_KEY);

// Where customer-facing form submissions are delivered.
export const CONTACT_INBOX = process.env.CONTACT_TO_EMAIL || "apparel@sluggerathletics.com";

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
};

export async function sendEmail({ to, subject, html, replyTo }: SendArgs): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("RESEND_API_KEY not set - skipping email send");
    return false;
  }
  // Must be a verified domain/sender in your Resend account.
  const from = process.env.EMAIL_FROM || "Slugger Athletics <noreply@sluggerathletics.com>";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
    });
    if (!res.ok) {
      console.error("Resend email failed:", res.status, await res.text());
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
