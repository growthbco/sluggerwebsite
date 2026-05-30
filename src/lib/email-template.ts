// Reusable branded email template. Inline styles only (most email clients
// strip <style> blocks). All transactional emails wrap their content with
// `brandedEmail()` for consistent Slugger Athletics branding.

const COLORS = {
  ink: "#13160b",
  brand: "#b8a36c",
  brandDark: "#9c884f",
  text: "#222222",
  muted: "#666666",
  surface: "#f6f4ee",
  line: "#e6e0cf",
};

export function brandedEmail(opts: {
  preheader?: string; // hidden preview text shown in inbox listings
  heading: string;
  intro?: string;
  bodyHtml?: string; // already-escaped HTML for the body
  ctaText?: string;
  ctaUrl?: string;
  footerNote?: string;
}): string {
  const { preheader, heading, intro, bodyHtml, ctaText, ctaUrl, footerNote } = opts;
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${COLORS.surface};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${COLORS.text};">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>` : ""}
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${COLORS.surface};padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid ${COLORS.line};">
        <!-- Header / wordmark -->
        <tr>
          <td style="background:${COLORS.ink};padding:22px 28px;text-align:left;">
            <div style="font-family:Impact,'Arial Narrow',sans-serif;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;font-size:22px;line-height:1;">
              <span style="color:#ffffff;">SLUGGER</span>&nbsp;<span style="color:${COLORS.brand};">ATHLETICS</span>
            </div>
            <div style="color:#bdbab0;font-size:11px;letter-spacing:1px;text-transform:uppercase;margin-top:4px;">Custom Team Gear · Ocala, FL</div>
          </td>
        </tr>
        <!-- Gold accent bar -->
        <tr><td style="background:${COLORS.brand};height:4px;line-height:4px;font-size:0;">&nbsp;</td></tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px 28px 20px;">
            <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;color:${COLORS.ink};font-weight:700;">${heading}</h1>
            ${intro ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:${COLORS.text};">${intro}</p>` : ""}
            ${bodyHtml ? `<div style="font-size:15px;line-height:1.55;color:${COLORS.text};">${bodyHtml}</div>` : ""}
            ${
              ctaText && ctaUrl
                ? `<div style="margin:28px 0 8px;"><a href="${ctaUrl}" style="display:inline-block;background:${COLORS.brand};color:${COLORS.ink};text-decoration:none;padding:14px 26px;font-weight:700;letter-spacing:0.4px;text-transform:uppercase;font-family:Impact,'Arial Narrow',sans-serif;font-size:15px;border:0;">${ctaText} →</a></div>`
                : ""
            }
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:${COLORS.surface};padding:20px 28px;border-top:1px solid ${COLORS.line};font-size:12px;color:${COLORS.muted};line-height:1.5;">
            ${footerNote ? `<p style="margin:0 0 8px;">${footerNote}</p>` : ""}
            <p style="margin:0;">
              Slugger Athletics · <a href="mailto:apparel@sluggerathletics.com" style="color:${COLORS.brandDark};text-decoration:none;">apparel@sluggerathletics.com</a> · <a href="tel:+13526601232" style="color:${COLORS.brandDark};text-decoration:none;">352-660-1232</a>
            </p>
            <p style="margin:8px 0 0;">
              <a href="https://sluggerathletics.com" style="color:${COLORS.brandDark};text-decoration:none;">sluggerathletics.com</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
