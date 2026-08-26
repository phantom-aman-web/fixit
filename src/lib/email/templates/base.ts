// Base email layout — email-safe HTML with inline CSS.
// Compatible with Gmail, Outlook, Apple Mail, Yahoo Mail.
// No external CSS, no JavaScript, no web-font loading at render time.
// All user-supplied values MUST be passed through escapeHtml() before insertion.

/**
 * Escapes all HTML special characters in user-controlled strings.
 * MUST be called on every variable before inserting into HTML templates.
 */
export function escapeHtml(unsafe: string): string {
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

/**
 * Formats a currency amount from minor units (e.g. cents/santim) to display string.
 */
export function formatCurrency(minorUnits: number, currency: string): string {
  const major = minorUnits / 100;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(major);
  } catch {
    return `${major.toFixed(2)} ${currency}`;
  }
}

const BRAND_COLOR = "#6366f1"; // Indigo — FixIt brand
const BRAND_DARK = "#4f46e5";
const TEXT_PRIMARY = "#111827";
const TEXT_SECONDARY = "#6b7280";
const BG_PAGE = "#f3f4f6";
const BG_CARD = "#ffffff";
const BORDER = "#e5e7eb";

/**
 * Wraps email body content in the FixIt branded layout.
 * @param content  Pre-escaped inner HTML
 * @param preheader Short preview text shown in email client inboxes
 */
export function emailLayout(content: string, preheader: string): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>FixIt</title>
  <!--[if mso]>
  <noscript>
    <xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
  </noscript>
  <![endif]-->
  <style>
    body { margin: 0; padding: 0; background-color: ${BG_PAGE}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    table { border-collapse: collapse; }
    img { border: 0; display: block; }
    a { color: ${BRAND_COLOR}; }
    .btn-primary { display: inline-block; padding: 12px 28px; background-color: ${BRAND_COLOR}; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px; }
    .btn-primary:hover { background-color: ${BRAND_DARK}; }
    @media (max-width: 600px) {
      .container { width: 100% !important; }
      .card { padding: 24px 20px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${BG_PAGE};">
  <!-- Preheader text (hidden but shown in inbox previews) -->
  <div style="display:none;font-size:1px;color:${BG_PAGE};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    ${escapeHtml(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BG_PAGE};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0">

          <!-- Header -->
          <tr>
            <td style="padding-bottom:20px;text-align:center;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:20px 0;text-align:center;">
                    <span style="font-size:26px;font-weight:800;color:${BRAND_COLOR};letter-spacing:-0.5px;">⚡ FixIt</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td>
              <table role="presentation" class="card" width="100%" cellpadding="0" cellspacing="0"
                     style="background-color:${BG_CARD};border-radius:12px;border:1px solid ${BORDER};padding:40px;">
                <tr>
                  <td>
                    ${content}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:28px 0 8px;text-align:center;">
              <p style="margin:0 0 8px;font-size:12px;color:${TEXT_SECONDARY};">
                FixIt — Universal Equipment Repair Platform
              </p>
              <p style="margin:0 0 8px;font-size:12px;color:${TEXT_SECONDARY};">
                You received this email because of activity on your FixIt account.
              </p>
              <p style="margin:0;font-size:11px;color:${TEXT_SECONDARY};">
                If you did not request this, you can safely ignore it.
                Contact <a href="mailto:support@fixit.app" style="color:${BRAND_COLOR};">support@fixit.app</a> with any questions.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Renders a primary CTA button — link must be a server-validated APP_URL-based URL.
 */
export function ctaButton(label: string, href: string): string {
  // href is always generated server-side from APP_URL — never from request headers.
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0;">
  <tr>
    <td>
      <a href="${href}" class="btn-primary"
         style="display:inline-block;padding:12px 28px;background-color:${BRAND_COLOR};color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:15px;">
        ${label}
      </a>
    </td>
  </tr>
</table>`;
}

/** Renders a key-value info row (e.g. "Equipment: Samsung Washer"). */
export function infoRow(label: string, value: string): string {
  return `<tr>
  <td style="padding:6px 0;font-size:14px;color:${TEXT_SECONDARY};width:140px;vertical-align:top;">${label}</td>
  <td style="padding:6px 0;font-size:14px;color:${TEXT_PRIMARY};font-weight:500;">${value}</td>
</tr>`;
}

/** Wraps info rows in a table. */
export function infoTable(rows: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%"
  style="margin:20px 0;border-top:1px solid ${BORDER};border-bottom:1px solid ${BORDER};padding:12px 0;">
  ${rows}
</table>`;
}

/** Heading style */
export function h1(text: string): string {
  return `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${TEXT_PRIMARY};">${text}</h1>`;
}

/** Body paragraph style */
export function p(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;color:${TEXT_PRIMARY};line-height:1.6;">${text}</p>`;
}

/** Security advisory note */
export function securityNote(text: string): string {
  return `<p style="margin:16px 0 0;font-size:12px;color:${TEXT_SECONDARY};border-top:1px solid ${BORDER};padding-top:12px;">${text}</p>`;
}

/**
 * Generates plain-text version from template data.
 * All URLs are included in full; no HTML.
 */
export function plainTextLayout(lines: string[]): string {
  return lines.join("\n\n") + "\n\n---\nFixIt — Universal Equipment Repair Platform\nSupport: support@fixit.app";
}
