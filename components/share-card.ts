'use client';

/**
 * Shareable PNG card drawn on a <canvas> so nothing leaves the device —
 * no network, no backend. Ported from the reference prototype.
 *
 *   drawProjectCard — public "project at a glance" (ZERO fundraising
 *                     figures — marketing-safe by construction)
 *
 * Font note: next/font obfuscates family names, so we probe computed
 * styles for the real stacks instead of hardcoding "Archivo"/"Inter".
 */

export interface ProjectCardData {
  beds: number; // 200
  phases: number; // 3
  services: string[]; // short labels for the service row
  location: string; // e.g. "Chattogram, Bangladesh"
}

/* ── helpers ──────────────────────────────────────────────────── */

const nf = new Intl.NumberFormat('en-IN');

function hexPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, pointyTop = false) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i + (pointyTop ? -90 : 0));
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ── palette (locked design tokens) ───────────────────────────── */
const C = {
  paper: '#F7FAFC',
  panel: '#FFFFFF',
  line: '#D7E3EC',
  ink: '#0F1F2B',
  inkSoft: '#3E5666',
  honey: '#0B6E99',
  honeyDeep: '#0A4D6B',
  honeySoft: '#DCEEF6',
};

/* ── shared card machinery ──────────────────────────────────────
   1080×1350 on paper with a hexagon lattice, a white content panel,
   the hexagon logo + wordmark + mono kicker, and the Bangla
   signature + watermark + footer. Only the middle differs. */

interface Fonts {
  display: (px: number, weight?: number) => string;
  body: (px: number, weight?: number) => string;
  mono: (px: number, weight?: number) => string;
}

function fontStackOf(className: string, fallback: string): string {
  try {
    const probe = document.createElement('span');
    probe.className = className;
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    document.body.appendChild(probe);
    const stack = getComputedStyle(probe).fontFamily;
    probe.remove();
    return stack || fallback;
  } catch {
    return fallback;
  }
}

async function prepareCanvas(
  canvas: HTMLCanvasElement,
): Promise<{ ctx: CanvasRenderingContext2D; f: Fonts; W: number; H: number } | null> {
  try {
    await document.fonts.ready;
  } catch {
    /* older browsers — draw with fallbacks */
  }
  const display = fontStackOf('font-display', 'sans-serif');
  const body = fontStackOf('font-body', 'sans-serif');
  const mono = fontStackOf('num', 'monospace');
  const f: Fonts = {
    display: (px, weight = 700) => `${weight} ${px}px ${display}`,
    body: (px, weight = 400) => `${weight} ${px}px ${body}`,
    mono: (px, weight = 500) => `${weight} ${px}px ${mono}`,
  };

  const W = 1080;
  const H = 1350;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.aspectRatio = '1080 / 1350';

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(dpr, dpr);
  return { ctx, f, W, H };
}

/** Paper background + hexagon lattice + white content panel. */
function paintBase(ctx: CanvasRenderingContext2D, W: number, H: number) {
  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = 'rgba(233, 228, 212, 0.5)';
  ctx.lineWidth = 1;
  const hr = 34;
  const hw = hr * Math.sqrt(3);
  for (let row = -1; row < H / (hr * 1.5) + 1; row++) {
    for (let col = -1; col < W / hw + 1; col++) {
      const cx = col * hw + (row % 2 ? hw / 2 : 0);
      const cy = row * hr * 1.5;
      hexPath(ctx, cx, cy, hr - 3, true);
      ctx.stroke();
    }
  }

  ctx.fillStyle = C.panel;
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 2;
  roundRect(ctx, 48, 48, W - 96, H - 96, 28);
  ctx.fill();
  ctx.stroke();
}

/** Hexagon logo + wordmark + spaced mono kicker, then a hairline divider. */
function paintBrand(ctx: CanvasRenderingContext2D, f: Fonts, W: number, kicker: string) {
  const logoCx = 128;
  const logoCy = 150;
  ctx.fillStyle = C.honey;
  hexPath(ctx, logoCx, logoCy, 44, true);
  ctx.fill();
  ctx.fillStyle = C.panel;
  roundRect(ctx, logoCx - 8, logoCy - 22, 16, 44, 4);
  ctx.fill();
  roundRect(ctx, logoCx - 22, logoCy - 8, 44, 16, 4);
  ctx.fill();

  ctx.fillStyle = C.ink;
  ctx.font = f.display(34);
  ctx.textBaseline = 'middle';
  ctx.fillText('Neobee Hospital PLC', 196, 140);
  ctx.fillStyle = C.honeyDeep;
  ctx.font = f.mono(15, 600);
  ctx.fillText(kicker, 196, 172);

  ctx.strokeStyle = C.line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(96, 224);
  ctx.lineTo(W - 96, 224);
  ctx.stroke();
}

