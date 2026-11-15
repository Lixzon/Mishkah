/**
 * Offline share-card renderer. User-facing card backgrounds are bundled
 * photographs of landscapes and architecture; no people or animals are shown.
 */

export type CardFormat = 'square' | 'story';

export interface CardContent {
  surahName: string;
  surahNumber: number;
  ayahFrom: number;
  ayahTo?: number;
  arabic: string;
  translation: string;
}

export interface CardOptions {
  content: CardContent;
  format: CardFormat;
  preset: CardPresetId;
  showBadge: boolean;
}

export type CardPresetId =
  | 'dawn-dunes'
  | 'night-sky'
  | 'mihrab'
  | 'ocean-horizon'
  | 'forest-mist'
  | 'desert-moon'
  | 'geometry'
  | 'aurora'
  | 'stone-dome'
  | 'parchment'
  | 'photo-ocean'
  | 'photo-snow'
  | 'photo-sky'
  | 'photo-skyline'
  | 'photo-mountain-starry'
  | 'photo-mountain-valley'
  | 'photo-alpine-range'
  | 'photo-forest-sunrise'
  | 'photo-lakeshore';

type Painter = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

export interface CardPreset {
  id: CardPresetId;
  label: string;
  swatch: [string, string];
  paint?: Painter;
  image?: string;
}

const SIZE: Record<CardFormat, { width: number; height: number }> = {
  square: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
};

/* ------------------------------- helpers ------------------------------- */

