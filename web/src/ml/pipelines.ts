/**
 * On-device "ML" pipelines.
 *
 * Everything here runs locally on the pixels — no network calls — mirroring
 * the Flutter app's ML Kit / TFLite stage:
 *   • perceptual average-hash  → duplicate & similar-image detection
 *   • laplacian variance       → blur / sharpness scoring
 *   • colour statistics        → scene heuristics (sunset, night, nature…)
 * Face grouping and OCR are simulated: their outputs ship as curated metadata
 * (a real device would run ML Kit face detection + on-device text recognition).
 */
import type { MediaItem, VisionMetrics } from '../data/models';

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to decode ${src}`));
    img.src = src;
  });
}

const N = 64;

let scratch: HTMLCanvasElement | null = null;
function canvas64(): CanvasRenderingContext2D {
  if (!scratch) {
    scratch = document.createElement('canvas');
    scratch.width = N;
    scratch.height = N;
  }
  const ctx = scratch.getContext('2d', { willReadFrequently: true })!;
  return ctx;
}

export interface PixelStats {
  luma: Float32Array;
  brightness: number;
  saturation: number;
  warmth: number;
  greenness: number;
  dominant: [number, number, number];
  hash: string;
  blur: number;
}

export function analysePixels(img: HTMLImageElement): PixelStats {
  const ctx = canvas64();
  ctx.clearRect(0, 0, N, N);
  ctx.drawImage(img, 0, 0, N, N);
  const { data } = ctx.getImageData(0, 0, N, N);

  const luma = new Float32Array(N * N);
  let sumL = 0, sumSat = 0, sumW = 0, sumG = 0;
  const hist = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    luma[p] = l;
    sumL += l;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    sumSat += mx === 0 ? 0 : (mx - mn) / mx;
    sumW += r - b;
    sumG += g - (r + b) / 2;
    const key = ((r >> 6) << 8) | ((g >> 6) << 4) | (b >> 6);
    const bin = hist.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    bin.n++; bin.r += r; bin.g += g; bin.b += b;
    hist.set(key, bin);
  }
  const count = N * N;

  // laplacian variance → sharpness
  let sum = 0, sumSq = 0;
  let n = 0;
  for (let y = 1; y < N - 1; y++) {
    for (let x = 1; x < N - 1; x++) {
      const i = y * N + x;
      const v = 4 * luma[i] - luma[i - 1] - luma[i + 1] - luma[i - N] - luma[i + N];
      sum += v; sumSq += v * v; n++;
    }
  }
  const mean = sum / n;
  const blur = sumSq / n - mean * mean;

  // 8x8 average hash (16 hex chars = 64 bits)
  let hash = '';
  const block: number[] = [];
  for (let by = 0; by < 8; by++) {
    for (let bx = 0; bx < 8; bx++) {
      let acc = 0;
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) acc += luma[(by * 8 + y) * N + bx * 8 + x];
      block.push(acc / 64);
    }
  }
  const avg = block.reduce((a, b) => a + b, 0) / 64;
  for (let i = 0; i < 64; i += 4) {
    let nibble = 0;
    for (let j = 0; j < 4; j++) nibble = (nibble << 1) | (block[i + j] > avg ? 1 : 0);
    hash += nibble.toString(16);
  }

  let best = { n: 0, r: 0, g: 0, b: 0 };
  for (const bin of hist.values()) if (bin.n > best.n) best = bin;
  const dominant: [number, number, number] = [best.r / best.n, best.g / best.n, best.b / best.n];

  return {
    luma,
    brightness: sumL / count / 255,
    saturation: sumSat / count,
    warmth: sumW / count,
    greenness: sumG / count,
    dominant,
    hash,
    blur,
  };
}

export function hamming(a: string, b: string): number {
  let d = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) { d += x & 1; x >>= 1; }
  }
  return d;
}

function heuristicTags(s: PixelStats, item: MediaItem): string[] {
  const tags: string[] = [];
  if (item.kind === 'screenshot') tags.push('screenshot', 'text', 'ui');
  if (item.ocr) tags.push('document', 'text');
  if (s.brightness < 0.24) tags.push('night', 'dark');
  if (s.warmth > 26 && s.saturation > 0.24) tags.push('sunset', 'warm');
  if (s.greenness > 10) tags.push('nature', 'green');
  if (s.saturation > 0.42) tags.push('colorful');
  if (s.brightness > 0.78) tags.push('bright');
  if (item.video) tags.push('video');
  if (item.faces?.length) tags.push('people', 'faces');
  if (item.folder === 'WhatsApp') tags.push('whatsapp');
  return tags;
}

export interface ScanReport {
  items: number;
  ms: number;
  duplicates: string[][];   // groups of item ids
  blurry: string[];
  faces: number;
  ocrDocs: number;
}

/** Streams over the library, computing vision metrics without blocking the UI. */
export async function scanLibrary(items: MediaItem[], onProgress?: (done: number, total: number) => void): Promise<ScanReport> {
  const t0 = performance.now();
  let done = 0;
  for (const item of items) {
    try {
      const img = await loadImage(item.src);
      const s = analysePixels(img);
      const vision: VisionMetrics = {
        hash: s.hash,
        blur: s.blur,
        brightness: s.brightness,
        saturation: s.saturation,
        warmth: s.warmth,
        greenness: s.greenness,
        dominant: s.dominant,
        tags: heuristicTags(s, item),
        scannedMs: performance.now() - t0,
      };
      item.vision = vision;
    } catch {
      // undecodable asset — skip vision features for it
    }
    done++;
    onProgress?.(done, items.length);
    if (done % 6 === 0) await new Promise((r) => setTimeout(r));
  }

  const ms = performance.now() - t0;

  // relative blur threshold (robust across libraries)
  const blurs = items.map((i) => i.vision?.blur ?? 0).filter((b) => b > 0).sort((a, b) => a - b);
  const median = blurs.length ? blurs[Math.floor(blurs.length / 2)] : 0;
  const blurryThreshold = median * 0.22;
  const blurry: string[] = [];
  for (const item of items) {
    if (item.vision && item.vision.blur < blurryThreshold && item.kind !== 'screenshot') {
      blurry.push(item.id);
      if (!item.vision.tags.includes('blurry')) item.vision.tags.push('blurry');
    }
  }

  // duplicate / near-duplicate grouping via perceptual hash
  const duplicates: string[][] = [];
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let r = x;
    while ((parent.get(r) ?? r) !== r) r = parent.get(r)!;
    parent.set(x, r);
    return r;
  };
  const union = (a: string, b: string) => { parent.set(find(a), find(b)); };
  const scannable = items.filter((i) => i.vision && i.kind !== 'screenshot');
  for (const a of scannable) parent.set(a.id, a.id);
  for (let i = 0; i < scannable.length; i++) {
    for (let j = i + 1; j < scannable.length; j++) {
      const A = scannable[i], B = scannable[j];
      if (hamming(A.vision!.hash, B.vision!.hash) <= 7) union(A.id, B.id);
    }
  }
  const groups = new Map<string, string[]>();
  for (const a of scannable) {
    const root = find(a.id);
    const g = groups.get(root) ?? [];
    g.push(a.id);
    groups.set(root, g);
  }
  for (const g of groups.values()) if (g.length > 1) duplicates.push(g);

  for (const item of items) {
    if (item.vision && duplicates.some((g) => g.includes(item.id)) && !item.vision.tags.includes('duplicate')) {
      item.vision.tags.push('duplicate');
    }
  }

  return {
    items: items.length,
    ms,
    duplicates,
    blurry,
    faces: items.reduce((s, i) => s + (i.faces?.length ?? 0), 0),
    ocrDocs: items.filter((i) => i.ocr).length,
  };
}

/** Material You "wallpaper" colour: dominant colour of the newest photo. */
export function wallpaperSeed(items: MediaItem[]): string {
  const withVision = items.filter((i) => i.vision && i.kind === 'photo');
  if (!withVision.length) return '#6750a4';
  const newest = withVision.reduce((a, b) => (a.takenAt > b.takenAt ? a : b));
  const [r, g, b] = newest.vision!.dominant;
  const c = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
