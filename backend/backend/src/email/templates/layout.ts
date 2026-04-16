/**
 * Shared HTML layout for transactional email.
 *
 * **Single header for every email:** `emailDocument()` always injects `emailHeaderBrand()`
 * (navy gradient + ⭐ tile beside “AdharaEdu” + tagline). Do not build a separate HTML shell;
 * all templates in `transactional.ts` must wrap body content with `emailDocument({ children })`.
 *
 * iOS / Dribbble-inspired: grouped background, white card, hairline separators, pill CTAs.
 */

export const EMAIL_FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Helvetica, Arial, sans-serif';

export const COLORS = {
  bg: '#F2F2F7',
  card: '#FFFFFF',
  text: '#1C1C1E',
  secondary: '#8E8E93',
  separator: '#E5E5EA',
  gold: '#D4A853',
  goldSoft: 'rgba(212, 168, 83, 0.12)',
  blue: '#1E7FD4',
  blueSoft: 'rgba(30, 127, 212, 0.1)',
  danger: '#FF3B30',
  success: '#34C759',
  navy: '#050D1A',
} as const;

/** Escape text for HTML body (not for href/src). */
export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface EmailLayoutOptions {
  /** Shown in inbox preview line (hidden in body). */
  preheader?: string;
  /** Inner HTML only — no outer html/body. Logo + wordmark sit in gradient header above this. */
  children: string;
}

/**
 * Brand strip: icon tile + AdharaEdu wordmark (horizontal), on navy gradient — matches product emails.
 */
export function emailHeaderBrand(): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td style="background:linear-gradient(135deg,#050D1A 0%,#0F1F38 100%);padding:0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding:28px 28px 24px;">
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background:#1E7FD4;width:40px;height:40px;border-radius:11px;text-align:center;vertical-align:middle;font-size:20px;line-height:40px;">⭐</td>
                <td style="padding-left:12px;vertical-align:middle;font-family:Arial Black, Helvetica, Arial, sans-serif;font-size:20px;font-weight:900;color:#ffffff;">Adhara<span style="color:#D4A853">Edu</span></td>
              </tr>
            </table>
            <p style="margin:10px 0 0;font-size:11px;color:rgba(255,255,255,0.55);letter-spacing:0.02em;">Learn Smart. Grow Together</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

/**
 * Full document with meta + hidden preheader + gradient header (logo beside wordmark).
 */
export function emailDocument(opts: EmailLayoutOptions): string {
  const pre = opts.preheader ? escapeHtml(opts.preheader) : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>AdharaEdu</title>
  <!--[if mso]><style type="text/css">table { border-collapse: collapse; }</style><![endif]-->
</head>
<body style="margin:0;padding:0;background:${COLORS.bg};-webkit-font-smoothing:antialiased;">
  ${pre ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${pre}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.bg};">
    <tr>
      <td align="center" style="padding:40px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
          <tr>
            <td style="background:${COLORS.card};border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
              ${emailHeaderBrand()}
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-family:${EMAIL_FONT};color:${COLORS.text};font-size:17px;line-height:1.47;">
                    <!-- Use spacer columns for reliable side padding across email clients -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="24" style="width:24px;font-size:0;line-height:0;">&nbsp;</td>
                        <td style="padding:28px 0;">
                          ${opts.children}
                        </td>
                        <td width="24" style="width:24px;font-size:0;line-height:0;">&nbsp;</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 8px 32px;text-align:center;font-family:${EMAIL_FONT};font-size:12px;line-height:1.5;color:${COLORS.secondary};">
              AdharaEdu · adharaedu.com<br>
              © ${new Date().getFullYear()} AdharaEdu Consultancy &amp; Technology Solutions
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Small caps label row (iOS style section header). */
export function labelCaps(text: string): string {
  return `<p style="margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.secondary};">${escapeHtml(text)}</p>`;
}

/** Primary headline (title). */
export function titleH1(text: string): string {
  return `<h1 style="margin:0 0 8px;font-size:24px;font-weight:700;letter-spacing:-0.4px;color:${COLORS.text};line-height:1.2;">${escapeHtml(text)}</h1>`;
}

/** Plain-text paragraph (escaped). */
export function paragraph(text: string, opts?: { muted?: boolean; small?: boolean }): string {
  const size = opts?.small ? '14px' : '16px';
  const color = opts?.muted ? COLORS.secondary : '#3A3A3C';
  return `<p style="margin:0 0 16px;font-size:${size};line-height:1.55;color:${color};">${escapeHtml(text)}</p>`;
}

/** Trusted HTML paragraph (caller must escape user input). */
export function paragraphHtml(html: string): string {
  return `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#3A3A3C;">${html}</p>`;
}

/** Hairline separator. */
export function separator(): string {
  return `<div style="height:1px;background:${COLORS.separator};margin:20px 0;"></div>`;
}

/** Pill primary CTA button. */
export function ctaButton(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;">
    <tr>
      <td style="border-radius:14px;background:${COLORS.blue};">
        <a href="${href}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;font-family:${EMAIL_FONT};font-size:16px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:14px;">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>`;
}

/** Gold / secondary outline button. */
export function ctaButtonGold(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;">
    <tr>
      <td style="border-radius:14px;background:${COLORS.goldSoft};border:1px solid rgba(212,168,83,0.35);">
        <a href="${href}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 28px;font-family:${EMAIL_FONT};font-size:16px;font-weight:600;color:#6B5A2A;text-decoration:none;border-radius:14px;">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>`;
}