/** Bangla signature line, watermark hexagon and footer. */
function paintClose(ctx: CanvasRenderingContext2D, f: Fonts, W: number) {
  ctx.fillStyle = C.inkSoft;
  ctx.font = f.body(24, 500);
  ctx.textAlign = 'center';
  ctx.fillText('কমার্শিয়াল কিন্তু মানবিক — building humane healthcare', W / 2, 986);

  ctx.strokeStyle = 'rgba(215, 227, 236, 0.9)';
  ctx.lineWidth = 2;
  hexPath(ctx, W / 2, 1120, 64, true);
  ctx.stroke();
  ctx.fillStyle = C.honey;
  hexPath(ctx, W / 2, 1120, 26, true);
  ctx.fill();

  ctx.fillStyle = C.inkSoft;
  ctx.font = f.mono(16);
  ctx.fillText('neobeehospital.com  ·  Chattogram, Bangladesh', W / 2, 1218);
  ctx.textAlign = 'left';
}
/* ── public "project at a glance" card ──────────────────────────
   STRICTLY project facts (beds, services, phases, location,
   ownership) — no fundraising figures anywhere. */

export async function drawProjectCard(canvas: HTMLCanvasElement, data: ProjectCardData): Promise<void> {
  const prepared = await prepareCanvas(canvas);
  if (!prepared) return;
  const { ctx, f, W, H } = prepared;

  paintBase(ctx, W, H);
  paintBrand(ctx, f, W, 'P R O J E C T   A T   A   G L A N C E');

  /* headline */
  ctx.fillStyle = C.inkSoft;
  ctx.font = f.mono(17, 500);
  ctx.fillText('WHAT WE ARE BUILDING', 96, 282);
  ctx.fillStyle = C.ink;
  ctx.font = f.display(46, 800);
  ctx.fillText('A hospital built', 96, 342);
  ctx.fillText('by its people.', 96, 396);
  ctx.fillStyle = C.honeyDeep;
  ctx.font = f.mono(20);
  ctx.fillText('SHAREHOLDER-OWNED  ·  MULTIDISCIPLINARY', 96, 452);

  /* fact tiles — 2×2 */
  const tiles = [
    { label: 'PLANNED BEDS', value: `${nf.format(data.beds)}+` },
    { label: 'EMERGENCY', value: '24/7' },
    { label: 'BUILD PHASES', value: nf.format(data.phases) },
    { label: 'LOCATION', value: data.location },
  ];
  const tileW = (W - 192 - 24) / 2;
  const tileH = 132;
  tiles.forEach((t, i) => {
    const tx = 96 + (i % 2) * (tileW + 24);
    const ty = 512 + Math.floor(i / 2) * (tileH + 24);
    ctx.fillStyle = C.honeySoft;
    roundRect(ctx, tx, ty, tileW, tileH, 18);
    ctx.fill();
    ctx.fillStyle = C.honey;
    hexPath(ctx, tx + tileW - 30, ty + 30, 12, true);
    ctx.fill();
    ctx.fillStyle = C.honeyDeep;
    ctx.font = f.mono(15, 600);
    ctx.fillText(t.label, tx + 24, ty + 38);
    /* location tile is long — shrink to fit */
    ctx.fillStyle = C.ink;
    const value = t.value;
    let px = 30;
    ctx.font = f.display(px);
    while (ctx.measureText(value).width > tileW - 48 && px > 18) {
      px -= 2;
      ctx.font = f.display(px);
    }
    ctx.fillText(value, tx + 24, ty + 88);
  });

  /* services row */
  ctx.fillStyle = C.inkSoft;
  ctx.font = f.mono(15, 600);
  ctx.fillText('SERVICES, PLANNED END TO END', 96, 826);
  ctx.font = f.body(24, 500);
  ctx.fillStyle = C.ink;
  ctx.fillText(data.services.join('  ·  '), 96, 868);

  paintClose(ctx, f, W);
}

/** Trigger a PNG download of the given canvas. */
export function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
  try {
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch {
    /* ignore */
  }
}
