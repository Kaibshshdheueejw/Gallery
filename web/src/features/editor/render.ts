/**
 * Non-destructive edit pipeline (v2).
 *
 * Everything the editor shows is a RECIPE (EditState) rendered on demand —
 * the original asset bytes are never touched. Pipeline order:
 *
 *   geometry   crop → rotate/flip → straighten (zoom-to-fill) → perspective
 *              (slice keystone warp) → canvas expand (pad) → export scale
 *   colour     filter preset + adjust sliders → curves LUT (RGB + per-channel)
 *              → colour balance → HSL bands → dehaze
 *   detail     sharpen / clarity / denoise (one separable-blur composite pass)
 *   effects    grain, vignette, global blur
 *   retouch    brush dabs: inpaint eraser, red-eye, selective blur, mosaic
 *   depth      portrait (background) blur
 *   overlays   frame → markup → stickers → text layers
 *
 * Thumbnails use a cheap CSS approximation (cssFilterFor); viewer/editor/
 * export run this full pipeline.
 */
import type {
  BrushDab, ColorBalance, CurvePt, CurveState, EditAdjust, EditState, FrameStyle,
  MediaItem, StickerLayer, TextLayer,
} from '../../data/models';
import { balanceIsEmpty, curvesAreEmpty, emptyAdjust, hslIsEmpty } from '../../data/models';
import { getFont, getSticker } from './stickers';

/* ── filter presets (large built-in system, categorised) ──────────────── */

export type FilterCat = 'cinematic' | 'film' | 'vintage' | 'noir' | 'warm' | 'cool' | 'fade' | 'dramatic' | 'portrait' | 'landscape' | 'retro' | 'bw';

export interface FilterPreset {
  id: string;
  label: string;
  cat: FilterCat;
  css: string;                      // cheap approximation for grid thumbs
  adj: Partial<EditAdjust>;         // real pipeline deltas
}

export const FILTER_CATEGORIES: Array<{ id: FilterCat | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'cinematic', label: 'Cinematic' },
  { id: 'film', label: 'Film' },
  { id: 'vintage', label: 'Vintage' },
  { id: 'noir', label: 'Noir' },
  { id: 'warm', label: 'Warm' },
  { id: 'cool', label: 'Cool' },
  { id: 'fade', label: 'Fade' },
  { id: 'dramatic', label: 'Dramatic' },
  { id: 'portrait', label: 'Portrait' },
  { id: 'landscape', label: 'Landscape' },
  { id: 'retro', label: 'Retro' },
  { id: 'bw', label: 'Black & White' },
];

export const FILTERS: FilterPreset[] = [
  { id: 'original', label: 'Original', cat: 'cinematic', css: '', adj: {} },
  /* cinematic */
  { id: 'cinema', label: 'Cinema', cat: 'cinematic', css: 'contrast(1.18) saturate(1.15) hue-rotate(-8deg) brightness(0.96)', adj: { contrast: 22, saturation: 14, warmth: 12, tint: -6, highlights: -12, shadows: -14, vignette: 14 } },
  { id: 'blockbuster', label: 'Blockbuster', cat: 'cinematic', css: 'contrast(1.3) saturate(1.2) brightness(0.94)', adj: { contrast: 38, saturation: 18, shadows: -22, highlights: -10, dehaze: 18, vignette: 22 } },
  { id: 'moody', label: 'Moody', cat: 'cinematic', css: 'contrast(1.12) saturate(0.85) brightness(0.92) sepia(0.15)', adj: { contrast: 16, saturation: -18, brightness: -10, warmth: 8, shadows: -18, vignette: 26, grain: 8 } },
  /* film */
  { id: 'filmic', label: 'Filmic', cat: 'film', css: 'contrast(1.06) saturate(1.12) sepia(0.14)', adj: { contrast: 8, saturation: 10, warmth: 14, highlights: -8, shadows: 8, grain: 16 } },
  { id: 'slide', label: 'Slide', cat: 'film', css: 'saturate(1.4) contrast(1.14)', adj: { saturation: 34, contrast: 16, clarity: 12, vibrance: 10 } },
  { id: 'instant', label: 'Instant', cat: 'film', css: 'contrast(0.9) brightness(1.12) sepia(0.2) saturate(0.85)', adj: { contrast: -12, brightness: 10, warmth: 18, saturation: -12, highlights: 12, grain: 10, vignette: 10 } },
  /* vintage */
  { id: 'vintage', label: 'Vintage', cat: 'vintage', css: 'sepia(0.4) contrast(0.92) brightness(1.06) saturate(0.8)', adj: { warmth: 34, contrast: -10, brightness: 6, saturation: -22, shadows: 14, grain: 20, vignette: 18 } },
  { id: 'retro', label: 'Retro', cat: 'retro', css: 'sepia(0.3) saturate(1.3) hue-rotate(-12deg) contrast(1.05)', adj: { warmth: 26, tint: 10, saturation: 18, contrast: 6, grain: 14, vignette: 12 } },
  { id: 'polaroid', label: 'Polaroid', cat: 'retro', css: 'sepia(0.18) brightness(1.14) contrast(0.86) saturate(0.8)', adj: { brightness: 14, contrast: -16, warmth: 14, saturation: -18, highlights: 16, vignette: 8 } },
  { id: 'seventies', label: 'Seventies', cat: 'retro', css: 'sepia(0.34) saturate(1.15) contrast(0.95) hue-rotate(-8deg)', adj: { warmth: 30, tint: 14, saturation: 8, contrast: -6, grain: 22, vignette: 20 } },
  /* noir */
  { id: 'noir', label: 'Noir', cat: 'noir', css: 'grayscale(1) contrast(1.45) brightness(0.92)', adj: { saturation: -100, contrast: 46, brightness: -8, vignette: 34, grain: 14, clarity: 16 } },
  { id: 'carbon', label: 'Carbon', cat: 'noir', css: 'grayscale(1) contrast(1.1)', adj: { saturation: -100, contrast: 14, shadows: -10, vignette: 16 } },
  /* warm */
  { id: 'warm', label: 'Warm', cat: 'warm', css: 'sepia(0.28) saturate(1.2) brightness(1.04)', adj: { warmth: 30, saturation: 12, brightness: 4 } },
  { id: 'golden', label: 'Golden', cat: 'warm', css: 'sepia(0.36) saturate(1.3) brightness(1.06)', adj: { warmth: 42, tint: 6, saturation: 20, brightness: 6, highlights: 10 } },
  { id: 'sunset', label: 'Sunset', cat: 'warm', css: 'sepia(0.3) saturate(1.4) hue-rotate(-14deg) contrast(1.06)', adj: { warmth: 38, tint: 16, saturation: 26, contrast: 8, highlights: -6 } },
  /* cool */
  { id: 'cool', label: 'Cool', cat: 'cool', css: 'hue-rotate(-12deg) saturate(1.1) brightness(1.02)', adj: { warmth: -26, saturation: 8, brightness: 2 } },
  { id: 'arctic', label: 'Arctic', cat: 'cool', css: 'hue-rotate(-16deg) saturate(0.9) brightness(1.1) contrast(1.04)', adj: { warmth: -40, saturation: -8, brightness: 10, contrast: 6, highlights: 8 } },
  { id: 'ocean', label: 'Ocean', cat: 'cool', css: 'hue-rotate(-10deg) saturate(1.25) brightness(0.98)', adj: { warmth: -30, tint: -10, saturation: 16, contrast: 10, shadows: -8 } },
  /* fade */
  { id: 'fade', label: 'Fade', cat: 'fade', css: 'contrast(0.82) brightness(1.12) saturate(0.75)', adj: { contrast: -22, brightness: 10, saturation: -24, shadows: 20, highlights: -8 } },
  { id: 'mist', label: 'Mist', cat: 'fade', css: 'contrast(0.86) brightness(1.1) saturate(0.85) blur(0.3px)', adj: { contrast: -16, brightness: 8, saturation: -12, shadows: 16, dehaze: -10 } },
  /* dramatic */
  { id: 'dramatic', label: 'Dramatic', cat: 'dramatic', css: 'contrast(1.35) brightness(0.94) saturate(1.1)', adj: { contrast: 40, brightness: -6, saturation: 8, clarity: 26, dehaze: 24, shadows: -14, vignette: 20 } },
  { id: 'punch', label: 'Punch', cat: 'dramatic', css: 'contrast(1.25) saturate(1.3)', adj: { contrast: 28, saturation: 24, vibrance: 14, clarity: 14 } },
  /* portrait */
  { id: 'portrait', label: 'Portrait', cat: 'portrait', css: 'contrast(1.04) saturate(1.06) sepia(0.1) brightness(1.04)', adj: { contrast: 6, saturation: 6, warmth: 12, brightness: 4, highlights: -6, shadows: 6 } },
  { id: 'softglow', label: 'Soft glow', cat: 'portrait', css: 'brightness(1.1) saturate(1.1) blur(0.4px)', adj: { brightness: 8, saturation: 8, highlights: 14, contrast: -6, blur: 0.6 } },
  { id: 'porcelain', label: 'Porcelain', cat: 'portrait', css: 'brightness(1.08) contrast(0.96) saturate(0.92)', adj: { brightness: 8, contrast: -6, saturation: -8, denoise: 22, highlights: 6 } },
  /* landscape */
  { id: 'landscape', label: 'Landscape', cat: 'landscape', css: 'saturate(1.25) contrast(1.12)', adj: { saturation: 18, vibrance: 16, contrast: 14, clarity: 20, dehaze: 14 } },
  { id: 'vista', label: 'Vista', cat: 'landscape', css: 'saturate(1.3) contrast(1.2) brightness(0.98)', adj: { saturation: 22, contrast: 24, clarity: 26, dehaze: 20, shadows: -10 } },
  /* b&w */
  { id: 'mono', label: 'Mono', cat: 'bw', css: 'grayscale(1) contrast(1.08)', adj: { saturation: -100, contrast: 10, clarity: 10 } },
  { id: 'graphite', label: 'Graphite', cat: 'bw', css: 'grayscale(1) contrast(1.3) brightness(0.96)', adj: { saturation: -100, contrast: 32, brightness: -4, clarity: 18, vignette: 12 } },
];