function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function verticalFill(ctx: CanvasRenderingContext2D, w: number, h: number, stops: Array<[number, string]>): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  for (const [offset, color] of stops) gradient.addColorStop(offset, color);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
}

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string): void {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function stars(ctx: CanvasRenderingContext2D, w: number, h: number, count: number, alpha: number): void {
  const random = prng(w * 31 + h);
  ctx.save();
  for (let i = 0; i < count; i++) {
    const x = random() * w;
    const y = random() * h;
    const r = random() * 1.6 + 0.4;
    ctx.globalAlpha = alpha * (0.35 + random() * 0.65);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function ridge(
  ctx: CanvasRenderingContext2D,
  w: number,
  baseY: number,
  amplitude: number,
  color: string,
  seed: number,
): void {
  const random = prng(seed);
  ctx.beginPath();
  ctx.moveTo(0, baseY);
  const steps = 6;
  for (let i = 0; i <= steps; i++) {
    const x = (w / steps) * i;
    const y = baseY - Math.sin((i / steps) * Math.PI) * amplitude * (0.55 + random() * 0.7);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, baseY + w);
  ctx.lineTo(0, baseY + w);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function archPath(ctx: CanvasRenderingContext2D, cx: number, baseY: number, width: number, height: number): void {
  const half = width / 2;
  ctx.beginPath();
  ctx.moveTo(cx - half, baseY);
  ctx.lineTo(cx - half, baseY - height + half);
  ctx.quadraticCurveTo(cx - half, baseY - height, cx, baseY - height);
  ctx.quadraticCurveTo(cx + half, baseY - height, cx + half, baseY - height + half);
  ctx.lineTo(cx + half, baseY);
  ctx.closePath();
}

/* ------------------------------- presets ------------------------------- */

const ILLUSTRATED_PRESETS: CardPreset[] = [
  {
    id: 'dawn-dunes',
    label: 'Dawn dunes',
    swatch: ['#f7c78a', '#8c5a3c'],
    paint: (ctx, w, h) => {
      verticalFill(ctx, w, h, [
        [0, '#f8d9a8'],
        [0.45, '#e9a973'],
        [1, '#7d4b34'],
      ]);
      glow(ctx, w * 0.72, h * 0.22, w * 0.5, 'rgba(255,236,196,0.65)');
      ridge(ctx, w, h * 0.68, h * 0.16, 'rgba(150,96,62,0.55)', 7);
      ridge(ctx, w, h * 0.82, h * 0.2, 'rgba(96,58,40,0.75)', 12);
      ridge(ctx, w, h * 0.94, h * 0.14, 'rgba(58,35,26,0.9)', 21);
    },
  },
  {
    id: 'night-sky',
    label: 'Night sky',
    swatch: ['#0b1a33', '#3b2d63'],
    paint: (ctx, w, h) => {
      verticalFill(ctx, w, h, [
        [0, '#050a18'],
        [0.55, '#0d1c38'],
        [1, '#1b1230'],
      ]);
      ctx.save();
      ctx.translate(w * 0.5, h * 0.45);
      ctx.rotate(-0.42);
      const band = ctx.createLinearGradient(0, -h * 0.2, 0, h * 0.2);
      band.addColorStop(0, 'rgba(120,160,255,0)');
      band.addColorStop(0.5, 'rgba(160,180,255,0.22)');
      band.addColorStop(1, 'rgba(120,160,255,0)');
      ctx.fillStyle = band;
      ctx.fillRect(-w, -h * 0.2, w * 2, h * 0.4);
      ctx.restore();
      stars(ctx, w, h, 220, 0.9);
      glow(ctx, w * 0.18, h * 0.16, w * 0.3, 'rgba(120,160,255,0.28)');
    },
  },
  {
    id: 'mihrab',
    label: 'Mihrab arches',
    swatch: ['#0f4c4a', '#0a2a2b'],
    paint: (ctx, w, h) => {
      verticalFill(ctx, w, h, [
        [0, '#10514d'],
        [0.6, '#0b3233'],
        [1, '#071e21'],
      ]);
      ctx.save();
      ctx.lineWidth = Math.max(2, w * 0.004);
      for (let i = 0; i < 4; i++) {
        ctx.strokeStyle = `rgba(210,235,225,${0.26 - i * 0.05})`;
        const inset = i * w * 0.055;
        archPath(ctx, w / 2, h * 0.98, w * 0.78 - inset * 2, h * 0.86 - inset);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.beginPath();
      ctx.moveTo(w * 0.5, h * 0.12);
      ctx.lineTo(w * 0.5, h * 0.98);
      ctx.stroke();
      ctx.restore();
    },
  },
  {
    id: 'ocean-horizon',
    label: 'Ocean horizon',
    swatch: ['#2a6f8f', '#0a2233'],
    paint: (ctx, w, h) => {
      verticalFill(ctx, w, h, [
        [0, '#1d4f6b'],
        [0.48, '#5fa6b8'],
        [0.5, '#123a4e'],
        [1, '#061722'],
      ]);
      glow(ctx, w * 0.5, h * 0.47, w * 0.34, 'rgba(255,224,170,0.55)');
      ctx.fillStyle = 'rgba(255,236,196,0.85)';
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.44, w * 0.045, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      for (let i = 0; i < 26; i++) {
        const y = h * 0.52 + (i / 26) * h * 0.46;
        const inset = w * (0.05 + i * 0.012);
        ctx.globalAlpha = 0.16 - i * 0.004;
        ctx.fillStyle = '#d8f2ff';
        ctx.fillRect(inset, y, w - inset * 2, Math.max(2, h * 0.004));
      }
      ctx.restore();
    },
  },
  {
    id: 'forest-mist',
    label: 'Forest mist',
    swatch: ['#2f5a4a', '#0a1f1a'],
    paint: (ctx, w, h) => {
      verticalFill(ctx, w, h, [
        [0, '#cfe0d8'],
        [0.35, '#83a696'],
        [1, '#132b24'],
      ]);
      const layers: Array<[number, string, number]> = [
        [0.55, 'rgba(56,98,80,0.55)', 3],
        [0.7, 'rgba(34,74,60,0.7)', 8],
        [0.85, 'rgba(20,52,42,0.85)', 15],
      ];
      for (const [y, color, seed] of layers) ridge(ctx, w, h * y, h * 0.18, color, seed);
      ctx.fillStyle = 'rgba(220,238,228,0.18)';
      ctx.fillRect(0, h * 0.42, w, h * 0.1);
      ctx.fillRect(0, h * 0.6, w, h * 0.05);
    },
  },
  {
    id: 'desert-moon',
    label: 'Desert moon',
    swatch: ['#2c2440', '#0a0714'],
    paint: (ctx, w, h) => {
      verticalFill(ctx, w, h, [
        [0, '#1a1730'],
        [0.6, '#2f2748'],
        [1, '#120e1f'],
      ]);
      stars(ctx, w, h * 0.6, 120, 0.55);
      glow(ctx, w * 0.7, h * 0.24, w * 0.24, 'rgba(255,248,220,0.45)');
      ctx.fillStyle = '#f6efd8';
      ctx.beginPath();
      ctx.arc(w * 0.7, h * 0.24, w * 0.07, 0, Math.PI * 2);
      ctx.fill();
      ridge(ctx, w, h * 0.74, h * 0.13, 'rgba(74,58,92,0.8)', 5);
      ridge(ctx, w, h * 0.9, h * 0.16, 'rgba(40,30,56,0.95)', 9);
    },
  },
  {
    id: 'geometry',
    label: 'Sacred geometry',
    swatch: ['#0d3b3a', '#c9a227'],
    paint: (ctx, w, h) => {
      verticalFill(ctx, w, h, [
        [0, '#0b2f2e'],
        [1, '#051c1c'],
      ]);
      ctx.save();
      ctx.strokeStyle = 'rgba(212,180,110,0.32)';
      ctx.lineWidth = Math.max(1.4, w * 0.0016);
      const cell = w / 6;
      for (let row = 0; row < Math.ceil(h / cell); row++) {
        for (let col = 0; col < 6; col++) {
          const cx = col * cell + cell / 2;
          const cy = row * cell + cell / 2;
          const r = cell * 0.46;
          ctx.beginPath();
          for (let i = 0; i < 8; i++) {
            const angle = (Math.PI / 4) * i - Math.PI / 2;
            const x = cx + Math.cos(angle) * r;
            const y = cy + Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(cx, cy, r * 0.42, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.restore();
    },
  },
  {
    id: 'aurora',
    label: 'Aurora',
    swatch: ['#0b2a3a', '#1f7a6a'],
    paint: (ctx, w, h) => {
      verticalFill(ctx, w, h, [
        [0, '#04121c'],
        [0.5, '#08283a'],
        [1, '#04121c'],
      ]);
      stars(ctx, w, h, 90, 0.4);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const band = ctx.createLinearGradient(0, h * 0.2, w, h * 0.7);
        band.addColorStop(0, `rgba(46,196,160,${0.24 - i * 0.05})`);
        band.addColorStop(0.55, `rgba(96,180,255,${0.18 - i * 0.04})`);
        band.addColorStop(1, 'rgba(60,20,120,0)');
        ctx.fillStyle = band;
        ctx.beginPath();
        const offset = i * h * 0.08;
        ctx.moveTo(-w * 0.1, h * 0.36 + offset);
        ctx.bezierCurveTo(w * 0.3, h * 0.12 + offset, w * 0.7, h * 0.55 + offset, w * 1.1, h * 0.2 + offset);
        ctx.lineTo(w * 1.1, h * 0.42 + offset);
        ctx.bezierCurveTo(w * 0.7, h * 0.78 + offset, w * 0.3, h * 0.34 + offset, -w * 0.1, h * 0.6 + offset);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    },
  },
  {
    id: 'stone-dome',
    label: 'Stone dome',
    swatch: ['#8d7a63', '#2a2119'],
    paint: (ctx, w, h) => {
      verticalFill(ctx, w, h, [
        [0, '#c9b79c'],
        [0.55, '#8b7a63'],
        [1, '#3a2f24'],
      ]);
      ctx.save();
      ctx.strokeStyle = 'rgba(34,26,18,0.32)';
      ctx.lineWidth = Math.max(2, w * 0.003);
      const cx = w / 2;
      const cy = h * 0.96;
      for (let i = 1; i <= 5; i++) {
        ctx.beginPath();
        ctx.arc(cx, cy, w * 0.16 * i, Math.PI, Math.PI * 2);
        ctx.stroke();
      }
      for (let i = 0; i <= 12; i++) {
        const angle = Math.PI + (Math.PI / 12) * i;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(angle) * w * 0.8, cy + Math.sin(angle) * w * 0.8);
        ctx.stroke();
      }
      ctx.restore();
    },
  },
  {
    id: 'parchment',
    label: 'Parchment',
    swatch: ['#efe2c8', '#a98b5c'],
    paint: (ctx, w, h) => {
      verticalFill(ctx, w, h, [
        [0, '#f4ead4'],
        [0.6, '#e4d3b3'],
        [1, '#c2a878'],
      ]);
      ctx.save();
      ctx.strokeStyle = 'rgba(120,92,50,0.18)';
      ctx.lineWidth = 1.4;
      const step = w / 12;
      for (let x = step; x < w; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = step; y < h; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(120,92,50,0.3)';
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, w * 0.32, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, w * 0.24, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    },
  },
];

const PHOTO_BASE = `${import.meta.env.BASE_URL}share-backgrounds/`;

// Bundled Unsplash photographs, used under the Unsplash License.
export const CARD_PRESETS: CardPreset[] = [
  { id: 'photo-ocean', label: 'Ocean', swatch: ['#9bc7d7', '#063b54'], image: `${PHOTO_BASE}ocean.jpg` },
  { id: 'photo-snow', label: 'Snow mountains', swatch: ['#d8eafa', '#304d6c'], image: `${PHOTO_BASE}snow.jpg` },
  { id: 'photo-sky', label: 'Clouds', swatch: ['#b9d8ed', '#f4eee5'], image: `${PHOTO_BASE}sky.jpg` },
  { id: 'photo-skyline', label: 'City skyline', swatch: ['#f5c5a5', '#16495d'], image: `${PHOTO_BASE}skyline.jpg` },
  { id: 'photo-mountain-starry', label: 'Starry mountains', swatch: ['#18244a', '#8e8fbe'], image: `${PHOTO_BASE}mountain-starry.jpg` },
  { id: 'photo-mountain-valley', label: 'Mountain valley', swatch: ['#94b9d2', '#294a55'], image: `${PHOTO_BASE}mountain-valley.jpg` },
  { id: 'photo-alpine-range', label: 'Alpine range', swatch: ['#c5dced', '#344a61'], image: `${PHOTO_BASE}alpine-range.jpg` },
  { id: 'photo-forest-sunrise', label: 'Forest sunrise', swatch: ['#f3c27b', '#314c3b'], image: `${PHOTO_BASE}forest-sunrise.jpg` },
  { id: 'photo-lakeshore', label: 'Lakeshore', swatch: ['#c6d3d5', '#24444a'], image: `${PHOTO_BASE}lakeshore.jpg` },
];

export function presetById(id: CardPresetId): CardPreset {
  return CARD_PRESETS.find((preset) => preset.id === id)
    ?? ILLUSTRATED_PRESETS.find((preset) => preset.id === id)
    ?? CARD_PRESETS[0];
}

/* ------------------------------- text ---------------------------------- */

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && current) lines.push(current);
  if (lines.length === maxLines && words.length > 0) {
    const joined = lines.join(' ');
    if (joined.split(/\s+/).length < words.length) {
      lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[.,;:]?$/, '')}…`;
    }
  }
  return lines.length > 0 ? lines : [text];
}

async function ensureFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load('600 64px "Amiri Quran"'),
      document.fonts.load('500 32px "Noto Naskh Arabic"'),
    ]);
  } catch {
    /* fall back to the system serif */
  }
}

function drawCenteredLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  cx: number,
  top: number,
  lineHeight: number,
): number {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  lines.forEach((line, index) => ctx.fillText(line, cx, top + index * lineHeight));
  return top + lines.length * lineHeight;
}

/* ------------------------------ render --------------------------------- */

export async function renderShareCard(options: CardOptions): Promise<HTMLCanvasElement> {
  await ensureFonts();

  const { content, format, showBadge } = options;
  const dims = SIZE[format];
  const { width: w, height: h } = dims;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available on this device.');

  const preset = presetById(options.preset);
  if (preset.image) {
    await drawPhotoCover(ctx, preset.image, w, h);
  } else {
    preset.paint?.(ctx, w, h);
  }

  // Legibility scrim, stronger on the story format where text is taller.
  const scrim = ctx.createLinearGradient(0, 0, 0, h);
  scrim.addColorStop(0, 'rgba(4,10,12,0.62)');
  scrim.addColorStop(0.45, 'rgba(4,10,12,0.5)');
  scrim.addColorStop(1, 'rgba(4,10,12,0.78)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, w, h);

  const pad = format === 'square' ? w * 0.085 : w * 0.095;
  const contentWidth = w - pad * 2;
  const cx = w / 2;

  // Header
  const ayahLabel =
    content.ayahTo && content.ayahTo !== content.ayahFrom
      ? `Ayat ${content.ayahFrom}–${content.ayahTo}`
      : `Ayah ${content.ayahFrom}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  const headerSize = Math.round(w * 0.019);
  ctx.font = `600 ${headerSize}px ui-sans-serif, system-ui, sans-serif`;
  const header =
    `SURAH ${content.surahNumber} · ${content.surahName.toUpperCase()} · ${ayahLabel.toUpperCase()}`;
  ctx.fillText(header, cx, pad * 0.7);

  // Fit the Arabic and its translation into the safe band between the header
  // and the footer. Long passages (Ayat al-Kursi, Al-Baqara 282) shrink both
  // fonts instead of overflowing the card.
  const footerSize = Math.round(w * 0.02);
  const footerY = h - pad * 0.55;
  const safeTop = pad * 0.7 + headerSize + h * 0.04;
  const safeBottom = footerY - (showBadge ? footerSize * 2.6 : footerSize * 2);
  const available = Math.max(h * 0.35, safeBottom - safeTop);
  const dividerGap = h * 0.026;
  const dividerSpace = dividerGap + w * 0.022;

  const baseArabic = Math.round(w * 0.062);
  const minArabic = Math.round(w * 0.03);
  const baseTranslation = Math.round(w * (format === 'square' ? 0.026 : 0.027));
  const minTranslation = Math.round(w * 0.017);
  const maxArabicLines = format === 'square' ? 12 : 18;
  const maxTranslationLines = format === 'square' ? 10 : 16;

  let arabicSize = baseArabic;
  let translationSize = baseTranslation;
  let arabicLines: string[] = [];
  let translationLines: string[] = [];

  search: for (let ts = baseTranslation; ts >= minTranslation; ts -= 1) {
    ctx.font = `500 ${ts}px ui-sans-serif, system-ui, sans-serif`;
    const lines = wrapText(ctx, content.translation, contentWidth * 0.94, maxTranslationLines);
    const translationHeight = lines.length * ts * 1.5;
    for (let as = baseArabic; as >= minArabic; as -= 2) {
      ctx.font = `600 ${as}px "Amiri Quran", "Scheherazade New", "Traditional Arabic", serif`;
      const aLines = wrapText(ctx, content.arabic, contentWidth, maxArabicLines);
      if (aLines.length * as * 1.85 + translationHeight + dividerSpace <= available) {
        arabicSize = as;
        translationSize = ts;
        arabicLines = aLines;
        translationLines = lines;
        break search;
      }
    }
  }

  if (arabicLines.length === 0) {
    // Nothing fits even at the smallest sizes: clip the translation rather
    // than letting it run off the card.
    arabicSize = minArabic;
    translationSize = minTranslation;
    ctx.font = `600 ${arabicSize}px "Amiri Quran", "Scheherazade New", "Traditional Arabic", serif`;
    arabicLines = wrapText(ctx, content.arabic, contentWidth, maxArabicLines);
    const arabicHeight = arabicLines.length * arabicSize * 1.85;
    const remaining = Math.max(translationSize * 1.5, available - arabicHeight - dividerSpace);
    const allowed = Math.max(1, Math.floor(remaining / (translationSize * 1.5)));
    ctx.font = `500 ${translationSize}px ui-sans-serif, system-ui, sans-serif`;
    translationLines = wrapText(ctx, content.translation, contentWidth * 0.94, allowed);
  }

  const arabicLineHeight = arabicSize * 1.85;
  const translationLineHeight = translationSize * 1.5;
  const blockHeight =
    arabicLines.length * arabicLineHeight +
    dividerSpace +
    translationLines.length * translationLineHeight;
  let cursor = safeTop + Math.max(0, (available - blockHeight) / 2);

  ctx.font = `600 ${arabicSize}px "Amiri Quran", "Scheherazade New", "Traditional Arabic", serif`;
  ctx.direction = 'rtl';
  ctx.fillStyle = '#ffffff';
  cursor = drawCenteredLines(ctx, arabicLines, cx, cursor, arabicLineHeight);

  // Ornament divider
  cursor += dividerGap;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 2;
  const lineWidth = w * 0.12;
  ctx.beginPath();
  ctx.moveTo(cx - lineWidth - w * 0.02, cursor);
  ctx.lineTo(cx - w * 0.02, cursor);
  ctx.moveTo(cx + w * 0.02, cursor);
  ctx.lineTo(cx + lineWidth + w * 0.02, cursor);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.translate(cx, cursor);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-w * 0.008, -w * 0.008, w * 0.016, w * 0.016);
  ctx.restore();
  cursor += w * 0.022;

  ctx.direction = 'ltr';
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.font = `500 ${translationSize}px ui-sans-serif, system-ui, sans-serif`;
  drawCenteredLines(ctx, translationLines, cx, cursor, translationLineHeight);

  // Footer
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `600 ${footerSize}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  ctx.fillText(`الفرقان · FURQAN`, cx, footerY - (showBadge ? footerSize * 1.25 : 0));
  if (showBadge) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = `500 ${Math.round(footerSize * 0.86)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText('Read on Furqan • by LIXZON', cx, footerY);
  }

  return canvas;
}

async function drawPhotoCover(
  ctx: CanvasRenderingContext2D,
  src: string,
  width: number,
  height: number,
): Promise<void> {
  const image = new Image();
  image.decoding = 'async';
  image.src = src;
  try {
    await image.decode();
  } catch {
    throw new Error('The selected photo background could not be loaded.');
  }
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const cropWidth = width / scale;
  const cropHeight = height / scale;
  ctx.drawImage(
    image,
    (image.naturalWidth - cropWidth) / 2,
    (image.naturalHeight - cropHeight) / 2,
    cropWidth,
    cropHeight,
    0,
    0,
    width,
    height,
  );
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.92);
    } catch {
      resolve(null);
    }
  });
}

export function cardFilename(content: CardContent, format: CardFormat): string {
  const span =
    content.ayahTo && content.ayahTo !== content.ayahFrom
      ? `${content.ayahFrom}-${content.ayahTo}`
      : `${content.ayahFrom}`;
  return `furqan-${content.surahNumber}-${span}-${format}.jpg`;
}
