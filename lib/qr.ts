import * as QRCode from 'qrcode';

// Caller must ensure any authorization and record visibility rules before using this helper.
export async function renderQrDataUrl(payload: string): Promise<string> {
  return QRCode.toDataURL(payload, { margin: 1, width: 260 });
}

export function verificationQrPayload(input: { code: string; uid: string; shares: number; amount: number }): string {
  return `NEOBEE HOSPITAL PLC | VERIFY | CODE:${input.code} | UID:${input.uid} | SHARES:${input.shares} | AMOUNT:${input.amount} BDT`;
}