export const filterPreset = (id: string): FilterPreset => FILTERS.find((f) => f.id === id) ?? FILTERS[0];

/* ── CSS approximation for grid thumbnails (cheap, GPU-composited) ────── */

export function cssFilterFor(item: MediaItem): string {
  const e = item.edits;
  const preset = filterPreset(e.filterId);
  const a = e.adjust;
  const parts: string[] = [];
  if (preset.css) parts.push(preset.css);
  const bright = a.brightness / 220 + a.exposure / 240 + (preset.adj.brightness ?? 0) / 220 + (preset.adj.exposure ?? 0) / 240;
  const contrast = a.contrast / 220 + a.dehaze / 400 + (preset.adj.contrast ?? 0) / 220;
  const sat = a.saturation / 160 + a.vibrance / 320 + (preset.adj.saturation ?? 0) / 160;
  if (bright) parts.push(`brightness(${(1 + bright).toFixed(3)})`);
  if (contrast) parts.push(`contrast(${(1 + contrast).toFixed(3)})`);
  if (sat) parts.push(`saturate(${(1 + sat).toFixed(3)})`);
  if (a.warmth) parts.push(`sepia(${Math.min(0.5, Math.abs(a.warmth) / 160).toFixed(3)})`);
  if (a.hue) parts.push(`hue-rotate(${a.hue}deg)`);
  if (a.blur) parts.push(`blur(${(a.blur / 6).toFixed(2)}px)`);
  if (e.enhanced) parts.push('contrast(1.08) saturate(1.1) brightness(1.05)');
  return parts.join(' ');
}

export function cssTransformFor(item: MediaItem): string {
  const e = item.edits;
  const parts: string[] = [];
  const rot = e.rotate + (e.straighten || 0);
  if (rot) parts.push(`rotate(${rot}deg)`);
  if (e.flipH) parts.push('scaleX(-1)');
  if (e.flipV) parts.push('scaleY(-1)');
  return parts.join(' ');
}

export function isEdited(item: MediaItem): boolean {
  const e = item.edits;
  return Boolean(
    e.rotate || e.flipH || e.flipV || e.crop || e.filterId !== 'original' || e.enhanced ||
    e.straighten || e.perspective.x || e.perspective.y || e.pad ||
    e.curves || e.hsl || e.balance ||
    e.dabs.length || e.erased.length || e.portraitBlur || e.markup.length ||
    e.stickers.length || e.texts.length || e.frame ||
    e.trim || e.effectId !== 'none' || e.speed !== 1 || e.reverse || e.aspect !== 'original' ||
    Object.values(e.adjust).some((v) => v !== 0),
  );
}

/* ── frames ───────────────────────────────────────────────────────────── */

export const FRAME_PRESETS: Array<{ id: FrameStyle['id']; label: string }> = [
  { id: 'none', label: 'None' },
  { id: 'thin', label: 'Thin' },
  { id: 'thick', label: 'Thick' },
  { id: 'polaroid', label: 'Polaroid' },
  { id: 'round', label: 'Rounded' },
  { id: 'corners', label: 'Corners' },
];

export const FRAME_COLORS = ['#ffffff', '#111111', '#ffd76a', '#ff5c8a', '#4dc9ff', '#4caf6d', '#af52de'];

/* ── curves → LUT ─────────────────────────────────────────────────────── */

