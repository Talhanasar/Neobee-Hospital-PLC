// Business constants — verbatim from approved prototype
export const SHARE_PRICE = 200_000;            // ৳2,00,000 per share
export const INCENTIVE_PER_SHARE = 20_000;     // ৳20,000 bonus per entrepreneur share
export const PROJECT_TARGET = 3_000_000_000;   // ৳300 crore
export const TOTAL_SHARES = 15_000;
export const ENTREPRENEUR_SLOTS = 50;
export const FOUNDING_SUBTARGET = 100_000_000; // ৳10 crore
export const FOUNDING_ENTRY = 2_000_000;       // ৳20,00,000 entry per entrepreneur

export type ShareCategory = "SHAREHOLDER" | "PREMIUM" | "DIRECTOR";

// Ported from prototype categoryFor(). Stored as enum; UI shows shorthand labels.
export function categoryFor(shares: number): ShareCategory {
  if (shares >= 10) return "DIRECTOR";
  if (shares >= 5) return "PREMIUM";
  return "SHAREHOLDER";
}

// UI shorthand labels (per build spec): Shareholder / Premium / Director
export const CATEGORY_LABEL: Record<ShareCategory, string> = {
  SHAREHOLDER: "Shareholder",
  PREMIUM: "Premium",
  DIRECTOR: "Director",
};

export function catClass(cat: ShareCategory): string {
  return cat === "DIRECTOR" ? "director" : cat === "PREMIUM" ? "premium" : "share";
}

export function amountFor(shares: number): number {
  return shares * SHARE_PRICE;
}

export function incentiveFor(shares: number, isFoundingEntrepreneur: boolean): number {
  return isFoundingEntrepreneur ? shares * INCENTIVE_PER_SHARE : 0;
}

// Currency formatter — Bangladeshi ৳ with lakh/crore grouping.
// Prototype used fmt() rendering "৳" + Indian-grouped digits.
export function fmt(n: number | bigint): string {
  const num = typeof n === "bigint" ? Number(n) : n;
  // Indian/Bangladeshi digit grouping (##,##,###)
  const s = Math.round(num).toString();
  const neg = s.startsWith("-");
  const digits = neg ? s.slice(1) : s;
  let out: string;
  if (digits.length <= 3) {
    out = digits;
  } else {
    const last3 = digits.slice(-3);
    let rest = digits.slice(0, -3);
    const parts: string[] = [];
    while (rest.length > 2) {
      parts.unshift(rest.slice(-2));
      rest = rest.slice(0, -2);
    }
    if (rest.length) parts.unshift(rest);
    out = parts.join(",") + "," + last3;
  }
  return "৳" + (neg ? "-" : "") + out;
}

// amountInWords — ported VERBATIM from prototype (Indian/Bangladeshi numbering).
export function amountInWords(input: number | bigint): string {
  let n = typeof input === "bigint" ? Number(input) : input;
  if (n === 0) return "zero";
  const ones = ["","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"];
  const tens = ["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"];
  const two = (x: number): string => x < 20 ? ones[x] : tens[Math.floor(x / 10)] + (x % 10 ? " " + ones[x % 10] : "");
  const three = (x: number): string => (x >= 100 ? ones[Math.floor(x / 100)] + " hundred" + (x % 100 ? " " : "") : "") + (x % 100 ? two(x % 100) : "");
  const out: string[] = [];
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thou = Math.floor(n / 1000); n %= 1000;
  if (crore) out.push(two(crore) + " crore");
  if (lakh) out.push(two(lakh) + " lakh");
  if (thou) out.push(two(thou) + " thousand");
  if (n) out.push(three(n));
  const s = out.join(" ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// QR content string — VERBATIM format from prototype.
export function qrString(rec: { verificationCode: string; uniqueId: string; shares: number; amount: number | bigint }): string {
  const amt = typeof rec.amount === "bigint" ? rec.amount.toString() : rec.amount;
  return `NEOBEE HOSPITAL PLC | VERIFY | CODE:${rec.verificationCode} | UID:${rec.uniqueId} | SHARES:${rec.shares} | AMOUNT:${amt} BDT`;
}

// Extract a verification code or UID from raw scanned/typed input — ported from prototype extractCode().
export function extractCode(raw: string): { code?: string; uid?: string } {
  const s = String(raw).toUpperCase();
  const m = s.match(/NB-[A-Z0-9]{6}/); if (m) return { code: m[0] };
  const u = s.match(/NEO-\d{4}/); if (u) return { uid: u[0] };
  return { code: s.trim() };
}
