import * as QRCode from 'qrcode';

// Caller must ensure any authorization and record visibility rules before using this helper.
export async function renderQrDataUrl(payload: string): Promise<string> {
  return QRCode.toDataURL(payload, { margin: 1, width: 260 });
}

// NOTE: printed QRs freeze the URL at print time, so set NEXT_PUBLIC_SITE_URL before generating production PDFs.
export function verificationQrPayload(input: { code: string }): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  return `${base.replace(/\/+$/, '')}/verify?code=${encodeURIComponent(input.code)}`;
}