/** Catmull-Rom through (0,0) + pts + (1,1), monotone-ish; returns 256 LUT. */
export function curveToLut(pts: CurvePt[]): Uint8Array {
  const lut = new Uint8Array(256);
  if (!pts.length) { for (let i = 0; i < 256; i++) lut[i] = i; return lut; }
  const all: CurvePt[] = [{ x: 0, y: 0 }, ...[...pts].sort((a, b) => a.x - b.x), { x: 1, y: 1 }];
  for (let i = 0; i < 256; i++) {
    const x = i / 255;
    // find segment
    let s = 0;
    while (s < all.length - 2 && all[s + 1].x < x) s++;
    const p0 = all[Math.max(0, s - 1)], p1 = all[s], p2 = all[s + 1], p3 = all[Math.min(all.length - 1, s + 2)];
    const span = p2.x - p1.x;
    const t = span > 0 ? (x - p1.x) / span : 0;
    // Catmull-Rom
    const t2 = t * t, t3 = t2 * t;
    const y = 0.5 * (
      (2 * p1.y) +
      (-p0.y + p2.y) * t +
      (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
      (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
    );
    lut[i] = Math.max(0, Math.min(255, Math.round(y * 255)));
  }
  return lut;
}

function composeLuts(curves: CurveState | null, balance: ColorBalance | null): Uint8Array[] | null {
  if (!curves && !balance) return null;
  const rgb = curves ? curveToLut(curves.rgb) : null;
  const chans = curves ? [curveToLut(curves.r), curveToLut(curves.g), curveToLut(curves.b)] : null;
  const out: Uint8Array[] = [new Uint8Array(256), new Uint8Array(256), new Uint8Array(256)];
  for (let c = 0; c < 3; c++) {
    for (let i = 0; i < 256; i++) {
      let v = i;
      if (rgb) v = rgb[v];
      if (chans) v = chans[c][v];
      out[c][i] = v;
    }
  }
  return out;
}

/* balance weight curves by luma (0..255) */
function balanceWeights(luma: number): [number, number, number] {
  const t = luma / 255;
  const sh = Math.max(0, 1 - t * 1.6);
  const hi = Math.max(0, (t - 0.4) * 1.67);
  const mid = Math.max(0, 1 - sh - hi);
  return [sh, mid, hi];
}

/* ── HSL helpers ──────────────────────────────────────────────────────── */

function rgb2hsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const mx = Math.max(rn, gn, bn), mn = Math.min(rn, gn, bn);
  const l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h: number;
  if (mx === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (mx === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return [h, s, l];
}

function hsl2rgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [
    Math.round(hue2rgb(h + 1 / 3) * 255),
    Math.round(hue2rgb(h) * 255),
    Math.round(hue2rgb(h - 1 / 3) * 255),
  ];
}

/** band centres spread across the hue wheel (red, orange, yellow, green, cyan, blue, purple, magenta) */
export const HSL_BAND_LABELS = ['Reds', 'Oranges', 'Yellows', 'Greens', 'Cyans', 'Blues', 'Purples', 'Magentas'];
export const HSL_BAND_HUES = [0, 30, 60, 110, 180, 235, 280, 320];

/* ── output geometry ──────────────────────────────────────────────────── */

export interface OutGeom { w: number; h: number; imgX: number; imgY: number; imgW: number; imgH: number }

export function computeOutputSize(item: MediaItem, edits: EditState, maxDim: number): { w: number; h: number } {
  const g = computeGeometry(item, edits, maxDim);
  return { w: g.w, h: g.h };
}

export function computeGeometry(item: MediaItem, edits: EditState, maxDim: number): OutGeom {
  const rotated = edits.rotate === 90 || edits.rotate === 270;
  const baseW = rotated ? item.h : item.w;
  const baseH = rotated ? item.w : item.h;
  const crop = edits.crop ?? { x: 0, y: 0, w: 1, h: 1 };
  let w = baseW * crop.w;
  let h = baseH * crop.h;
  // pad (expand canvas) — fractions of the cropped size
  const pad = edits.pad;
  const pl = pad ? pad.left * w : 0, pr = pad ? pad.right * w : 0;
  const pt = pad ? pad.top * h : 0, pb = pad ? pad.bottom * h : 0;
  const totalW = w + pl + pr;
  const totalH = h + pt + pb;
  const scale = Math.min(1, maxDim / Math.max(totalW, totalH)) * (edits.exportScale || 1);
  return {
    w: Math.max(1, Math.round(totalW * scale)),
    h: Math.max(1, Math.round(totalH * scale)),
    imgX: Math.round(pl * scale),
    imgY: Math.round(pt * scale),
    imgW: Math.max(1, Math.round(w * scale)),
    imgH: Math.max(1, Math.round(h * scale)),
  };
}

/* ── enhance (auto tone from on-device histogram) ─────────────────────── */

function enhanceDelta(item: MediaItem): { b: number; c: number; s: number } {
  const v = item.vision;
  if (!v) return { b: 8, c: 10, s: 10 };
  const b = Math.max(-18, Math.min(22, (0.52 - v.brightness) * 70));
  const c = Math.max(0, 16 - v.saturation * 10);
  const s = Math.max(0, 14 - v.saturation * 12);
  return { b, c, s };
}

/* ── box blur (separable, for clarity/denoise composite) ──────────────── */

function boxBlurLuma(data: Uint8ClampedArray, w: number, h: number, radius: number): { blurL: Float32Array; blurRGB: Float32Array } {
  const n = w * h;
  const luma = new Float32Array(n);
  for (let i = 0, p = 0; p < n; i += 4, p++) luma[p] = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  const blurL = new Float32Array(n);
  const blurRGB = new Float32Array(n * 3);
  const tmpL = new Float32Array(n);
  const tmpRGB = new Float32Array(n * 3);
  const r = Math.max(1, radius | 0);
  const win = r * 2 + 1;
  // horizontal
  for (let y = 0; y < h; y++) {
    let accL = 0, accR = 0, accG = 0, accB = 0;
    const row = y * w;
    for (let x = -r; x <= r; x++) {
      const xi = Math.min(w - 1, Math.max(0, x));
      const p = row + xi;
      accL += luma[p];
      accR += data[p * 4]; accG += data[p * 4 + 1]; accB += data[p * 4 + 2];
    }
    for (let x = 0; x < w; x++) {
      const p = row + x;
      tmpL[p] = accL / win;
      tmpRGB[p * 3] = accR / win; tmpRGB[p * 3 + 1] = accG / win; tmpRGB[p * 3 + 2] = accB / win;
      const xOut = Math.min(w - 1, Math.max(0, x - r));
      const xIn = Math.min(w - 1, Math.max(0, x + r + 1));
      const pOut = row + xOut, pIn = row + xIn;
      accL += luma[pIn] - luma[pOut];
      accR += data[pIn * 4] - data[pOut * 4];
      accG += data[pIn * 4 + 1] - data[pOut * 4 + 1];
      accB += data[pIn * 4 + 2] - data[pOut * 4 + 2];
    }
  }
  // vertical
  for (let x = 0; x < w; x++) {
    let accL = 0, accR = 0, accG = 0, accB = 0;
    for (let y = -r; y <= r; y++) {
      const yi = Math.min(h - 1, Math.max(0, y));
      const p = yi * w + x;
      accL += tmpL[p];
      accR += tmpRGB[p * 3]; accG += tmpRGB[p * 3 + 1]; accB += tmpRGB[p * 3 + 2];
    }
    for (let y = 0; y < h; y++) {
      const p = y * w + x;
      blurL[p] = accL / win;
      blurRGB[p * 3] = accR / win; blurRGB[p * 3 + 1] = accG / win; blurRGB[p * 3 + 2] = accB / win;
      const yOut = Math.min(h - 1, Math.max(0, y - r));
      const yIn = Math.min(h - 1, Math.max(0, y + r + 1));
      const pOut = yOut * w + x, pIn = yIn * w + x;
      accL += tmpL[pIn] - tmpL[pOut];
      accR += tmpRGB[pIn * 3] - tmpRGB[pOut * 3];
      accG += tmpRGB[pIn * 3 + 1] - tmpRGB[pOut * 3 + 1];
      accB += tmpRGB[pIn * 3 + 2] - tmpRGB[pOut * 3 + 2];
    }
  }
  return { blurL, blurRGB };
}

/* ── hue-rotate matrix ────────────────────────────────────────────────── */

function hueMatrix(deg: number): number[] {
  const a = (deg * Math.PI) / 180;
  const cos = Math.cos(a), sin = Math.sin(a);
  return [
    0.213 + cos * 0.787 - sin * 0.213, 0.715 - cos * 0.715 - sin * 0.715, 0.072 - cos * 0.072 + sin * 0.928,
    0.213 - cos * 0.213 + sin * 0.143, 0.715 + cos * 0.285 + sin * 0.140, 0.072 - cos * 0.072 - sin * 0.283,
    0.213 - cos * 0.213 - sin * 0.787, 0.715 - cos * 0.715 + sin * 0.715, 0.072 + cos * 0.928 + sin * 0.072,
  ];
}

/* ── the full pipeline ────────────────────────────────────────────────── */

export interface RenderOptions { maxDim?: number; includeMarkup?: boolean; time?: number | null }

export async function renderEdited(img: HTMLImageElement, item: MediaItem, edits: EditState, opts: RenderOptions = {}): Promise<HTMLCanvasElement> {
  const maxDim = opts.maxDim ?? 1600;
  const includeMarkup = opts.includeMarkup ?? true;
  const time = opts.time ?? null;
  const g = computeGeometry(item, edits, maxDim);
  const canvas = document.createElement('canvas');
  canvas.width = g.w;
  canvas.height = g.h;
  const ctx = canvas.getContext('2d')!;

  /* pad background (expand canvas) */
  if (edits.pad) {
    ctx.fillStyle = edits.pad.color;
    ctx.fillRect(0, 0, g.w, g.h);
  }

  /* ── base geometry: crop → rotate/flip → straighten → into image rect ── */
  const crop = edits.crop ?? { x: 0, y: 0, w: 1, h: 1 };
  const sx = img.naturalWidth * crop.x;
  const sy = img.naturalHeight * crop.y;
  const sw = img.naturalWidth * crop.w;
  const sh = img.naturalHeight * crop.h;

  const cx = g.imgX + g.imgW / 2;
  const cy = g.imgY + g.imgH / 2;
  ctx.save();
  // clip to the image rect so straighten zoom / perspective never bleed into pad
  ctx.beginPath();
  ctx.rect(g.imgX, g.imgY, g.imgW, g.imgH);
  ctx.clip();
  ctx.translate(cx, cy);
  const straightRad = ((edits.straighten || 0) * Math.PI) / 180;
  if (straightRad) {
    const ar = g.imgW / g.imgH;
    const t = Math.abs(straightRad);
    const cover = Math.max(Math.cos(t) + Math.sin(t) * ar, Math.cos(t) + Math.sin(t) / ar);
    ctx.rotate(straightRad);
    ctx.scale(cover, cover);
  }
  ctx.rotate((edits.rotate * Math.PI) / 180);
  ctx.scale(edits.flipH ? -1 : 1, edits.flipV ? -1 : 1);
  const dw = edits.rotate % 180 === 0 ? g.imgW : g.imgH;
  const dh = edits.rotate % 180 === 0 ? g.imgH : g.imgW;
  ctx.drawImage(img, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();

  /* ── perspective keystone (slice warp, in-place) ────────────────────── */
  const px = edits.perspective?.x ?? 0;
  const py = edits.perspective?.y ?? 0;
  if (px || py) {
    const snap = document.createElement('canvas');
    snap.width = g.w; snap.height = g.h;
    snap.getContext('2d')!.drawImage(canvas, 0, 0);
    ctx.clearRect(g.imgX, g.imgY, g.imgW, g.imgH);
    const SLICES = 64;
    if (py) {
      // horizontal keystone: column heights taper left→right
      const k = (py / 100) * 0.4;
      for (let i = 0; i < SLICES; i++) {
        const t0 = i / SLICES, t1 = (i + 1) / SLICES;
        const s0 = 1 + k * (1 - 2 * t0);
        const srcX = g.imgX + g.imgW * t0, srcW = g.imgW / SLICES + 1;
        const dstH = g.imgH * Math.max(0.05, s0);
        ctx.drawImage(snap, srcX, g.imgY, srcW, g.imgH, srcX, cy - dstH / 2, srcW, dstH);
      }
    }
    if (px) {
      const snap2 = document.createElement('canvas');
      snap2.width = g.w; snap2.height = g.h;
      snap2.getContext('2d')!.drawImage(canvas, 0, 0);
      ctx.clearRect(g.imgX, g.imgY, g.imgW, g.imgH);
      const k = (px / 100) * 0.4;
      for (let i = 0; i < SLICES; i++) {
        const t0 = i / SLICES;
        const s0 = 1 + k * (1 - 2 * t0);
        const srcY = g.imgY + g.imgH * t0, srcH = g.imgH / SLICES + 1;
        const dstW = g.imgW * Math.max(0.05, s0);
        ctx.drawImage(snap2, g.imgX, srcY, g.imgW, srcH, cx - dstW / 2, srcY, dstW, srcH);
      }
    }
  }

  /* ── colour pipeline (single pixel pass over the image rect) ────────── */
  const preset = filterPreset(edits.filterId);
  const a: EditAdjust = { ...emptyAdjust() };
  const addAdj = (src: Partial<EditAdjust>) => {
    for (const k of Object.keys(a) as Array<keyof EditAdjust>) a[k] += src[k] ?? 0;
  };
  addAdj(preset.adj);
  addAdj(edits.adjust);
  if (edits.enhanced) {
    const d = enhanceDelta(item);
    a.brightness += d.b; a.contrast += d.c; a.saturation += d.s;
  }

  const curves = curvesAreEmpty(edits.curves) ? null : edits.curves;
  const bal = balanceIsEmpty(edits.balance) ? null : edits.balance;
  const luts = composeLuts(curves, bal);
  const hsl = hslIsEmpty(edits.hsl) ? null : edits.hsl;
  const hslActive = Boolean(hsl);

  const needsPixelPass = Boolean(
    a.exposure || a.brightness || a.contrast || a.highlights || a.shadows ||
    a.saturation || a.vibrance || a.warmth || a.tint || a.hue || a.dehaze ||
    luts || hslActive || bal,
  );

  if (needsPixelPass) {
    const imgData = ctx.getImageData(g.imgX, g.imgY, g.imgW, g.imgH);
    const d = imgData.data;
    const expMul = Math.pow(2, a.exposure / 100);           // ±1 EV-ish
    const brightAdd = a.brightness * 0.7;
    const contrastF = 1 + a.contrast / 110;
    const hiAmt = a.highlights / 100;
    const shAmt = a.shadows / 100;
    const satF = 1 + a.saturation / 110;
    const vibAmt = a.vibrance / 100;
    const warmAmt = a.warmth * 0.42;
    const tintAmt = a.tint * 0.3;
    const dehazeAmt = a.dehaze / 100;
    const hm = a.hue ? hueMatrix(a.hue) : null;

    for (let i = 0; i < d.length; i += 4) {
      let r = d[i], gg = d[i + 1], b = d[i + 2];

      // exposure & brightness
      r = r * expMul + brightAdd;
      gg = gg * expMul + brightAdd;
      b = b * expMul + brightAdd;

      // contrast around mid-grey
      r = (r - 128) * contrastF + 128;
      gg = (gg - 128) * contrastF + 128;
      b = (b - 128) * contrastF + 128;

      // highlights / shadows (luma-weighted)
      let luma = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
      if (hiAmt || shAmt) {
        const t = luma / 255;
        const wHi = t * t;
        const wSh = (1 - t) * (1 - t);
        const delta = hiAmt * -46 * wHi + shAmt * 52 * wSh;
        r += delta; gg += delta; b += delta;
      }

      // temperature / tint
      if (warmAmt) { r += warmAmt; b -= warmAmt; }
      if (tintAmt) { gg -= tintAmt; r += tintAmt * 0.4; b += tintAmt * 0.4; }

      // hue rotation
      if (hm) {
        const nr = hm[0] * r + hm[1] * gg + hm[2] * b;
        const ng = hm[3] * r + hm[4] * gg + hm[5] * b;
        const nb = hm[6] * r + hm[7] * gg + hm[8] * b;
        r = nr; gg = ng; b = nb;
      }

      // saturation + vibrance (vibrance boosts muted colours more)
      luma = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
      if (satF !== 1 || vibAmt) {
        const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
        const sat = mx <= 0 ? 0 : (mx - mn) / mx;
        const vib = 1 + vibAmt * (1 - sat) * 1.4;
        const f = satF * vib;
        r = luma + (r - luma) * f;
        gg = luma + (gg - luma) * f;
        b = luma + (b - luma) * f;
      }

      // curves + balance LUT
      if (luts) {
        const ri = r < 0 ? 0 : r > 255 ? 255 : r | 0;
        const gi = gg < 0 ? 0 : gg > 255 ? 255 : gg | 0;
        const bi = b < 0 ? 0 : b > 255 ? 255 : b | 0;
        r = luts[0][ri]; gg = luts[1][gi]; b = luts[2][bi];
        if (bal) {
          const [wS, wM, wH] = balanceWeights(0.2126 * r + 0.7152 * gg + 0.0722 * b);
          r += bal.shadows.r * 0.4 * wS + bal.midtones.r * 0.4 * wM + bal.highlights.r * 0.4 * wH;
          gg += bal.shadows.g * 0.4 * wS + bal.midtones.g * 0.4 * wM + bal.highlights.g * 0.4 * wH;
          b += bal.shadows.b * 0.4 * wS + bal.midtones.b * 0.4 * wM + bal.highlights.b * 0.4 * wH;
        }
      } else if (bal) {
        const [wS, wM, wH] = balanceWeights(0.2126 * r + 0.7152 * gg + 0.0722 * b);
        r += bal.shadows.r * 0.4 * wS + bal.midtones.r * 0.4 * wM + bal.highlights.r * 0.4 * wH;
        gg += bal.shadows.g * 0.4 * wS + bal.midtones.g * 0.4 * wM + bal.highlights.g * 0.4 * wH;
        b += bal.shadows.b * 0.4 * wS + bal.midtones.b * 0.4 * wM + bal.highlights.b * 0.4 * wH;
      }

      // HSL per-band adjustments
      if (hslActive) {
        let [hh, ss, ll] = rgb2hsl(Math.max(0, Math.min(255, r)), Math.max(0, Math.min(255, gg)), Math.max(0, Math.min(255, b)));
        const hueDeg = hh * 360;
        for (let band = 0; band < hsl!.length; band++) {
          const bd = hsl![band];
          if (!bd.h && !bd.s && !bd.l) continue;
          const centre = HSL_BAND_HUES[band];
          let diff = Math.abs(hueDeg - centre);
          if (diff > 180) diff = 360 - diff;
          const w = Math.max(0, 1 - diff / 45); // 45° falloff
          if (w <= 0) continue;
          hh += (bd.h / 3600) * w;
          ss = Math.max(0, Math.min(1, ss + (bd.s / 250) * w));
          ll = Math.max(0, Math.min(1, ll + (bd.l / 400) * w));
        }
        hh = hh - Math.floor(hh);
        const [nr2, ng2, nb2] = hsl2rgb(hh, ss, ll);
        r = nr2; gg = ng2; b = nb2;
      }

      // dehaze: lift contrast in hazed (bright-grey) regions
      if (dehazeAmt) {
        const hazeW = Math.max(0, Math.min(1, (luma / 255 - 0.35) * 2));
        const f = 1 + dehazeAmt * 0.5 * hazeW;
        r = (r - 128) * f + 128 - dehazeAmt * 10 * hazeW;
        gg = (gg - 128) * f + 128 - dehazeAmt * 10 * hazeW;
        b = (b - 128) * f + 128 - dehazeAmt * 10 * hazeW;
      }

      d[i] = r < 0 ? 0 : r > 255 ? 255 : r;
      d[i + 1] = gg < 0 ? 0 : gg > 255 ? 255 : gg;
      d[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
    }
    ctx.putImageData(imgData, g.imgX, g.imgY);
  }

  /* ── detail composite: sharpen + clarity + denoise (one blur pass) ──── */
  const sharpAmt = a.sharpen / 100;
  const clarityAmt = a.clarity / 100;
  const denoiseAmt = a.denoise / 100;
  if (sharpAmt > 0 || clarityAmt !== 0 || denoiseAmt > 0) {
    const imgData = ctx.getImageData(g.imgX, g.imgY, g.imgW, g.imgH);
    const d = imgData.data;
    const w = g.imgW, h = g.imgH;
    const { blurL, blurRGB } = boxBlurLuma(d, w, h, Math.max(2, Math.round(Math.min(w, h) / 180)));
    const lapK = sharpAmt * 0.55;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        const i = p * 4;
        let r = d[i], gg2 = d[i + 1], b2 = d[i + 2];
        const lum = 0.2126 * r + 0.7152 * gg2 + 0.0722 * b2;
        const bL = blurL[p];
        // clarity: local contrast of luma around mid-tones
        if (clarityAmt) {
          const midW = 1 - Math.abs(lum / 255 - 0.5) * 1.2;
          const boost = (lum - bL) * clarityAmt * 1.6 * Math.max(0, midW);
          r += boost; gg2 += boost; b2 += boost;
        }
        // denoise: blend toward local average in flat regions, keep edges
        if (denoiseAmt) {
          const edge = Math.min(1, Math.abs(lum - bL) / 24);
          const mixF = denoiseAmt * 0.75 * (1 - edge);
          r = r + (blurRGB[p * 3] - r) * mixF;
          gg2 = gg2 + (blurRGB[p * 3 + 1] - gg2) * mixF;
          b2 = b2 + (blurRGB[p * 3 + 2] - b2) * mixF;
        }
        // sharpen: 4-neighbour laplacian
        if (lapK && x > 0 && y > 0 && x < w - 1 && y < h - 1) {
          for (let c = 0; c < 3; c++) {
            const cur = d[i + c];
            const lap = 4 * cur - d[i - 4 + c] - d[i + 4 + c] - d[i - w * 4 + c] + -d[i + w * 4 + c];
            const v = cur + lapK * lap * 0.6;
            if (c === 0) r = v; else if (c === 1) gg2 = v; else b2 = v;
          }
        }
        d[i] = r < 0 ? 0 : r > 255 ? 255 : r;
        d[i + 1] = gg2 < 0 ? 0 : gg2 > 255 ? 255 : gg2;
        d[i + 2] = b2 < 0 ? 0 : b2 > 255 ? 255 : b2;
      }
    }
    ctx.putImageData(imgData, g.imgX, g.imgY);
  }

  /* ── warmth tint overlay (soft-light, like the classic look) ────────── */
  const warmthTotal = a.warmth;
  if (warmthTotal && !needsPixelPass) {
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = Math.min(0.55, Math.abs(warmthTotal) / 130);
    ctx.fillStyle = warmthTotal > 0 ? '#ff9a3c' : '#4aa3ff';
    ctx.fillRect(g.imgX, g.imgY, g.imgW, g.imgH);
    ctx.restore();
  }

  /* ── global blur ────────────────────────────────────────────────────── */
  if (a.blur > 0.05) {
    const snap = document.createElement('canvas');
    snap.width = g.w; snap.height = g.h;
    snap.getContext('2d')!.drawImage(canvas, 0, 0);
    ctx.save();
    ctx.beginPath(); ctx.rect(g.imgX, g.imgY, g.imgW, g.imgH); ctx.clip();
    ctx.filter = `blur(${(a.blur / 6).toFixed(2)}px)`;
    ctx.clearRect(g.imgX, g.imgY, g.imgW, g.imgH);
    ctx.drawImage(snap, 0, 0);
    ctx.restore();
  }

  /* ── brush dabs: inpaint / red-eye / blur / mosaic ──────────────────── */
  const dabs: BrushDab[] = [
    ...edits.dabs,
    ...edits.erased.map((eb) => ({ ...eb, mode: 'inpaint' as const })),
  ];
  if (dabs.length) {
    const snap = document.createElement('canvas');
    snap.width = g.w; snap.height = g.h;
    snap.getContext('2d')!.drawImage(canvas, 0, 0);
    for (const dab of dabs) {
      const dxp = g.imgX + dab.x * g.imgW;
      const dyp = g.imgY + dab.y * g.imgH;
      const r = dab.r * g.imgW;
      ctx.save();
      ctx.beginPath();
      ctx.arc(dxp, dyp, r, 0, Math.PI * 2);
      ctx.clip();
      switch (dab.mode) {
        case 'inpaint': {
          ctx.filter = 'blur(16px)';
          ctx.drawImage(snap, -g.w * 0.02, -g.h * 0.02, g.w * 1.04, g.h * 1.04);
          break;
        }
        case 'blur': {
          ctx.filter = `blur(${Math.max(4, r * 0.35)}px)`;
          ctx.drawImage(snap, 0, 0);
          break;
        }
        case 'mosaic': {
          // pixelate: downscale the dab region, then upscale it back
          const cell = Math.max(3, r * 0.3);
          const rw = r * 2, rh = r * 2;
          const tmp = document.createElement('canvas');
          tmp.width = Math.max(2, Math.round(rw / cell));
          tmp.height = Math.max(2, Math.round(rh / cell));
          tmp.getContext('2d')!.drawImage(snap, dxp - r, dyp - r, rw, rh, 0, 0, tmp.width, tmp.height);
          ctx.imageSmoothingEnabled = false;
          ctx.clearRect(dxp - r, dyp - r, rw, rh);
          ctx.drawImage(tmp, dxp - r, dyp - r, rw, rh);
          ctx.imageSmoothingEnabled = true;
          break;
        }
        case 'redeye': {
          // real algorithm: suppress red-dominant pixels inside the dab
          const x0 = Math.max(0, Math.floor(dxp - r)), y0 = Math.max(0, Math.floor(dyp - r));
          const x1 = Math.min(g.w, Math.ceil(dxp + r)), y1 = Math.min(g.h, Math.ceil(dyp + r));
          if (x1 > x0 && y1 > y0) {
            const region = ctx.getImageData(x0, y0, x1 - x0, y1 - y0);
            const rd = region.data;
            for (let py2 = 0; py2 < region.height; py2++) {
              for (let px2 = 0; px2 < region.width; px2++) {
                const dist = Math.hypot(x0 + px2 - dxp, y0 + py2 - dyp);
                if (dist > r) continue;
                const i = (py2 * region.width + px2) * 4;
                const R = rd[i], G = rd[i + 1], B = rd[i + 2];
                if (R > 70 && R > G * 1.5 && R > B * 1.5) {
                  const target = Math.max(G, B) * 0.92;
                  const f = 1 - Math.min(1, (dist / r) * 0.4); // softer at edges
                  rd[i] = R + (target - R) * f;
                  rd[i + 1] = G + (target * 0.98 - G) * f * 0.6;
                  rd[i + 2] = B + (target * 0.98 - B) * f * 0.6;
                }
              }
            }
            ctx.putImageData(region, x0, y0);
          }
          break;
        }
      }
      ctx.restore();
    }
  }

  /* ── portrait (background) blur: sharp centre subject, melted bg ────── */
  if (edits.portraitBlur > 0) {
    const blurred = document.createElement('canvas');
    blurred.width = g.w; blurred.height = g.h;
    const bctx = blurred.getContext('2d')!;
    bctx.filter = `blur(${edits.portraitBlur}px)`;
    bctx.drawImage(canvas, 0, 0);
    const sharp = document.createElement('canvas');
    sharp.width = g.w; sharp.height = g.h;
    const sctx = sharp.getContext('2d')!;
    sctx.drawImage(canvas, 0, 0);
    sctx.globalCompositeOperation = 'destination-in';
    const gcx = g.imgX + g.imgW / 2, gcy = g.imgY + g.imgH * 0.46;
    const gr = sctx.createRadialGradient(gcx, gcy, Math.min(g.imgW, g.imgH) * 0.12, gcx, gcy, Math.min(g.imgW, g.imgH) * 0.46);
    gr.addColorStop(0, 'rgba(0,0,0,1)');
    gr.addColorStop(0.75, 'rgba(0,0,0,1)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    sctx.fillStyle = gr;
    sctx.fillRect(0, 0, g.w, g.h);
    ctx.save();
    ctx.beginPath(); ctx.rect(g.imgX, g.imgY, g.imgW, g.imgH); ctx.clip();
    ctx.clearRect(g.imgX, g.imgY, g.imgW, g.imgH);
    if (edits.pad) { ctx.fillStyle = edits.pad.color; }
    ctx.drawImage(blurred, 0, 0);
    ctx.drawImage(sharp, 0, 0);
    ctx.restore();
  }

  /* ── grain ──────────────────────────────────────────────────────────── */
  if (a.grain > 0) {
    const strength = Math.min(0.5, a.grain / 160);
    const noise = document.createElement('canvas');
    noise.width = 128; noise.height = 128;
    const nctx = noise.getContext('2d')!;
    const nd = nctx.createImageData(128, 128);
    for (let i = 0; i < nd.data.length; i += 4) {
      const n = 128 + (Math.random() - 0.5) * 255;
      nd.data[i] = nd.data[i + 1] = nd.data[i + 2] = n;
      nd.data[i + 3] = 255 * strength;
    }
    nctx.putImageData(nd, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.beginPath(); ctx.rect(g.imgX, g.imgY, g.imgW, g.imgH); ctx.clip();
    const pat = ctx.createPattern(noise, 'repeat')!;
    ctx.fillStyle = pat;
    ctx.fillRect(g.imgX, g.imgY, g.imgW, g.imgH);
    ctx.restore();
  }

  /* ── vignette ───────────────────────────────────────────────────────── */
  if (a.vignette > 0) {
    const vg = ctx.createRadialGradient(cx, cy, Math.min(g.imgW, g.imgH) * 0.35, cx, cy, Math.max(g.imgW, g.imgH) * 0.72);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, `rgba(0,0,0,${Math.min(0.85, a.vignette / 110)})`);
    ctx.save();
    ctx.beginPath(); ctx.rect(g.imgX, g.imgY, g.imgW, g.imgH); ctx.clip();
    ctx.fillStyle = vg;
    ctx.fillRect(g.imgX, g.imgY, g.imgW, g.imgH);
    ctx.restore();
  }

  /* ── frame ──────────────────────────────────────────────────────────── */
  if (edits.frame && edits.frame.id !== 'none') drawFrame(ctx, edits.frame, g);

  /* ── markup / stickers / text ───────────────────────────────────────── */
  if (includeMarkup && edits.markup.length) drawMarkup(ctx, edits, g.imgW, g.imgH, g.imgX, g.imgY);
  if (edits.stickers.length) drawStickerLayers(ctx, edits.stickers, g, time);
  if (edits.texts.length) drawTextLayers(ctx, edits.texts, g, time);

  return canvas;
}

/* ── frame drawing ────────────────────────────────────────────────────── */

function drawFrame(ctx: CanvasRenderingContext2D, frame: FrameStyle, g: OutGeom) {
  const minDim = Math.min(g.imgW, g.imgH);
  const wpx = Math.max(2, (frame.width / 1000) * minDim);
  ctx.save();
  ctx.strokeStyle = frame.color;
  ctx.fillStyle = frame.color;
  switch (frame.id) {
    case 'thin':
      ctx.lineWidth = Math.max(1.5, wpx * 0.3);
      ctx.strokeRect(g.imgX + ctx.lineWidth / 2, g.imgY + ctx.lineWidth / 2, g.imgW - ctx.lineWidth, g.imgH - ctx.lineWidth);
      break;
    case 'thick':
      ctx.lineWidth = wpx;
      ctx.strokeRect(g.imgX + wpx / 2, g.imgY + wpx / 2, g.imgW - wpx, g.imgH - wpx);
      break;
    case 'polaroid': {
      // instant-photo border: uniform bands with a heavier bottom mount
      const side = Math.max(3, wpx * 1.1);
      const bottom = side * 2.6;
      ctx.fillStyle = frame.color;
      ctx.fillRect(g.imgX, g.imgY, g.imgW, side);                                  // top
      ctx.fillRect(g.imgX, g.imgY + g.imgH - bottom, g.imgW, bottom);               // bottom mount
      ctx.fillRect(g.imgX, g.imgY, side, g.imgH - bottom);                          // left
      ctx.fillRect(g.imgX + g.imgW - side, g.imgY, side, g.imgH - bottom);          // right
      break;
    }
    case 'round': {
      ctx.lineWidth = wpx;
      const r = Math.min(g.imgW, g.imgH) * 0.08;
      roundRect(ctx, g.imgX + wpx / 2, g.imgY + wpx / 2, g.imgW - wpx, g.imgH - wpx, r);
      ctx.stroke();
      break;
    }
    case 'corners': {
      const len = Math.min(g.imgW, g.imgH) * 0.14;
      ctx.lineWidth = Math.max(2, wpx * 0.4);
      ctx.lineCap = 'round';
      const pts: Array<[number, number, number, number]> = [
        [g.imgX, g.imgY, 1, 1],
        [g.imgX + g.imgW, g.imgY, -1, 1],
        [g.imgX, g.imgY + g.imgH, 1, -1],
        [g.imgX + g.imgW, g.imgY + g.imgH, -1, -1],
      ];
      for (const [x, y, sxx, syy] of pts) {
        const inset = ctx.lineWidth;
        ctx.beginPath();
        ctx.moveTo(x + sxx * inset, y + syy * (inset + len));
        ctx.lineTo(x + sxx * inset, y + syy * inset);
        ctx.lineTo(x + sxx * (inset + len), y + syy * inset);
        ctx.stroke();
      }
      break;
    }
  }
  ctx.restore();
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

/* ── markup ───────────────────────────────────────────────────────────── */

export function drawMarkup(ctx: CanvasRenderingContext2D, edits: EditState, w: number, h: number, ox = 0, oy = 0) {
  for (const s of edits.markup) {
    ctx.save();
    ctx.translate(ox, oy);
    ctx.globalAlpha = s.opacity ?? 1;
    if (s.tool === 'highlighter') {
      ctx.globalCompositeOperation = 'multiply';
    }
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.lineWidth = Math.max(1.5, (s.width / 100) * Math.min(w, h) * (s.tool === 'highlighter' ? 0.14 : 0.06));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const pts = s.points.map((p) => ({ x: p.x * w, y: p.y * h }));
    if (!pts.length) { ctx.restore(); continue; }
    switch (s.tool) {
      case 'pen':
      case 'highlighter': {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
        ctx.stroke();
        break;
      }
      case 'line': {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        ctx.stroke();
        break;
      }
      case 'arrow': {
        const a0 = pts[0], a1 = pts[pts.length - 1];
        ctx.beginPath();
        ctx.moveTo(a0.x, a0.y);
        ctx.lineTo(a1.x, a1.y);
        ctx.stroke();
        const ang = Math.atan2(a1.y - a0.y, a1.x - a0.x);
        const hl = ctx.lineWidth * 3.2;
        ctx.beginPath();
        ctx.moveTo(a1.x, a1.y);
        ctx.lineTo(a1.x - hl * Math.cos(ang - 0.45), a1.y - hl * Math.sin(ang - 0.45));
        ctx.lineTo(a1.x - hl * Math.cos(ang + 0.45), a1.y - hl * Math.sin(ang + 0.45));
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'rect': {
        const p0 = pts[0], p1 = pts[pts.length - 1];
        ctx.strokeRect(Math.min(p0.x, p1.x), Math.min(p0.y, p1.y), Math.abs(p1.x - p0.x), Math.abs(p1.y - p0.y));
        break;
      }
      case 'ellipse': {
        const p0 = pts[0], p1 = pts[pts.length - 1];
        ctx.beginPath();
        ctx.ellipse((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, Math.abs(p1.x - p0.x) / 2, Math.abs(p1.y - p0.y) / 2, 0, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'text': {
        const size = Math.max(14, (s.width / 100) * Math.min(w, h) * 0.16);
        ctx.font = `600 ${size}px system-ui, sans-serif`;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = size * 0.25;
        ctx.fillText(s.text ?? '', pts[0].x, pts[0].y);
        break;
      }
    }
    ctx.restore();
  }
}

/* ── stickers ─────────────────────────────────────────────────────────── */

const EMOJI_STACK = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Android Emoji", sans-serif';

export function drawStickerLayers(ctx: CanvasRenderingContext2D, layers: StickerLayer[], g: OutGeom, time: number | null) {
  const sorted = [...layers].sort((p, q) => p.z - q.z);
  const minDim = Math.min(g.imgW, g.imgH);
  for (const layer of sorted) {
    if (time !== null && layer.t0 !== null && time < layer.t0) continue;
    if (time !== null && layer.t1 !== null && time > layer.t1) continue;
    const def = getSticker(layer.stickerId);
    if (!def) continue;
    const x = g.imgX + layer.x * g.imgW;
    const y = g.imgY + layer.y * g.imgH;
    let scale = layer.scale * minDim;
    let alpha = layer.opacity;
    if (time !== null && layer.anim && def.animated) {
      scale *= 1 + Math.sin(time * 5.5 + layer.x * 12) * 0.07;
      alpha *= 0.88 + Math.sin(time * 4.2 + layer.y * 9) * 0.12;
    }
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.translate(x, y);
    ctx.rotate((layer.rot * Math.PI) / 180);
    if (def.kind === 'emoji') {
      ctx.font = `${scale * 1.15}px ${EMOJI_STACK}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(def.glyph ?? '', 0, scale * 0.06);
    } else if (def.draw) {
      ctx.save();
      ctx.scale(scale, scale);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      def.draw(ctx, layer.color ?? '#ffffff');
      ctx.restore();
    }
    ctx.restore();
  }
}

/* ── text layers ──────────────────────────────────────────────────────── */

export function drawTextLayers(ctx: CanvasRenderingContext2D, layers: TextLayer[], g: OutGeom, time: number | null) {
  const sorted = [...layers].sort((p, q) => p.z - q.z);
  const minDim = Math.min(g.imgW, g.imgH);
  for (const layer of sorted) {
    if (time !== null && layer.t0 !== null && time < layer.t0) continue;
    if (time !== null && layer.t1 !== null && time > layer.t1) continue;
    let alpha = layer.opacity;
    let dy = 0;
    let scaleMul = 1;
    if (time !== null && layer.anim && layer.anim !== 'none' && layer.t0 !== null) {
      const age = time - layer.t0;
      if (layer.anim === 'fade') alpha *= Math.min(1, age / 0.4);
      if (layer.anim === 'rise') { alpha *= Math.min(1, age / 0.35); dy = (1 - Math.min(1, age / 0.35)) * minDim * 0.05; }
      if (layer.anim === 'pop') { scaleMul = age < 0.3 ? 0.6 + 0.4 * Math.min(1, age / 0.3) * (1 + 0.18 * Math.sin((age / 0.3) * Math.PI)) : 1; alpha *= Math.min(1, age / 0.2); }
    }
    const font = getFont(layer.fontId);
    const size = Math.max(8, layer.scale * minDim * 0.5 * scaleMul);
    const x = g.imgX + layer.x * g.imgW;
    const y = g.imgY + layer.y * g.imgH + dy;
    const lines = (layer.text ?? '').split('\n');
    const spacing = (layer.spacing / 100) * size * 0.14;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.translate(x, y);
    ctx.rotate((layer.rot * Math.PI) / 180);
    ctx.font = `${font.weight} ${size}px ${font.stack}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = layer.align;

    // measure (with letter spacing)
    const lineWidth = (line: string) => {
      let wSum = ctx.measureText(line).width;
      if (spacing) wSum += spacing * Math.max(0, line.length - 1);
      return wSum;
    };
    const widths = lines.map(lineWidth);
    const maxW = Math.max(1, ...widths);
    const lineH = size * layer.lineHeight;
    const totalH = lineH * lines.length;

    // background
    if (layer.bg) {
      const padX = size * 0.34, padY = size * 0.2;
      let bx = -maxW / 2 - padX;
      if (layer.align === 'left') bx = -padX;
      if (layer.align === 'right') bx = -maxW - padX;
      ctx.fillStyle = layer.bg;
      roundRect(ctx, bx, -totalH / 2 - padY, maxW + padX * 2, totalH + padY * 2, size * 0.22);
      ctx.fill();
    }

    const drawLine = (line: string, ly: number, paint: 'fill' | 'stroke') => {
      let lx = 0;
      if (layer.align === 'center') lx = -lineWidth(line) / 2;
      if (layer.align === 'right') lx = -lineWidth(line);
      if (spacing && 'letterSpacing' in ctx) {
        (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${spacing}px`;
        if (paint === 'fill') ctx.fillText(line, layer.align === 'center' ? 0 : layer.align === 'right' ? 0 : 0, ly);
        else ctx.strokeText(line, 0, ly);
        (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '0px';
        return;
      }
      // manual letter spacing fallback
      const chars = [...line];
      let cursor = lx;
      ctx.textAlign = 'left';
      for (const ch of chars) {
        if (paint === 'fill') ctx.fillText(ch, cursor, ly);
        else ctx.strokeText(ch, cursor, ly);
        cursor += ctx.measureText(ch).width + spacing;
      }
    };

    if (layer.shadow) {
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = size * 0.22;
      ctx.shadowOffsetY = size * 0.06;
    }
    if (layer.outline > 0) {
      ctx.lineWidth = Math.max(1, size * 0.09 * layer.outline);
      ctx.strokeStyle = layer.outlineColor;
      ctx.lineJoin = 'round';
      lines.forEach((line, i2) => drawLine(line, -totalH / 2 + lineH * (i2 + 0.5), 'stroke'));
      ctx.shadowColor = 'transparent';
    }
    ctx.fillStyle = layer.color;
    lines.forEach((line, i2) => drawLine(line, -totalH / 2 + lineH * (i2 + 0.5), 'fill'));
    ctx.restore();
  }
}

/* ── export helpers ───────────────────────────────────────────────────── */

export function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), type, quality);
  });
}
