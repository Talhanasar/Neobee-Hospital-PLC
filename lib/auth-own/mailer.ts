import 'server-only';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const LOGO_ATTACHMENT_NAME = 'neobee-logo.png';

// Clinical Blue palette — mirrors app/globals.css (email clients need inline
// styles and literal hex values, so the tokens are duplicated here).
const COLORS = {
  ink: '#0F1F2B',
  inkSoft: '#3E5666',
  paper: '#F7FAFC',
  line: '#D7E3EC',
  honey: '#0B6E99',
  honeyDeep: '#0A4D6B',
  honeySoft: '#DCEEF6',
  brandNavy: '#1B3B6F',
  brandLeaf: '#76B82A',
  brandNavyDeep: '#0E1C33',
} as const;

export type OtpPurposeLabel = 'EMAIL_VERIFY' | 'PASSWORD_RESET';

// The logo is attached inline (CID) rather than referenced by URL so it
// renders in mail clients that cannot reach a localhost/dev origin.
let logoBase64Cache: string | null | undefined;
function logoBase64(): string | null {
  if (logoBase64Cache !== undefined) return logoBase64Cache;
  try {
    logoBase64Cache = readFileSync(path.join(process.cwd(), 'public', 'images', 'logo_white_back.png')).toString('base64');
  } catch {
    logoBase64Cache = null;
  }
  return logoBase64Cache;
}

function buildTemplate(purpose: OtpPurposeLabel, code: string) {
  const expiryEn = 'This code expires in 5 minutes.';
  const expiryBn = 'এই কোডটি ৫ মিনিটের মধ্যে মেয়াদ শেষ হয়।';

  const heading =
    purpose === 'EMAIL_VERIFY' ? 'Confirm your email address' : 'Reset your password';
  const bodyEn =
    purpose === 'EMAIL_VERIFY'
      ? 'Welcome to the Neobee shareholder family. Use this six-digit code to verify your email and finish your registration.'
      : 'Use this six-digit code to reset your Neobee account password.';
  const bodyBn =
    purpose === 'EMAIL_VERIFY'
      ? 'আপনার ইমেইল নিশ্চিত করতে নিচের ছয় ডিজিটের কোডটি ব্যবহার করুন।'
      : 'আপনার নিউবি পাসওয়ার্ড রিসেট করতে এই ছয় ডিজিটের কোডটি ব্যবহার করুন।';

  const subject =
    purpose === 'EMAIL_VERIFY' ? 'Neobee — verify your email' : 'Neobee — reset your password';

  const logo = logoBase64();
  const logoHtml = logo
    ? `<img src="cid:${LOGO_ATTACHMENT_NAME}" alt="Neobee Hospital" width="140" style="display:block;margin:0 auto;width:140px;height:auto" />`
    : '';
  const wordmarkHtml = `
              <div style="margin-top:10px;font-family:-apple-system,'Segoe UI',Arial,sans-serif;font-size:20px;font-weight:700;color:${COLORS.brandNavy};letter-spacing:-0.02em">Neo<span style="color:${COLORS.brandLeaf}">bee</span> Hospital</div>
              <div style="margin-top:6px;font-family:monospace;font-size:10px;letter-spacing:0.3em;color:${COLORS.inkSoft};text-transform:uppercase">PLC · Chattogram</div>`;

  const html = `<html><body style="margin:0;padding:0;background:${COLORS.paper};font-family:-apple-system,'Segoe UI',Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.paper};padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid ${COLORS.line};border-radius:14px;overflow:hidden">
        <tr><td style="padding:26px 28px 20px;background:#FFFFFF" align="center">
          ${logoHtml}
          ${wordmarkHtml}
        </td></tr>
        <tr><td style="height:4px;background:${COLORS.honey};line-height:4px;font-size:0">&nbsp;</td></tr>
        <tr><td style="padding:28px">
          <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:${COLORS.ink};letter-spacing:-0.02em">${heading}</h1>
          <p style="margin:0 0 6px;font-size:15px;line-height:1.6;color:${COLORS.inkSoft}">${bodyEn}</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:${COLORS.inkSoft}">${bodyBn}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.honeySoft};border-radius:12px">
            <tr><td align="center" style="padding:18px 12px;font-size:34px;font-weight:700;letter-spacing:0.35em;color:${COLORS.honeyDeep};font-family:monospace">${code}</td></tr>
          </table>
          <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:${COLORS.inkSoft}">${expiryEn}</p>
          <p style="margin:4px 0 0;font-size:13px;line-height:1.6;color:${COLORS.inkSoft}">${expiryBn}</p>
          <p style="margin:16px 0 0;font-size:12px;color:${COLORS.inkSoft}">If you didn't request this, you can safely ignore this email. <span style="color:${COLORS.inkSoft}">অনুরোধ না করলে এই ইমেইল উপেক্ষা করুন।</span></p>
        </td></tr>
        <tr><td align="center" style="padding:16px 28px;background:${COLORS.paper};border-top:1px solid ${COLORS.line}">
          <div style="font-size:10px;letter-spacing:0.24em;color:${COLORS.brandLeaf};text-transform:uppercase">Healthier Tomorrow, Together</div>
          <div style="margin-top:6px;font-size:11px;color:${COLORS.inkSoft}">© Neobee Hospital PLC · Chattogram</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = `Neobee Hospital — ${heading}

${bodyEn}
${bodyBn}

Your six-digit code: ${code}
${expiryEn} ${expiryBn}

If you didn't request this, you can safely ignore this email.
© Neobee Hospital PLC · Chattogram`;

  return { subject, html, text, logoAttachment: logo ? { name: LOGO_ATTACHMENT_NAME, content: logo } : null };
}

export async function sendOtpEmail(
  to: string,
  code: string,
  purpose: OtpPurposeLabel,
): Promise<{ ok: true; messageId?: string } | { ok: false; error: string }> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[own-auth] OTP for', to, ':', code);
    }
    return { ok: false, error: 'BREVO_API_KEY not configured' };
  }

  const senderEmail = process.env.BREVO_SENDER_EMAIL ?? 'no-reply@neobeehospital.com';
  const { subject, html, text, logoAttachment } = buildTemplate(purpose, code);

  try {
    const res = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'Neobee Hospital PLC', email: senderEmail },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text,
        ...(logoAttachment ? { attachment: [logoAttachment] } : {}),
      }),
    });

    if (!res.ok) {
      let detail = '';
      try {
        const data = await res.json() as { message?: string };
        detail = typeof data.message === 'string' ? ` — ${data.message}` : '';
      } catch {
        // non-JSON error body
      }
      return { ok: false, error: `Brevo API ${res.status}${detail}` };
    }

    let messageId: string | undefined;
    try {
      const data = await res.json() as { messageId?: unknown };
      if (typeof data.messageId === 'string') {
        messageId = data.messageId;
      }
    } catch {
      // success with a non-JSON body; report without a messageId
    }
    return { ok: true, messageId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'send failed' };
  }
}
