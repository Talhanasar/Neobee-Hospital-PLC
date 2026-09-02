import 'server-only';

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

export type OtpPurposeLabel = 'EMAIL_VERIFY' | 'PASSWORD_RESET';

function buildTemplate(purpose: OtpPurposeLabel, code: string) {
  const expiry = 'This code expires in 10 minutes.';
  if (purpose === 'EMAIL_VERIFY') {
    return {
      subject: 'Neobee — verify your email',
      html: `<html><body style="font-family:system-ui,Arial,sans-serif">
  <h1 style="font-size:2rem">Verify your Neobee account</h1>
  <p>Your verification code:</p>
  <p style="font-size:3rem;font-weight:bold;letter-spacing:.25em">${code}</p>
  <p>${expiry}</p>
  <hr>
  <p style="font-size:1.25rem">নিউবি হাসাব যাচাই করুন</p>
  <p>আপনার যাচাইকরণ কোড:</p>
  <p style="font-size:3rem;font-weight:bold;letter-spacing:.25em">${code}</p>
  <p>${expiry} (এই কোডটি ১০ মিনিটের মধ্যে মেয়াদ শেষ হয়)।</p>
</body></html>`,
      text: `Neobee — email verification

Your verification code: ${code}
${expiry}

নিউবি হাসাব যাচাই করুন — আপনার যাচাইকরণ কোড: ${code}
${expiry} (এই কোডটি ১০ মিনিটের মধ্যে মেয়াদ শেষ হয়)।`,
    };
  }
  return {
    subject: 'Neobee — reset your password',
    html: `<html><body style="font-family:system-ui,Arial,sans-serif">
  <h1 style="font-size:2rem">Reset your Neobee password</h1>
  <p>Your password reset code:</p>
  <p style="font-size:3rem;font-weight:bold;letter-spacing:.25em">${code}</p>
  <p>${expiry}</p>
  <hr>
  <p style="font-size:1.25rem">নিউবি পাসওয়ার্ড রিসেট করুন</p>
  <p>আপনার পাসওয়ার্ড রিসেট কোড:</p>
  <p style="font-size:3rem;font-weight:bold;letter-spacing:.25em">${code}</p>
  <p>${expiry} (এই কোডটি ১০ মিনিটের মধ্যে মেয়াদ শেষ হয়)।</p>
</body></html>`,
    text: `Neobee — password reset

Your password reset code: ${code}
${expiry}

নিউবি পাসওয়ার্ড রিসেট করুন — আপনার পাসওয়ার্ড রিসেট কোড: ${code}
${expiry} (এই কোডটি ১০ মিনিটের মধ্যে মেয়াদ শেষ হয়)।`,
  };
}

export async function sendOtpEmail(
  to: string,
  code: string,
  purpose: OtpPurposeLabel,
): Promise<{ ok: true; messageId?: string } | { ok: false; error: string }> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    return { ok: false, error: 'BREVO_API_KEY not configured' };
  }

  const senderEmail = process.env.BREVO_SENDER_EMAIL ?? 'no-reply@neobeehospital.com';
  const { subject, html, text } = buildTemplate(purpose, code);

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
