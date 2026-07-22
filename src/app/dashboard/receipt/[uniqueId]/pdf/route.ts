import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";

import { getCurrentStakeholder, requireStakeholder } from "@/lib/auth";
import {
  amountInWords,
  CATEGORY_LABEL,
  fmt,
  qrString,
  SHARE_PRICE,
  type ShareCategory,
} from "@/lib/business";
import { getMyInvestmentByUniqueId } from "@/lib/scoped-db";

// Receipts are personal — never cache across users.
export const dynamic = "force-dynamic";

/**
 * GET /dashboard/receipt/[uniqueId]/pdf
 *
 * Server-side PDF rendering of the digital receipt.
 *
 * SECURITY MODEL (matches the on-screen page):
 *  1. `requireStakeholder()` redirects to /login when there's no session.
 *  2. `getMyInvestmentByUniqueId()` AND's the `uniqueId` with the session
 *     `stakeholderId` at the DB layer. If the row isn't owned by the
 *     caller — or doesn't exist — we return a 404. No probe signal.
 *  3. Amount, amount-in-words, category and branding are all derived from
 *     the DB record on the server. The PDF bytes are produced by pdf-lib
 *     inside this route — no client-controlled values are ever rendered.
 *
 * We use `pdf-lib` (pure JS, no headless browser) so this works under
 * Vercel's serverless runtime without any extra system dependencies.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ uniqueId: string }> },
) {
  // 1. Auth gate.
  await requireStakeholder();

  // 2. Ownership-scoped fetch.
  const { uniqueId } = await params;
  const inv = await getMyInvestmentByUniqueId(uniqueId);
  if (!inv) {
    return new NextResponse("Not found", { status: 404 });
  }

  // 3. Owner identity. Same reasoning as on the page: the current user
  //    IS the owner (otherwise step 2 would have returned null).
  const owner = await getCurrentStakeholder();
  if (!owner) {
    return new NextResponse("Not found", { status: 404 });
  }

  // ----- Render -----------------------------------------------------------
  // BigInt → Number is safe at these magnitudes.
  const amount = Number(inv.amount);
  const incentive = Number(inv.incentiveAmount);

  // Prefer deposit date; fall back to createdAt (matches the page).
  const issueDateSource = inv.depositDate ?? inv.createdAt;
  const issueDateLabel = new Date(issueDateSource).toLocaleDateString(
    "en-GB",
    { day: "2-digit", month: "short", year: "numeric" },
  );

  const qrContent = qrString({
    verificationCode: inv.verificationCode,
    uniqueId: inv.uniqueId,
    shares: inv.shares,
    amount,
  });

  // pdf-lib needs raw PNG bytes — decode the data URL ourselves so the
  // QR is baked into the PDF (not re-fetched, not re-rendered client-side).
  const qrDataUrl = await QRCode.toDataURL(qrContent, {
    width: 240,
    margin: 1,
    color: { dark: "#201D12", light: "#ffffff" },
  });
  const qrPngBytes = dataUrlToBytes(qrDataUrl);

  const pdfBytes = await renderReceiptPdf({
    uniqueId: inv.uniqueId,
    verificationCode: inv.verificationCode,
    issueDateLabel,
    amount,
    incentive,
    category: inv.category as ShareCategory,
    shares: inv.shares,
    depositMethod: inv.depositMethod ?? null,
    paymentReference: inv.paymentReference ?? null,
    status: inv.status,
    owner: {
      name: owner.name,
      phone: owner.phone ?? null,
      email: owner.email ?? null,
      nid: owner.nid ?? null,
    },
    qrPngBytes,
  });

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="neobee-receipt-${inv.uniqueId}.pdf"`,
      // Receipts are personal — never cache at the CDN.
      "Cache-Control": "private, no-store",
    },
  });
}

// ---------------------------------------------------------------------------
// PDF composition
// ---------------------------------------------------------------------------

type RenderArgs = {
  uniqueId: string;
  verificationCode: string;
  issueDateLabel: string;
  amount: number;
  incentive: number;
  category: ShareCategory;
  shares: number;
  depositMethod: string | null;
  paymentReference: string | null;
  status: "PENDING" | "CONFIRMED";
  owner: {
    name: string;
    phone: string | null;
    email: string | null;
    nid: string | null;
  };
  qrPngBytes: Uint8Array;
};

async function renderReceiptPdf(args: RenderArgs): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Neobee Hospital PLC — Receipt ${args.uniqueId}`);
  pdf.setAuthor("Neobee Hospital PLC");
  pdf.setSubject("Digital money receipt");
  pdf.setCreator("Neobee Portal");

  // A4 portrait, with a comfortable print margin.
  const page = pdf.addPage([595.28, 841.89]); // A4 in points
  const margin = 48;
  const pageWidth = page.getWidth();

  // Brand colours, mirrors the on-screen palette.
  const ink = rgb(0x20 / 255, 0x1d / 255, 0x12 / 255); // --ink
  const inkSoft = rgb(0x5c / 255, 0x57 / 255, 0x44 / 255); // --ink-soft
  const line = rgb(0xe9 / 255, 0xe4 / 255, 0xd4 / 255); // --line
  const honey = rgb(0xe9 / 255, 0xa2 / 255, 0x15 / 255); // --honey
  const honeyDeep = rgb(0xa9 / 255, 0x6f / 255, 0x05 / 255); // --honey-deep
  const honeySoft = rgb(0xfb / 255, 0xf0 / 255, 0xd6 / 255); // --honey-soft
  const paper = rgb(0xfd / 255, 0xfc / 255, 0xf7 / 255); // --paper

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdf.embedFont(StandardFonts.Courier);
  const monoBold = await pdf.embedFont(StandardFonts.CourierBold);

  // ---------- Outer border / receipt container ----------
  const top = page.getHeight() - margin;
  const boxLeft = margin;
  const boxTop = top;
  const boxRight = pageWidth - margin;

  // ---------- Header band ----------
  const headerH = 78;
  page.drawRectangle({
    x: boxLeft,
    y: boxTop - headerH,
    width: boxRight - boxLeft,
    height: headerH,
    color: ink,
  });

  // Hex brand mark via SVG path (pdf-lib's `drawSvgPath` is the cleanest
  // way to draw a regular polygon — there is no `drawPolygon` primitive).
  drawHexMark(page, {
    cx: boxLeft + 24,
    cy: boxTop - headerH / 2,
    r: 16,
    honey,
    fill: ink,
    text: "N",
    font: fontBold,
    textColor: honeyDeep,
  });

  // Title.
  page.drawText("Neobee Hospital PLC", {
    x: boxLeft + 50,
    y: boxTop - 32,
    size: 13,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  page.drawText("DIGITAL MONEY RECEIPT", {
    x: boxLeft + 50,
    y: boxTop - 50,
    size: 8,
    font: mono,
    color: rgb(0xcf / 255, 0xc9 / 255, 0xb4 / 255),
  });

  // Right side: UID + issue date.
  const rightLabel = "Receipt / UID";
  const rightLabelW = font.widthOfTextAtSize(rightLabel, 8);
  page.drawText(rightLabel, {
    x: boxRight - rightLabelW - 4,
    y: boxTop - 24,
    size: 8,
    font: mono,
    color: rgb(0xcf / 255, 0xc9 / 255, 0xb4 / 255),
  });
  const uidText = args.uniqueId;
  const uidW = monoBold.widthOfTextAtSize(uidText, 13);
  page.drawText(uidText, {
    x: boxRight - uidW - 4,
    y: boxTop - 40,
    size: 13,
    font: monoBold,
    color: honey,
  });
  const dateW = mono.widthOfTextAtSize(args.issueDateLabel, 9);
  page.drawText(args.issueDateLabel, {
    x: boxRight - dateW - 4,
    y: boxTop - 56,
    size: 9,
    font: mono,
    color: rgb(0xcf / 255, 0xc9 / 255, 0xb4 / 255),
  });

  // ---------- Body: rows + QR column ----------
  const bodyTop = boxTop - headerH - 24;
  const qrColW = 150;
  const qrColX = boxRight - qrColW;
  const rowsX = boxLeft + 4;
  const rowsRight = qrColX - 18;
  const rowsWidth = rowsRight - rowsX;

  let y = bodyTop;

  type Row = {
    label: string;
    value: string;
    mono?: boolean;
    bold?: boolean;
  };

  const rows: Row[] = [];
  rows.push({ label: "Received from", value: args.owner.name, bold: true });
  if (args.owner.phone || args.owner.email) {
    rows.push({
      label: "Contact",
      value: (args.owner.phone ?? args.owner.email) as string,
      mono: true,
    });
  }
  if (args.owner.nid) {
    rows.push({
      label: "NID / passport",
      value: args.owner.nid,
      mono: true,
    });
  }
  rows.push({
    label: "Category",
    value: CATEGORY_LABEL[args.category],
    bold: true,
  });
  rows.push({
    label: "Shares",
    value: `${args.shares} × ${fmt(SHARE_PRICE)}`,
    mono: true,
  });
  if (args.incentive > 0) {
    rows.push({
      label: "Share incentive",
      value: `${fmt(args.incentive)} (bonus shares)`,
      mono: true,
    });
  }
  rows.push({
    label: "Deposit method",
    value: args.depositMethod ?? "—",
  });
  if (args.paymentReference) {
    rows.push({
      label: "Bank / payment reference",
      value: args.paymentReference,
      mono: true,
    });
  }
  rows.push({
    label: "Verification code",
    value: args.verificationCode,
    mono: true,
    bold: true,
  });
  rows.push({
    label: "Status",
    value:
      args.status === "CONFIRMED"
        ? "Confirmed by investor"
        : "Pending investor confirmation",
  });

  const rowGap = 18;
  for (const r of rows) {
    // Dashed divider at the bottom of the row.
    drawDashedLine(page, rowsX, y - 2, rowsRight, y - 2, line, 2, 3);

    page.drawText(r.label, {
      x: rowsX,
      y,
      size: 10,
      font: font,
      color: inkSoft,
    });
    const valueFont = r.bold
      ? r.mono
        ? monoBold
        : fontBold
      : r.mono
        ? mono
        : font;
    drawRightAlignedText(page, r.value, rowsRight, y, 10, valueFont, ink);

    y -= rowGap;
  }

  // ---------- Amount block (honey-soft highlight) ----------
  const amtBlockH = 36;
  const amtBlockY = y - amtBlockH;
  page.drawRectangle({
    x: rowsX,
    y: amtBlockY,
    width: rowsWidth,
    height: amtBlockH,
    color: honeySoft,
    borderColor: honeySoft,
    borderWidth: 0,
  });

  page.drawText("AMOUNT", {
    x: rowsX + 10,
    y: amtBlockY + 22,
    size: 9,
    font: fontBold,
    color: honeyDeep,
  });
  const amtText = fmt(args.amount);
  const amtTextSize = 16;
  const amtFont = monoBold;
  const amtW = amtFont.widthOfTextAtSize(amtText, amtTextSize);
  page.drawText(amtText, {
    x: rowsRight - amtW,
    y: amtBlockY + (amtBlockH - amtTextSize) / 2 + 2,
    size: amtTextSize,
    font: amtFont,
    color: ink,
  });

  // Amount-in-words italic line.
  const words = `${args.amount > 0 ? amountInWords(args.amount) : "Zero"} taka only`;
  page.drawText(words, {
    x: rowsX + 10,
    y: amtBlockY - 14,
    size: 9,
    font: font,
    color: inkSoft,
  });

  // ---------- QR column ----------
  const qrPng = await pdf.embedPng(args.qrPngBytes);
  const qrSize = 120;
  const qrX = qrColX + (qrColW - qrSize) / 2;
  // Anchor the QR vertically so it sits roughly mid-body.
  const qrY = bodyTop - qrSize - 16;
  page.drawImage(qrPng, {
    x: qrX,
    y: qrY,
    width: qrSize,
    height: qrSize,
  });

  // Verification code pill under the QR.
  const codeText = args.verificationCode;
  const codeSize = 11;
  const codeW = monoBold.widthOfTextAtSize(codeText, codeSize);
  const pillPadX = 10;
  const pillPadY = 6;
  const pillW = codeW + pillPadX * 2;
  const pillH = codeSize + pillPadY * 2;
  const pillX = qrColX + (qrColW - pillW) / 2;
  const pillY = qrY - pillH - 8;
  page.drawRectangle({
    x: pillX,
    y: pillY,
    width: pillW,
    height: pillH,
    color: paper,
    borderColor: honeyDeep,
    borderWidth: 1,
    borderDashArray: [3, 2],
  });
  page.drawText(codeText, {
    x: pillX + pillPadX,
    y: pillY + pillPadY + 1,
    size: codeSize,
    font: monoBold,
    color: inkSoft,
  });

  // QR caption.
  const capY = pillY - 12;
  drawCenteredText(
    page,
    "Scan to verify this receipt on the Neobee portal.",
    qrColX + qrColW / 2,
    capY,
    8,
    font,
    inkSoft,
  );

  // ---------- Footer ----------
  const footerY = margin + 12;
  const footerBrandY = margin + 26;
  // Solid divider above footer.
  page.drawLine({
    start: { x: boxLeft, y: margin + 36 },
    end: { x: boxRight, y: margin + 36 },
    thickness: 0.5,
    color: line,
  });

  const footerBrand = "Neobee Hospital PLC";
  const footerLeft =
    "Deposits are made to the NEOBEE institutional account only.";
  const footerRight = "Digital services by NeoTech";

  page.drawText(footerBrand, {
    x: boxLeft,
    y: footerBrandY,
    size: 9,
    font: fontBold,
    color: ink,
  });
  page.drawText(footerLeft, {
    x: boxLeft,
    y: footerY,
    size: 9,
    font: font,
    color: inkSoft,
  });
  drawRightAlignedText(page, footerRight, boxRight, footerY, 9, font, inkSoft);

  // Outer receipt border.
  page.drawRectangle({
    x: boxLeft,
    y: margin,
    width: boxRight - boxLeft,
    height: boxTop - margin,
    borderColor: line,
    borderWidth: 1,
  });

  return await pdf.save();
}

// ---------------------------------------------------------------------------
// Tiny drawing helpers — keep the route file self-contained.
// ---------------------------------------------------------------------------

function drawDashedLine(
  page: ReturnType<PDFDocument["addPage"]>,
  x1: number,
  y: number,
  x2: number,
  _y2: number,
  color: ReturnType<typeof rgb>,
  thickness = 1,
  dash = 3,
) {
  let x = x1;
  while (x < x2) {
    const end = Math.min(x + dash, x2);
    page.drawLine({
      start: { x, y },
      end: { x: end, y },
      thickness,
      color,
    });
    x = end + dash;
  }
}

function drawRightAlignedText(
  page: ReturnType<PDFDocument["addPage"]>,
  text: string,
  rightX: number,
  y: number,
  size: number,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  color: ReturnType<typeof rgb>,
) {
  // Trim if the value would overflow the rows column — preserves layout.
  let t = text;
  const maxWidth = (rightX - (page.getWidth() - 595.28) / 2) * 0.55; // ~rows width
  if (font.widthOfTextAtSize(t, size) > maxWidth && t.length > 8) {
    while (t.length > 4 && font.widthOfTextAtSize(t + "…", size) > maxWidth) {
      t = t.slice(0, -1);
    }
    t = t + "…";
  }
  const w = font.widthOfTextAtSize(t, size);
  page.drawText(t, {
    x: rightX - w,
    y,
    size,
    font,
    color,
  });
}

function drawCenteredText(
  page: ReturnType<PDFDocument["addPage"]>,
  text: string,
  cx: number,
  y: number,
  size: number,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  color: ReturnType<typeof rgb>,
) {
  const w = font.widthOfTextAtSize(text, size);
  page.drawText(text, {
    x: cx - w / 2,
    y,
    size,
    font,
    color,
  });
}

function drawHexMark(
  page: ReturnType<PDFDocument["addPage"]>,
  opts: {
    cx: number;
    cy: number;
    r: number;
    honey: ReturnType<typeof rgb>;
    fill: ReturnType<typeof rgb>;
    text: string;
    font: Awaited<ReturnType<PDFDocument["embedFont"]>>;
    textColor: ReturnType<typeof rgb>;
  },
) {
  const { cx, cy, r, honey, fill, text, font, textColor } = opts;
  // Build an SVG path string for a pointy-top hexagon centred at (cx,cy).
  // Using `drawSvgPath` because pdf-lib has no dedicated polygon API.
  const hexPath = (scale: number): string => {
    const pts: [number, number][] = [
      [cx, cy + r * scale],
      [cx + ((r * scale * Math.sqrt(3)) / 2), cy + (r * scale) / 2],
      [cx + ((r * scale * Math.sqrt(3)) / 2), cy - (r * scale) / 2],
      [cx, cy - r * scale],
      [cx - ((r * scale * Math.sqrt(3)) / 2), cy - (r * scale) / 2],
      [cx - ((r * scale * Math.sqrt(3)) / 2), cy + (r * scale) / 2],
    ];
    return (
      pts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`).join(" ") +
      " Z"
    );
  };
  // Outer hex (honey).
  page.drawSvgPath(hexPath(1), { color: honey, borderColor: honey });
  // Inner hex (ink) — slightly smaller.
  page.drawSvgPath(hexPath(0.6), { color: fill, borderColor: fill });
  // "N" mark, centered.
  const sz = 9;
  const w = font.widthOfTextAtSize(text, sz);
  page.drawText(text, {
    x: cx - w / 2,
    y: cy - sz / 2 - 1,
    size: sz,
    font,
    color: textColor,
  });
}

/**
 * Convert a `data:image/png;base64,…` URL into raw PNG bytes that
 * pdf-lib's `embedPng` can consume.
 */
function dataUrlToBytes(dataUrl: string): Uint8Array {
  const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (!m) {
    throw new Error("Expected a base64 data URL from qrcode");
  }
  const b64 = m[2];
  // Use Buffer when available (Node runtime) — pdf-lib expects a Uint8Array
  // view, and Buffer's underlying memory is one.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const B: any = (globalThis as any).Buffer;
  if (B && typeof B.from === "function") {
    return new Uint8Array(B.from(b64, "base64"));
  }
  // Browser fallback (not used in route handlers, but kept defensive).
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
